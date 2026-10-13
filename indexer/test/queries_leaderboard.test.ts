import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Provider Leaderboard Query Logic", () => {
  it("sorts providers accurately with fewest fails first and highest passes breaking ties", async () => {
    const testIndexer = createTestIndexer();

    // Provider A: 24 passes, 0 fails
    const pA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;
    // Provider B: 12 passes, 1 fail
    const pB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`;
    // Provider C: 2 passes, 4 fails
    const pC = "0xcccccccccccccccccccccccccccccccccccccccc" as `0x${string}`;
    // Provider D: 19 passes, 0 fails
    const pD = "0xdddddddddddddddddddddddddddddddddddddddd" as `0x${string}`;

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            { contract: "DeliveryEscrow", event: "ProviderRegistered", params: { provider: pA, name: "HyperNode" } },
            { contract: "DeliveryEscrow", event: "ProviderRegistered", params: { provider: pB, name: "FastCloud" } },
            { contract: "DeliveryEscrow", event: "ProviderRegistered", params: { provider: pC, name: "RogueCompute" } },
            { contract: "DeliveryEscrow", event: "ProviderRegistered", params: { provider: pD, name: "MonadGPU" } },
          ],
        },
      },
    });

    // Populate stats
    testIndexer.Provider.set({ ...(await testIndexer.Provider.getOrThrow(pA.toLowerCase())), passes: 24, fails: 0, hoursDelivered: 142n });
    testIndexer.Provider.set({ ...(await testIndexer.Provider.getOrThrow(pB.toLowerCase())), passes: 12, fails: 1, hoursDelivered: 58n, slashedTotal: 4200000n });
    testIndexer.Provider.set({ ...(await testIndexer.Provider.getOrThrow(pC.toLowerCase())), passes: 2, fails: 4, hoursDelivered: 14n, slashedTotal: 16800000n });
    testIndexer.Provider.set({ ...(await testIndexer.Provider.getOrThrow(pD.toLowerCase())), passes: 19, fails: 0, hoursDelivered: 96n });

    const all = [
      await testIndexer.Provider.getOrThrow(pA.toLowerCase()),
      await testIndexer.Provider.getOrThrow(pB.toLowerCase()),
      await testIndexer.Provider.getOrThrow(pC.toLowerCase()),
      await testIndexer.Provider.getOrThrow(pD.toLowerCase()),
    ];

    // Simulate GraphQL order_by: { fails: asc, passes: desc }
    const sorted = all.sort((a, b) => {
      if (a.fails !== b.fails) return a.fails - b.fails;
      return b.passes - a.passes;
    });

    expect(sorted[0].name).toBe("HyperNode"); // 0 fails, 24 passes
    expect(sorted[1].name).toBe("MonadGPU");  // 0 fails, 19 passes
    expect(sorted[2].name).toBe("FastCloud"); // 1 fail, 12 passes
    expect(sorted[3].name).toBe("RogueCompute"); // 4 fails, 2 passes
  });
});
