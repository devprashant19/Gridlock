import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Handling Incomplete Indexed Histories", () => {
  it("indexes a Settled event gracefully even if DeliveryRequested occurred before start block", async () => {
    const testIndexer = createTestIndexer();

    // Directly emit Settled for delivery 901 without prior DeliveryRequested
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 901n,
                verdict: 1n,
                tflopsE2: 8100n,
                toBuyer: 0n,
                toProvider: 500000000n,
              },
            },
          ],
        },
      },
    });

    const delivery = await testIndexer.Delivery.get("901");
    expect(delivery).toBeDefined();
    expect(delivery?.status).toBe("SETTLED");
    expect(delivery?.verdict).toBe(1);
    expect(delivery?.toProvider).toBe(500000000n);
  });

  it("indexes DeliveryRequested gracefully when SeriesCreated occurred before start block", async () => {
    const testIndexer = createTestIndexer();
    const buyer = "0x1212121212121212121212121212121212121212" as `0x${string}`;
    const provider = "0x3434343434343434343434343434343434343434" as `0x${string}`;

    // Request delivery for series 99 without prior SeriesCreated
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 902n,
                seriesId: 99n,
                buyer: buyer,
                provider: provider,
                hours_: 5n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
          ],
        },
      },
    });

    const delivery = await testIndexer.Delivery.get("902");
    expect(delivery).toBeDefined();
    expect(delivery?.series_id).toBe("99");

    const series = await testIndexer.Series.get("99");
    expect(series).toBeDefined();
    expect(series?.symbol).toBe("Series-99");
  });
});
