import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Provider Entities and Activity Relationships", () => {
  it("maintains consistent provider activity across minting and delivery settlement", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const buyerAddr = "0x2222222222222222222222222222222222222222" as `0x${string}`;

    // 1. Register
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: providerAddr, name: "FastCompute-Alpha" },
            },
          ],
        },
      },
    });

    // 2. Mint 100 hours
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Minted",
              params: {
                seriesId: 1n,
                provider: providerAddr,
                hours_: 100n,
                bond: 12000000000n,
              },
            },
          ],
        },
      },
    });

    // 3. Request two deliveries
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 501n,
                seriesId: 1n,
                buyer: buyerAddr,
                provider: providerAddr,
                hours_: 40n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 502n,
                seriesId: 1n,
                buyer: buyerAddr,
                provider: providerAddr,
                hours_: 20n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
          ],
        },
      },
    });

    // 4. Settle delivery 501 as PASS
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 501n,
                verdict: 1n,
                tflopsE2: 8250n,
                toBuyer: 0n,
                toProvider: 4800000000n,
              },
            },
          ],
        },
      },
    });

    // 5. Settle delivery 502 as FAIL
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 502n,
                verdict: 3n,
                tflopsE2: 1000n,
                toBuyer: 2400000000n,
                toProvider: 0n,
              },
            },
          ],
        },
      },
    });

    const provider = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(provider?.minted).toBe(100n);
    expect(provider?.passes).toBe(1);
    expect(provider?.fails).toBe(1);
    expect(provider?.hoursDelivered).toBe(40n);
    expect(provider?.slashedTotal).toBe(2400000000n);

    const d1 = await testIndexer.Delivery.get("501");
    expect(d1?.provider_id).toBe(providerAddr.toLowerCase());
    expect(d1?.status).toBe("SETTLED");
    expect(d1?.verdict).toBe(1);

    const d2 = await testIndexer.Delivery.get("502");
    expect(d2?.provider_id).toBe(providerAddr.toLowerCase());
    expect(d2?.status).toBe("SETTLED");
    expect(d2?.verdict).toBe(3);
  });
});
