import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Entity Relationships", () => {
  it("links deliveries accurately to series and providers without dangling references", async () => {
    const testIndexer = createTestIndexer();
    const provider1 = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const provider2 = "0x2222222222222222222222222222222222222222" as `0x${string}`;
    const buyer = "0x3333333333333333333333333333333333333333" as `0x${string}`;

    // Setup Series 1 & 2, Provider 1 & 2
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
            {
              contract: "SeriesFactory",
              event: "SeriesCreated",
              params: {
                seriesId: 2n,
                gpuClass: "0x60956bca9283f6f9cbe0d3ff7174e9b72ecda0ffbf96f3cf0f2bf29a65721118",
                token: "0x9999999999999999999999999999999999999999",
                windowStart: 1729468800n,
                windowEnd: 1730073600n,
                symbol: "gH100-W43",
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: provider1, name: "Node-1" },
            },
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: provider2, name: "Node-2" },
            },
            // Delivery 801 in Series 1 assigned to Provider 1
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 801n,
                seriesId: 1n,
                buyer: buyer,
                provider: provider1,
                hours_: 10n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
            // Delivery 802 in Series 2 assigned to Provider 2
            {
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 802n,
                seriesId: 2n,
                buyer: buyer,
                provider: provider2,
                hours_: 20n,
                buyerEncPubKey: "0xabcdef",
                deadline: 1729476000n,
              },
            },
          ],
        },
      },
    });

    const d1 = await testIndexer.Delivery.get("801");
    const d2 = await testIndexer.Delivery.get("802");

    // Verify foreign key integrity
    const s1 = await testIndexer.Series.get(d1!.series_id);
    const p1 = await testIndexer.Provider.get(d1!.provider_id);
    expect(s1?.symbol).toBe("gT4-NOW");
    expect(p1?.name).toBe("Node-1");

    const s2 = await testIndexer.Series.get(d2!.series_id);
    const p2 = await testIndexer.Provider.get(d2!.provider_id);
    expect(s2?.symbol).toBe("gH100-W43");
    expect(p2?.name).toBe("Node-2");
  });
});
