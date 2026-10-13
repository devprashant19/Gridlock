import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Delivery Lifecycle Data Modeling", () => {
  it("tracks delivery entity state mutations across REQUESTED -> PROVISIONED -> SETTLED", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const buyerAddr = "0x2222222222222222222222222222222222222222" as `0x${string}`;

    // 1. REQUESTED
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 601n,
                seriesId: 1n,
                buyer: buyerAddr,
                provider: providerAddr,
                hours_: 12n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
          ],
        },
      },
    });

    let d = await testIndexer.Delivery.get("601");
    expect(d?.status).toBe("REQUESTED");
    expect(d?.verdict).toBeUndefined();

    // 2. PROVISIONED
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Provisioned",
              params: {
                deliveryId: 601n,
                ciphertext: "0x01beef",
              },
            },
          ],
        },
      },
    });

    d = await testIndexer.Delivery.get("601");
    expect(d?.status).toBe("PROVISIONED");
    expect(d?.verdict).toBeUndefined();

    // 3. SETTLED
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Settled",
              params: {
                deliveryId: 601n,
                verdict: 1n,
                tflopsE2: 8300n,
                toBuyer: 0n,
                toProvider: 1440000000n,
              },
            },
          ],
        },
      },
    });

    d = await testIndexer.Delivery.get("601");
    expect(d?.status).toBe("SETTLED");
    expect(d?.verdict).toBe(1);
    expect(d?.tflopsE2).toBe(8300);
    expect(d?.toProvider).toBe(1440000000n);
    expect(d?.toBuyer).toBe(0n);
  });
});
