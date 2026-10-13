import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("GPU Series Query Logic", () => {
  it("queries series metadata with exact token addresses and open capacity", async () => {
    const testIndexer = createTestIndexer();

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
              contract: "DeliveryEscrow",
              event: "Minted",
              params: {
                seriesId: 1n,
                provider: "0x1111111111111111111111111111111111111111",
                hours_: 60n,
                bond: 7200000000n,
              },
            },
          ],
        },
      },
    });

    const series = await testIndexer.Series.get("1");
    expect(series).toBeDefined();
    expect(series?.symbol).toBe("gT4-NOW");
    expect(series?.token).toBe("0x7777777777777777777777777777777777777777");
    expect(series?.openHours).toBe(60n);
  });
});
