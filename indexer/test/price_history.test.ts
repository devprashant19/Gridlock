import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("GPU Index Price History Modeling", () => {
  it("indexes PrintPublished events with exact integer precision and stable composite ID", async () => {
    const testIndexer = createTestIndexer();
    const gpuClass = "0x60956bca9283f6f9cbe0d3ff7174e9b72ecda0ffbf96f3cf0f2bf29a65721118"; // H100 SXM
    const dayKey = 20008n;
    const priceE8 = 245000000n; // $2.45 per GPU-hour in 8 decimals

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "IndexOracle",
              event: "PrintPublished",
              params: {
                gpuClass,
                dayKey,
                priceE8,
              },
            },
          ],
        },
      },
    });

    const expectedId = `${gpuClass}-${dayKey}`;
    const print = await testIndexer.IndexPrint.get(expectedId);

    expect(print).toBeDefined();
    expect(print?.id).toBe(expectedId);
    expect(print?.gpuClass).toBe(gpuClass);
    expect(print?.dayKey).toBe(dayKey);
    expect(print?.priceE8).toBe(priceE8);

    // Verify USD conversion boundary
    const priceUsd = Number(print?.priceE8) / 1e8;
    expect(priceUsd).toBe(2.45);
  });
});
