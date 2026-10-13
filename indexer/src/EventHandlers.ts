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

// Minted handler
indexer.onEvent(
  { contract: "DeliveryEscrow", event: "Minted" },
  async ({ event, context }) => {
    const providerId = event.params.provider.toLowerCase();
    const seriesId = event.params.seriesId.toString();

    // 1. Update Provider minted hours
    const provider = await context.Provider.get(providerId);
    if (provider) {
      context.Provider.set({
        ...provider,
        minted: provider.minted + event.params.hours_,
      });
    } else {
      context.Provider.set({
        id: providerId,
        name: `Provider-${providerId.slice(0, 6)}`,
        minted: event.params.hours_,
        passes: 0,
        degraded: 0,
        fails: 0,
        timeouts: 0,
        hoursDelivered: 0n,
        slashedTotal: 0n,
      });
    }

    // 2. Update Series open hours
    const series = await context.Series.get(seriesId);
    if (series) {
      context.Series.set({
        ...series,
        openHours: series.openHours + event.params.hours_,
      });
    }
  }
);

// DeliveryRequested handler
indexer.onEvent(
  { contract: "DeliveryEscrow", event: "DeliveryRequested" },
  async ({ event, context }) => {
    const deliveryId = event.params.deliveryId.toString();
    const seriesId = event.params.seriesId.toString();
    const buyer = event.params.buyer.toLowerCase();
    const providerId = event.params.provider.toLowerCase();

    // Ensure provider entity exists if assigned
    const provider = await context.Provider.get(providerId);
    if (!provider) {
      context.Provider.set({
        id: providerId,
        name: `Provider-${providerId.slice(0, 6)}`,
        minted: 0n,
        passes: 0,
        degraded: 0,
        fails: 0,
        timeouts: 0,
        hoursDelivered: 0n,
        slashedTotal: 0n,
      });
    }

    // Create delivery record
    context.Delivery.set({
      id: deliveryId,
      series_id: seriesId,
      buyer: buyer,
      provider_id: providerId,
      hours: event.params.hours_,
      status: "REQUESTED",
      verdict: undefined,
      tflopsE2: undefined,
      toBuyer: undefined,
      toProvider: undefined,
    });
  }
);

// Provisioned handler
indexer.onEvent(
  { contract: "DeliveryEscrow", event: "Provisioned" },
  async ({ event, context }) => {
    const deliveryId = event.params.deliveryId.toString();
    const delivery = await context.Delivery.get(deliveryId);
    if (delivery && delivery.status === "REQUESTED") {
      context.Delivery.set({
        ...delivery,
        status: "PROVISIONED",
      });
    }
  }
);

// Settled handler
indexer.onEvent(
  { contract: "DeliveryEscrow", event: "Settled" },
  async ({ event, context }) => {
    const deliveryId = event.params.deliveryId.toString();
    const verdict = Number(event.params.verdict);
    const tflopsE2 = Number(event.params.tflopsE2);
    const toBuyer = event.params.toBuyer;
    const toProvider = event.params.toProvider;

    const delivery = await context.Delivery.get(deliveryId);
    if (delivery) {
      if (delivery.status === "SETTLED") {
        // Idempotency: delivery has already been settled, do not re-increment provider stats
        return;
      }

      context.Delivery.set({
        ...delivery,
        status: "SETTLED",
        verdict: verdict,
        tflopsE2: tflopsE2,
        toBuyer: toBuyer,
        toProvider: toProvider,
      });

      // Update provider stats
      const provider = await context.Provider.get(delivery.provider_id);
      if (provider) {
        let passes = provider.passes;
        let degraded = provider.degraded;
        let fails = provider.fails;
        let hoursDelivered = provider.hoursDelivered;
        let slashedTotal = provider.slashedTotal;

        if (verdict === 1) {
          passes += 1;
          hoursDelivered += delivery.hours;
        } else if (verdict === 2) {
          degraded += 1;
          hoursDelivered += delivery.hours;
          slashedTotal += toBuyer;
        } else if (verdict === 3) {
          fails += 1;
          slashedTotal += toBuyer;
        }

        context.Provider.set({
          ...provider,
          passes,
          degraded,
          fails,
          hoursDelivered,
          slashedTotal,
        });
      }
    }
  }
);

// TimeoutClaimed handler
indexer.onEvent(
  { contract: "DeliveryEscrow", event: "TimeoutClaimed" },
  async ({ event, context }) => {
    const deliveryId = event.params.deliveryId.toString();
    const toBuyer = event.params.toBuyer;
    const toProvider = event.params.toProvider;

    const delivery = await context.Delivery.get(deliveryId);
    if (delivery) {
      if (delivery.status === "TIMEOUT") {
        // Idempotency: timeout already claimed, do not re-increment provider timeouts
        return;
      }

      context.Delivery.set({
        ...delivery,
        status: "TIMEOUT",
        toBuyer: toBuyer,
        toProvider: toProvider,
      });

      const provider = await context.Provider.get(delivery.provider_id);
      if (provider) {
        context.Provider.set({
          ...provider,
          timeouts: provider.timeouts + 1,
          slashedTotal: provider.slashedTotal + toBuyer,
        });
      }
    }
  }
);


// PrintPublished handler
indexer.onEvent(
  { contract: "IndexOracle", event: "PrintPublished" },
  async ({ event, context }) => {
    const id = `${event.params.gpuClass}-${event.params.dayKey.toString()}`;
    context.IndexPrint.set({
      id: id,
      gpuClass: event.params.gpuClass,
      dayKey: event.params.dayKey,
      priceE8: BigInt(event.params.priceE8),
    });
  }
);





