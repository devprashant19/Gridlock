import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

const PROVIDER = "0x00000000000000000000000000000000000000a1";
const BUYER = "0x00000000000000000000000000000000000000b1";
const T4 = "0x21b2fae6f47053e1ebec92f3900223fa8c9ccf060714b7e1c8ce8b10efd867c0";
const MARKET = "0x8888888888888888888888888888888888888888"; // gT4-NOW in src/markets.ts

async function seed(testIndexer: ReturnType<typeof createTestIndexer>) {
  await testIndexer.process({
    chains: {
      10143: {
        simulate: [
          {
            contract: "SeriesFactory",
            event: "SeriesCreated",
            params: {
              seriesId: 1n,
              gpuClass: T4,
              token: "0x7777777777777777777777777777777777777777",
              windowStart: 1n,
              windowEnd: 2n,
              symbol: "gT4-NOW",
            },
          },
          {
            contract: "DeliveryEscrow",
            event: "ProviderRegistered",
            params: {
              provider: PROVIDER,
              name: "HyperNode",
            },
          },
          {
            contract: "DeliveryEscrow",
            event: "Minted",
            params: {
              seriesId: 1n,
              provider: PROVIDER,
              hours_: 10n,
              bond: 4_200_000n,
            },
          },
        ],
      },
    },
  });
}

async function redeemAndProvision(
  testIndexer: ReturnType<typeof createTestIndexer>,
  id: bigint,
  hours: bigint
) {
  await testIndexer.process({
    chains: {
      10143: {
        simulate: [
          {
            contract: "DeliveryEscrow",
            event: "DeliveryRequested",
            params: {
              deliveryId: id,
              seriesId: 1n,
              buyer: BUYER,
              provider: PROVIDER,
              hours_: hours,
              buyerEncPubKey: `0x${"11".repeat(32)}`,
              deadline: 99n,
            },
          },
          {
            contract: "DeliveryEscrow",
            event: "Provisioned",
            params: {
              deliveryId: id,
              ciphertext: "0xdeadbeef",
            },
          },
        ],
      },
    },
  });
}

describe("Gridlock indexer handlers", () => {
  it("tracks series hours and provider mint", async () => {
    const testIndexer = createTestIndexer();
    await seed(testIndexer);

    const s = await testIndexer.Series.get("1");
    expect(s?.symbol).toBe("gT4-NOW");
    expect(s?.market).toBe(MARKET);
    expect(s?.openHours).toBe(10n);

    const p = await testIndexer.Provider.get(PROVIDER.toLowerCase());
    expect(p?.name).toBe("HyperNode");
    expect(p?.minted).toBe(10n);
    expect(p?.bondPosted).toBe(4_200_000n);
  });

  it("delivery lifecycle + leaderboard counters per verdict", async () => {
    const testIndexer = createTestIndexer();
    await seed(testIndexer);
    await redeemAndProvision(testIndexer, 0n, 1n);

    const d0 = await testIndexer.Delivery.get("0");
    expect(d0?.status).toBe("PROVISIONED");
    const s1 = await testIndexer.Series.get("1");
    expect(s1?.openHours).toBe(9n);

    // FAIL: whole bond to buyer
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 0n,
                verdict: 3n,
                tflopsE2: 120n,
                toBuyer: 420_000n,
                toProvider: 0n,
              },
            },
          ],
        },
      },
    });

    // PASS
    await redeemAndProvision(testIndexer, 1n, 2n);
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 1n,
                verdict: 1n,
                tflopsE2: 815n,
                toBuyer: 0n,
                toProvider: 840_000n,
              },
            },
          ],
        },
      },
    });

    // DEGRADED
    await redeemAndProvision(testIndexer, 2n, 1n);
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 2n,
                verdict: 2n,
                tflopsE2: 500n,
                toBuyer: 294_000n,
                toProvider: 126_000n,
              },
            },
          ],
        },
      },
    });

    const d = await testIndexer.Delivery.get("0");
    expect(d?.status).toBe("SETTLED");
    expect(d?.verdict).toBe(3);
    expect(d?.tflopsE2).toBe(120);

    const p = await testIndexer.Provider.get(PROVIDER.toLowerCase());
    expect([p?.passes, p?.degraded, p?.fails]).toEqual([1, 1, 1]);
    expect(p?.slashedTotal).toBe(714_000n);
    expect(p?.earnedTotal).toBe(966_000n);
    expect(p?.hoursDelivered).toBe(3n); // fail hours excluded
  });

  it("timeout before provisioning counts as a strike", async () => {
    const testIndexer = createTestIndexer();
    await seed(testIndexer);

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 5n,
                seriesId: 1n,
                buyer: BUYER,
                provider: PROVIDER,
                hours_: 1n,
                buyerEncPubKey: `0x${"11".repeat(32)}`,
                deadline: 99n,
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "TimeoutClaimed",
              params: {
                deliveryId: 5n,
                toBuyer: 420_000n,
                toProvider: 0n,
              },
            },
          ],
        },
      },
    });

    const d5 = await testIndexer.Delivery.get("5");
    expect(d5?.status).toBe("TIMEOUT");
    const p = await testIndexer.Provider.get(PROVIDER.toLowerCase());
    expect(p?.timeouts).toBe(1);
    expect(p?.slashedTotal).toBe(420_000n);
  });

  it("index prints and kuru trades feed the forward curve", async () => {
    const testIndexer = createTestIndexer();
    await seed(testIndexer);

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "IndexOracle",
              event: "PrintPublished",
              params: {
                gpuClass: T4,
                dayKey: 20000n,
                priceE8: 35_000_000n,
              },
            },
            {
              contract: "IndexOracle",
              event: "PrintPublished",
              params: {
                gpuClass: T4,
                dayKey: 20001n,
                priceE8: 36_000_000n,
              },
            },
            {
              contract: "KuruOrderBook",
              event: "Trade",
              params: {
                orderId: 7n,
                makerAddress: PROVIDER,
                isBuy: false,
                price: 355_000_000_000_000_000n,
                updatedSize: 0n,
                takerAddress: BUYER,
                txOrigin: BUYER,
                filledSize: 100n,
              },
            },
          ],
        },
      },
    });

    const c = await testIndexer.GpuClass.get(T4);
    expect(c?.latestPriceE8).toBe(36_000_000n);
    expect(c?.printCount).toBe(2);
  });
});
