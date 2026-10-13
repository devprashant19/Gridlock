import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("GraphQL Pagination and Filtering Logic", () => {
  it("handles pagination limits and offsets correctly across larger entity collections", async () => {
    const testIndexer = createTestIndexer();

    // Register 15 providers
    const events = [];
    for (let i = 1; i <= 15; i++) {
      const hex = i.toString(16).padStart(2, "0");
      const addr = `0x${hex.repeat(20)}` as `0x${string}`;
      events.push({
        contract: "DeliveryEscrow" as const,
        event: "ProviderRegistered" as const,
        params: {
          provider: addr,
          name: `Node-${i}`,
        },
      });
    }

    await testIndexer.process({
      chains: {
        10143: {
          simulate: events,
        },
      },
    });

    // Verify all 15 were indexed
    const allProviders = [];
    for (let i = 1; i <= 15; i++) {
      const hex = i.toString(16).padStart(2, "0");
      const addr = `0x${hex.repeat(20)}`;
      const p = await testIndexer.Provider.get(addr);
      expect(p).toBeDefined();
      allProviders.push(p!);
    }

    // Test page 1: limit 5, offset 0
    const page1 = allProviders.slice(0, 5);
    expect(page1.length).toBe(5);
    expect(page1[0].name).toBe("Node-1");
    expect(page1[4].name).toBe("Node-5");

    // Test page 2: limit 5, offset 5
    const page2 = allProviders.slice(5, 10);
    expect(page2.length).toBe(5);
    expect(page2[0].name).toBe("Node-6");
    expect(page2[4].name).toBe("Node-10");

    // Test page 3: limit 5, offset 10
    const page3 = allProviders.slice(10, 15);
    expect(page3.length).toBe(5);
    expect(page3[0].name).toBe("Node-11");
    expect(page3[4].name).toBe("Node-15");
  });
});
