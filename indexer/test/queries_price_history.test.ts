import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("Forward Curve & Price History Query Logic", () => {
  it("queries chronological price publications filtered by GPU class", async () => {
    const testIndexer = createTestIndexer();
    const t4Class = "0x21b2fae6f47053e1ebec92f3900223fa8c9ccf060714b7e1c8ce8b10efd867c0";
    const h100Class = "0x60956bca9283f6f9cbe0d3ff7174e9b72ecda0ffbf96f3cf0f2bf29a65721118";

    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            { contract: "IndexOracle", event: "PrintPublished", params: { gpuClass: t4Class, dayKey: 20001n, priceE8: 35000000n } },
            { contract: "IndexOracle", event: "PrintPublished", params: { gpuClass: t4Class, dayKey: 20002n, priceE8: 36000000n } },
            { contract: "IndexOracle", event: "PrintPublished", params: { gpuClass: h100Class, dayKey: 20001n, priceE8: 245000000n } },
          ],
        },
      },
    });

    const p1 = await testIndexer.IndexPrint.get(`${t4Class}-20001`);
    const p2 = await testIndexer.IndexPrint.get(`${t4Class}-20002`);
    const pH = await testIndexer.IndexPrint.get(`${h100Class}-20001`);

    expect(p1?.priceE8).toBe(35000000n);
    expect(p2?.priceE8).toBe(36000000n);
    expect(pH?.priceE8).toBe(245000000n);
  });
});
