import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Settlement History Query Logic", () => {
  it("filters settlements by terminal status and verdict codes", async () => {
    const testIndexer = createTestIndexer();

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 1201n,
                verdict: 1n,
                tflopsE2: 8300n,
                toBuyer: 0n,
                toProvider: 1000000000n,
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 1202n,
                verdict: 3n,
                tflopsE2: 1200n,
                toBuyer: 1000000000n,
                toProvider: 0n,
              },
            },
          ],
        },
      },
    });

    const d1 = await testIndexer.Delivery.get("1201");
    expect(d1?.status).toBe("SETTLED");
    expect(d1?.verdict).toBe(1);

    const d2 = await testIndexer.Delivery.get("1202");
    expect(d2?.status).toBe("SETTLED");
    expect(d2?.verdict).toBe(3);
  });
});
