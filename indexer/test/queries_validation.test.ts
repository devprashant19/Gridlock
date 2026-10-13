import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("GraphQL Query Validation & Boundary Edge Cases", () => {
  it("handles unknown IDs and empty entities gracefully without throwing", async () => {
    const testIndexer = createTestIndexer();

    // Query non-existent entities
    const nonExistentProvider = await testIndexer.Provider.get("0x000000000000000000000000000000000000dead");
    expect(nonExistentProvider).toBeUndefined();

    const nonExistentDelivery = await testIndexer.Delivery.get("999999");
    expect(nonExistentDelivery).toBeUndefined();

    const nonExistentSeries = await testIndexer.Series.get("999999");
    expect(nonExistentSeries).toBeUndefined();

    const nonExistentPrint = await testIndexer.IndexPrint.get("0x00-0");
    expect(nonExistentPrint).toBeUndefined();
  });

  it("handles mixed filters and boundaries consistently", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x1111111111111111111111111111111111111111" as `0x${string}`;

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: providerAddr, name: "ZeroStatsNode" },
            },
          ],
        },
      },
    });

    const p = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(p).toBeDefined();
    expect(p?.passes).toBe(0);
    expect(p?.fails).toBe(0);
    expect(p?.slashedTotal).toBe(0n);
    expect(p?.hoursDelivered).toBe(0n);
  });
});
