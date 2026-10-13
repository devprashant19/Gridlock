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
