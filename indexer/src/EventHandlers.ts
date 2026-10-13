import { indexer } from "envio";

// ProviderRegistered handler
indexer.onEvent(
  { contract: "DeliveryEscrow", event: "ProviderRegistered" },
  async ({ event, context }) => {
    const providerId = event.params.provider.toLowerCase();
    const existing = await context.Provider.get(providerId);
    if (existing) {
      context.Provider.set({
        ...existing,
        name: event.params.name,
      });
    } else {
      context.Provider.set({
        id: providerId,
        name: event.params.name,
        minted: 0n,
        passes: 0,
        degraded: 0,
        fails: 0,
        timeouts: 0,
        hoursDelivered: 0n,
        slashedTotal: 0n,
      });
    }
  }
);

// SeriesCreated handler
indexer.onEvent(
  { contract: "SeriesFactory", event: "SeriesCreated" },
  async ({ event, context }) => {
    const seriesId = event.params.seriesId.toString();
    const existing = await context.Series.get(seriesId);
    if (!existing) {
      context.Series.set({
        id: seriesId,
        symbol: event.params.symbol,
        gpuClass: event.params.gpuClass,
        token: event.params.token.toLowerCase(),
        market: undefined,
        lastPrice: undefined,
        openHours: 0n,
      });
    } else {
      context.Series.set({
        ...existing,
        symbol: event.params.symbol,
        gpuClass: event.params.gpuClass,
        token: event.params.token.toLowerCase(),
      });
    }
  }
);

