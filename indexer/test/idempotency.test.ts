import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Handler Idempotency & Ordering", () => {
  it("prevents double-counting when Settled event is replayed", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const buyerAddr = "0x2222222222222222222222222222222222222222" as `0x${string}`;

    // 1. Initial setup & delivery request
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: providerAddr, name: "NodeX" },
            },
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 401n,
                seriesId: 1n,
                buyer: buyerAddr,
                provider: providerAddr,
                hours_: 10n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
          ],
        },
      },
    });

    // 2. First Settlement (PASS)
    const settledEvent = {
      contract: "DeliveryEscrow" as const,
      event: "Settled" as const,
      params: {
        deliveryId: 401n,
        verdict: 1n,
        tflopsE2: 8250n,
        toBuyer: 0n,
        toProvider: 1200000000n,
      },
    };

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [settledEvent],
        },
      },
    });

    const providerAfterFirst = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(providerAfterFirst?.passes).toBe(1);
    expect(providerAfterFirst?.hoursDelivered).toBe(10n);

    // 3. Replay exact same Settlement event (simulating RPC replay or reorg reprocessing)
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [settledEvent],
        },
      },
    });

    const providerAfterReplay = await testIndexer.Provider.get(providerAddr.toLowerCase());
    // Invariant: passes and hoursDelivered must NOT be double counted!
    expect(providerAfterReplay?.passes).toBe(1);
    expect(providerAfterReplay?.hoursDelivered).toBe(10n);
  });

  it("prevents double-counting when TimeoutClaimed event is replayed", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x3333333333333333333333333333333333333333" as `0x${string}`;
    const buyerAddr = "0x4444444444444444444444444444444444444444" as `0x${string}`;

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: providerAddr, name: "NodeY" },
            },
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 402n,
                seriesId: 1n,
                buyer: buyerAddr,
                provider: providerAddr,
                hours_: 5n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
          ],
        },
      },
    });

    const timeoutEvent = {
      contract: "DeliveryEscrow" as const,
      event: "TimeoutClaimed" as const,
      params: {
        deliveryId: 402n,
        toBuyer: 600000000n,
        toProvider: 0n,
      },
    };

    // First timeout
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [timeoutEvent],
        },
      },
    });

    const providerAfterFirst = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(providerAfterFirst?.timeouts).toBe(1);
    expect(providerAfterFirst?.slashedTotal).toBe(600000000n);

    // Replay timeout
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [timeoutEvent],
        },
      },
    });

    const providerAfterReplay = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(providerAfterReplay?.timeouts).toBe(1);
    expect(providerAfterReplay?.slashedTotal).toBe(600000000n);
  });
});
