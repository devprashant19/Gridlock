import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("GPU Series and Token Entities", () => {
  it("preserves distinct series IDs and token addresses for the same GPU class", async () => {
    const testIndexer = createTestIndexer();
    const h100Class = "0x60956bca9283f6f9cbe0d3ff7174e9b72ecda0ffbf96f3cf0f2bf29a65721118";
    const tokenW43 = "0x9999999999999999999999999999999999999999" as `0x${string}`;
    const tokenW44 = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as `0x${string}`;

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "SeriesFactory",
              event: "SeriesCreated",
              params: {
                seriesId: 2n,
                gpuClass: h100Class,
                token: tokenW43,
                windowStart: 1729468800n,
                windowEnd: 1730073600n,
                symbol: "gH100-W43",
              },
            },
            {
              contract: "SeriesFactory",
              event: "SeriesCreated",
              params: {
                seriesId: 3n,
                gpuClass: h100Class,
                token: tokenW44,
                windowStart: 1730073600n,
                windowEnd: 1730678400n,
                symbol: "gH100-W44",
              },
            },
          ],
        },
      },
    });

    const s2 = await testIndexer.Series.get("2");
    const s3 = await testIndexer.Series.get("3");

    expect(s2?.gpuClass).toBe(h100Class);
    expect(s3?.gpuClass).toBe(h100Class);
    expect(s2?.symbol).toBe("gH100-W43");
    expect(s3?.symbol).toBe("gH100-W44");
    expect(s2?.token).toBe(tokenW43.toLowerCase());
    expect(s3?.token).toBe(tokenW44.toLowerCase());
    expect(s2?.token).not.toBe(s3?.token);
    expect(s2?.id).not.toBe(s3?.id);
  });
});
