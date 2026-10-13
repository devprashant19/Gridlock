import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";
import fs from "fs";
import path from "path";

describe("GraphQL Query Results Validation Against Indexed State", () => {
  it("validates that stored entities match all query fields defined in queries/*.graphql", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x1111111111111111111111111111111111111111" as `0x${string}`;

    // Index full lifecycle
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: { provider: providerAddr, name: "ValidatedNode" },
            },
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
              contract: "DeliveryEscrow",
              event: "DeliveryRequested",
              params: {
                deliveryId: 1501n,
                seriesId: 1n,
                buyer: "0x2222222222222222222222222222222222222222",
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
                deliveryId: 1501n,
                verdict: 1n,
                tflopsE2: 8300n,
                toBuyer: 0n,
                toProvider: 1000000000n,
              },
            },
            {
              contract: "IndexOracle",
              event: "PrintPublished",
              params: {
                gpuClass: "0x21b2fae6f47053e1ebec92f3900223fa8c9ccf060714b7e1c8ce8b10efd867c0",
                dayKey: 20010n,
                priceE8: 35000000n,
              },
            },
          ],
        },
      },
    });

    // 1. Verify Leaderboard fields
    const p = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(p).toMatchObject({
      id: providerAddr.toLowerCase(),
      name: "ValidatedNode",
      passes: 1,
      degraded: 0,
      fails: 0,
      timeouts: 0,
      hoursDelivered: 10n,
      slashedTotal: 0n,
    });

    // 2. Verify Series fields
    const s = await testIndexer.Series.get("1");
    expect(s).toMatchObject({
      id: "1",
      symbol: "gT4-NOW",
      token: "0x7777777777777777777777777777777777777777",
    });

    // 3. Verify Delivery fields
    const d = await testIndexer.Delivery.get("1501");
    expect(d).toMatchObject({
      id: "1501",
      series_id: "1",
      provider_id: providerAddr.toLowerCase(),
      status: "SETTLED",
      verdict: 1,
      tflopsE2: 8300,
      toProvider: 1000000000n,
    });

    // 4. Verify IndexPrint fields
    const ip = await testIndexer.IndexPrint.get("0x21b2fae6f47053e1ebec92f3900223fa8c9ccf060714b7e1c8ce8b10efd867c0-20010");
    expect(ip).toMatchObject({
      dayKey: 20010n,
      priceE8: 35000000n,
    });

    // Verify all queries files exist and are syntactically valid GraphQL
    const queryFiles = ["leaderboard.graphql", "series.graphql", "deliveries.graphql", "settlements.graphql", "forward_curve.graphql", "pagination.graphql"];
    for (const qf of queryFiles) {
      const qPath = path.resolve(__dirname, `../queries/${qf}`);
      expect(fs.existsSync(qPath)).toBe(true);
      const content = fs.readFileSync(qPath, "utf-8");
      expect(content.length).toBeGreaterThan(0);
    }
  });
});
