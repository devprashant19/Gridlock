import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Delivery History Query Logic", () => {
  it("queries delivery by ID and filters by buyer accurately", async () => {
    const testIndexer = createTestIndexer();
    const buyer1 = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const buyer2 = "0x2222222222222222222222222222222222222222" as `0x${string}`;
    const provider = "0x3333333333333333333333333333333333333333" as `0x${string}`;

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 1101n,
                seriesId: 1n,
                buyer: buyer1,
                provider: provider,
                hours_: 10n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 1102n,
                seriesId: 1n,
                buyer: buyer2,
                provider: provider,
                hours_: 20n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
          ],
        },
      },
    });

    const d1 = await testIndexer.Delivery.get("1101");
    expect(d1?.buyer).toBe(buyer1.toLowerCase());
    expect(d1?.hours).toBe(10n);

    const d2 = await testIndexer.Delivery.get("1102");
    expect(d2?.buyer).toBe(buyer2.toLowerCase());
    expect(d2?.hours).toBe(20n);
  });
});
