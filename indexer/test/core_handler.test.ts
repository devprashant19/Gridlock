import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Core Contract Event Handler - ProviderRegistered", () => {
  it("indexes a new provider registration correctly", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x1234567890123456789012345678901234567890" as `0x${string}`;

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: {
                provider: providerAddr,
                name: "HyperNode-Bangalore",
              },
            },
          ],
        },
      },
    });

    const provider = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(provider).toBeDefined();
    expect(provider?.name).toBe("HyperNode-Bangalore");
    expect(provider?.minted).toBe(0n);
    expect(provider?.passes).toBe(0);
    expect(provider?.degraded).toBe(0);
    expect(provider?.fails).toBe(0);
    expect(provider?.timeouts).toBe(0);
    expect(provider?.hoursDelivered).toBe(0n);
    expect(provider?.slashedTotal).toBe(0n);
  });
});
