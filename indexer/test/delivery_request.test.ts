import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Delivery Request Indexing", () => {
  it("indexes a new delivery request and links buyer and provider", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const buyerAddr = "0x2222222222222222222222222222222222222222" as `0x${string}`;

    // 1. Setup series
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "SeriesFactory",
              event: "SeriesCreated",
              params: {
                seriesId: 1n,
                gpuClass: "0x21b2fae6f47053e1ebec92f3900223fa8c9ccf060714b7e1c8ce8b10efd867c0",
                token: "0x7777777777777777777777777777777777777777",
                windowStart: 1728864000n,
                windowEnd: 1729468800n,
                symbol: "gT4-NOW",
              },
            },
          ],
        },
      },
    });

    // 2. Request delivery
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 101n,
                seriesId: 1n,
                buyer: buyerAddr,
                provider: providerAddr,
                hours_: 10n,
                buyerEncPubKey: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                deadline: 1729476000n,
              },
            },
          ],
        },
      },
    });

    const delivery = await testIndexer.Delivery.get("101");
    expect(delivery).toBeDefined();
    expect(delivery?.series_id).toBe("1");
    expect(delivery?.buyer).toBe(buyerAddr.toLowerCase());
    expect(delivery?.provider_id).toBe(providerAddr.toLowerCase());
    expect(delivery?.hours).toBe(10n);
    expect(delivery?.status).toBe("REQUESTED");
    expect(delivery?.verdict).toBeUndefined();
  });
});
