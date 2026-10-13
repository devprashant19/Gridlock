import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Provider Registration Indexing", () => {
  it("creates a provider with stable lowercase ID", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12" as `0x${string}`;

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: {
                provider: providerAddr,
                name: "MonadGPU-Alpha",
              },
            },
          ],
        },
      },
    });

    const provider = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(provider).toBeDefined();
    expect(provider?.id).toBe(providerAddr.toLowerCase());
    expect(provider?.name).toBe("MonadGPU-Alpha");
  });

  it("handles duplicate or updated registration idempotently without wiping counters", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12" as `0x${string}`;

    // First registration
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: {
                provider: providerAddr,
                name: "Initial-Name",
              },
            },
          ],
        },
      },
    });

    // Manually simulate existing state (e.g. counters accumulated)
    const existing = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(existing).toBeDefined();
    if (existing) {
      testIndexer.Provider.set({
        ...existing,
        passes: 5,
        hoursDelivered: 50n,
      });
    }

    // Replay or update registration
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: {
                provider: providerAddr,
                name: "Updated-Name",
              },
            },
          ],
        },
      },
    });

    const updated = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(updated?.name).toBe("Updated-Name");
    expect(updated?.passes).toBe(5);
    expect(updated?.hoursDelivered).toBe(50n);
  });
});
