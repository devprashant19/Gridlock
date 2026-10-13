import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Provisioning Indexing", () => {
  it("transitions delivery status from REQUESTED to PROVISIONED", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const buyerAddr = "0x2222222222222222222222222222222222222222" as `0x${string}`;

    // 1. Request delivery
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 201n,
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

    const initial = await testIndexer.Delivery.get("201");
    expect(initial?.status).toBe("REQUESTED");

    // 2. Provision delivery
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Provisioned",
              params: {
                deliveryId: 201n,
                ciphertext: "0x01feedfacecafe",
              },
            },
          ],
        },
      },
    });

    const provisioned = await testIndexer.Delivery.get("201");
    expect(provisioned?.status).toBe("PROVISIONED");
  });
});
