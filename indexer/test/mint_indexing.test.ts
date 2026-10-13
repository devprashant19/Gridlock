import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("GPU Hour Mint Activity Indexing", () => {
  it("indexes minted hours to provider and updates series openHours", async () => {
    const testIndexer = createTestIndexer();
    const providerAddr = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const tokenAddr = "0x7777777777777777777777777777777777777777" as `0x${string}`;

    // 1. Create series and register provider
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
                token: tokenAddr,
                windowStart: 1728864000n,
                windowEnd: 1729468800n,
                symbol: "gT4-NOW",
              },
            },
            {
              contract: "DeliveryEscrow",
              event: "ProviderRegistered",
              params: {
                provider: providerAddr,
                name: "HyperNode-Bangalore",
              },
            },
          ],
        },
      },
    });

    // 2. Mint 50 hours
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Minted",
              params: {
                seriesId: 1n,
                provider: providerAddr,
                hours_: 50n,
                bond: 6000000000n,
              },
            },
          ],
        },
      },
    });

    const provider = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(provider?.minted).toBe(50n);

    const series = await testIndexer.Series.get("1");
    expect(series?.openHours).toBe(50n);

    // 3. Mint additional 25 hours
    await testIndexer.process({
      chains: {
        10143: {
          simulate: [
            {
              contract: "DeliveryEscrow",
              event: "Minted",
              params: {
                seriesId: 1n,
                provider: providerAddr,
                hours_: 25n,
                bond: 3000000000n,
              },
            },
          ],
        },
      },
    });

    const updatedProvider = await testIndexer.Provider.get(providerAddr.toLowerCase());
    expect(updatedProvider?.minted).toBe(75n);

    const updatedSeries = await testIndexer.Series.get("1");
    expect(updatedSeries?.openHours).toBe(75n);
  });
});
