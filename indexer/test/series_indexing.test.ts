import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("GPU Series Indexing", () => {
  it("indexes a new series created by SeriesFactory", async () => {
    const testIndexer = createTestIndexer();
    const tokenAddr = "0x7777777777777777777777777777777777777777" as `0x${string}`;
    const gpuClass = "0x21b2fae6f47053e1ebec92f3900223fa8c9ccf060714b7e1c8ce8b10efd867c0";

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "SeriesFactory",
              event: "SeriesCreated",
              params: {
                seriesId: 1n,
                gpuClass,
                token: tokenAddr,
                windowStart: 1728864000n,
                windowEnd: 1729468800n,
                symbol: "gT4-NOW",
              },
            },
          ],
        },
      },
    });

    const series = await testIndexer.Series.get("1");
    expect(series).toBeDefined();
    expect(series?.symbol).toBe("gT4-NOW");
    expect(series?.gpuClass).toBe(gpuClass);
    expect(series?.token).toBe(tokenAddr.toLowerCase());
    expect(series?.openHours).toBe(0n);
  });
});
