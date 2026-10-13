import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";
import { FIXTURE_SERIES, FIXTURE_PROVIDERS, FIXTURE_BUYERS, FIXTURE_GPU_CLASSES } from "./fixtures/events.js";

describe("Complete Delivery Indexing Lifecycle Integration", () => {
  it("processes an end-to-end marketplace flow across all contracts and entities", async () => {
    const testIndexer = createTestIndexer();

    // 1. Initialize Series & Providers
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            ...FIXTURE_SERIES,
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: FIXTURE_PROVIDERS.alpha, name: "HyperNode-Bangalore" },
            },
          ],
        },
      },
    });

    const series = await testIndexer.Series.get("1");
    expect(series?.symbol).toBe("gT4-NOW");

    const provider = await testIndexer.Provider.get(FIXTURE_PROVIDERS.alpha.toLowerCase());
    expect(provider?.name).toBe("HyperNode-Bangalore");

    // 2. Provider Mints 100 GPU Hours
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Minted",
              params: {
                seriesId: 1n,
                provider: FIXTURE_PROVIDERS.alpha,
                hours_: 100n,
                bond: 4200000000n,
              },
            },
          ],
        },
      },
    });

    const mintedProvider = await testIndexer.Provider.get(FIXTURE_PROVIDERS.alpha.toLowerCase());
    expect(mintedProvider?.minted).toBe(100n);

    // 3. Buyer Redeems / Requests Delivery
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 2001n,
                seriesId: 1n,
                buyer: FIXTURE_BUYERS.alice,
                provider: FIXTURE_PROVIDERS.alpha,
                hours_: 25n,
                buyerEncPubKey: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                deadline: 1729476000n,
              },
            },
          ],
        },
      },
    });

    const deliveryRequested = await testIndexer.Delivery.get("2001");
    expect(deliveryRequested?.status).toBe("REQUESTED");
    expect(deliveryRequested?.hours).toBe(25n);

    // 4. Provider Provisions Confidential Ciphertext
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Provisioned",
              params: {
                deliveryId: 2001n,
                ciphertext: "0x01feedcafe0011223344",
              },
            },
          ],
        },
      },
    });

    const deliveryProvisioned = await testIndexer.Delivery.get("2001");
    expect(deliveryProvisioned?.status).toBe("PROVISIONED");

    // 5. Verifier Settles Delivery with PASS verdict (1)
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 2001n,
                verdict: 1n,
                tflopsE2: 8250n,
                toBuyer: 0n,
                toProvider: 1050000000n,
              },
            },
          ],
        },
      },
    });

    const deliverySettled = await testIndexer.Delivery.get("2001");
    expect(deliverySettled?.status).toBe("SETTLED");
    expect(deliverySettled?.verdict).toBe(1);
    expect(deliverySettled?.toProvider).toBe(1050000000n);

    // 6. Oracle Publishes Index Print
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "IndexOracle",
              event: "PrintPublished",
              params: {
                gpuClass: FIXTURE_GPU_CLASSES.T4,
                dayKey: 20005n,
                priceE8: 35000000n,
              },
            },
          ],
        },
      },
    });

    const print = await testIndexer.IndexPrint.get(`${FIXTURE_GPU_CLASSES.T4}-20005`);
    expect(print?.priceE8).toBe(35000000n);

    // Final checks on aggregate provider reputation
    const finalProvider = await testIndexer.Provider.get(FIXTURE_PROVIDERS.alpha.toLowerCase());
    expect(finalProvider?.passes).toBe(1);
    expect(finalProvider?.hoursDelivered).toBe(25n);
    expect(finalProvider?.slashedTotal).toBe(0n);
  });
});
