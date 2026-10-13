import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Settlement Records Modeling", () => {
  it("preserves exact on-chain bond distributions and verdict codes", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const buyerAddr = "0x2222222222222222222222222222222222222222" as `0x${string}`;

    // Setup 3 deliveries
    const deliveries = [
      { id: 701n, verdict: 1n, tflops: 8400n, toBuyer: 0n, toProvider: 1000000000n },
      { id: 702n, verdict: 2n, tflops: 5600n, toBuyer: 300000000n, toProvider: 700000000n },
      { id: 703n, verdict: 3n, tflops: 1500n, toBuyer: 1000000000n, toProvider: 0n },
    ];

    for (const d of deliveries) {
      await testIndexer.process({
        chains: {
          10143: {
            simulate: [
              {
                contract: "DeliveryEscrow",
                event: "DeliveryRequested",
                params: {
                  deliveryId: d.id,
                  seriesId: 1n,
                  buyer: buyerAddr,
                  provider: providerAddr,
                  hours_: 10n,
                  buyerEncPubKey: "0xabcdef",
                  deadline: 1729476000n,
                },
              },
              {
                contract: "DeliveryEscrow",
                event: "Settled",
                params: {
                  deliveryId: d.id,
                  verdict: d.verdict,
                  tflopsE2: d.tflops,
                  toBuyer: d.toBuyer,
                  toProvider: d.toProvider,
                },
              },
            ],
          },
        },
      });
    }

    const r1 = await testIndexer.Delivery.get("701");
    expect(r1?.verdict).toBe(1);
    expect(r1?.tflopsE2).toBe(8400);
    expect(r1?.toBuyer).toBe(0n);
    expect(r1?.toProvider).toBe(1000000000n);

    const r2 = await testIndexer.Delivery.get("702");
    expect(r2?.verdict).toBe(2);
    expect(r2?.tflopsE2).toBe(5600);
    expect(r2?.toBuyer).toBe(300000000n);
    expect(r2?.toProvider).toBe(700000000n);

    const r3 = await testIndexer.Delivery.get("703");
    expect(r3?.verdict).toBe(3);
    expect(r3?.tflopsE2).toBe(1500);
    expect(r3?.toBuyer).toBe(1000000000n);
    expect(r3?.toProvider).toBe(0n);
  });
});
