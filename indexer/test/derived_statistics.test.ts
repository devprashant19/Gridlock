import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Validated Marketplace Statistics", () => {
  it("calculates provider and series aggregate statistics accurately across multiple batches and lifecycles", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x9999999999999999999999999999999999999999" as `0x${string}`;
    const buyer1 = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as `0x${string}`;
    const buyer2 = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as `0x${string}`;

    // 1. Register & Mint 2 batches (50 + 75 = 125 hours)
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: providerAddr, name: "OmniCompute" },
            },
            {
              contract: "DeliveryEscrow",
              event: "Minted",
              params: { seriesId: 1n, provider: providerAddr, hours_: 50n, bond: 6000000000n },
            },
            {
              contract: "DeliveryEscrow",
              event: "Minted",
              params: { seriesId: 1n, provider: providerAddr, hours_: 75n, bond: 9000000000n },
            },
          ],
        },
      },
    });

    let provider = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(provider?.minted).toBe(125n);

    // 2. Lifecycle 1: 30 hours, PASS
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 1001n,
                seriesId: 1n,
                buyer: buyer1,
                provider: providerAddr,
                hours_: 30n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "Provisioned",
              params: { deliveryId: 1001n, ciphertext: "0x01beef" },
            },
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 1001n,
                verdict: 1n,
                tflopsE2: 8300n,
                toBuyer: 0n,
                toProvider: 3600000000n,
              },
            },
          ],
        },
      },
    });

    // 3. Lifecycle 2: 20 hours, DEGRADED (30% toBuyer = 720000000n)
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 1002n,
                seriesId: 1n,
                buyer: buyer2,
                provider: providerAddr,
                hours_: 20n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "Provisioned",
              params: { deliveryId: 1002n, ciphertext: "0x01beef" },
            },
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 1002n,
                verdict: 2n,
                tflopsE2: 5600n,
                toBuyer: 720000000n,
                toProvider: 1680000000n,
              },
            },
          ],
        },
      },
    });

    // 4. Lifecycle 3: 15 hours, FAIL (100% toBuyer = 1800000000n)
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 1003n,
                seriesId: 1n,
                buyer: buyer1,
                provider: providerAddr,
                hours_: 15n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 1003n,
                verdict: 3n,
                tflopsE2: 1200n,
                toBuyer: 1800000000n,
                toProvider: 0n,
              },
            },
          ],
        },
      },
    });

    // 5. Lifecycle 4: 10 hours, TIMEOUT (100% toBuyer = 1200000000n)
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 1004n,
                seriesId: 1n,
                buyer: buyer2,
                provider: providerAddr,
                hours_: 10n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "TimeoutClaimed",
              params: {
                deliveryId: 1004n,
                toBuyer: 1200000000n,
                toProvider: 0n,
              },
            },
          ],
        },
      },
    });

    provider = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(provider?.minted).toBe(125n);
    expect(provider?.passes).toBe(1);
    expect(provider?.degraded).toBe(1);
    expect(provider?.fails).toBe(1);
    expect(provider?.timeouts).toBe(1);
    // hoursDelivered = 30 (pass) + 20 (degraded) = 50 hours
    expect(provider?.hoursDelivered).toBe(50n);
    // slashedTotal = 720000000n (degraded) + 1800000000n (fail) + 1200000000n (timeout) = 3720000000n
    expect(provider?.slashedTotal).toBe(3720000000n);
  });
});
