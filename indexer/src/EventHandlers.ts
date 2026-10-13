import { indexer } from "envio";
import { MARKET_TO_SERIES } from "./markets.js";

const ZERO = 0n;

const emptyProvider = (id: string) => ({
  id,
  name: "",
  minted: ZERO,
  bondPosted: ZERO,
  passes: 0,
  degraded: 0,
  fails: 0,
  timeouts: 0,
  hoursDelivered: ZERO,
  slashedTotal: ZERO,
  earnedTotal: ZERO,
});

const emptySeries = (id: string) => ({
  id,
  symbol: `Series-${id}`,
  gpuClass: "unknown",
  token: "0x0000000000000000000000000000000000000000",
  windowStart: ZERO,
  windowEnd: ZERO,
  market: undefined as string | undefined,
  lastPrice: undefined as bigint | undefined,
  lastTradeAt: undefined as bigint | undefined,
  openHours: ZERO,
  mintedHours: ZERO,
  redeemedHours: ZERO,
  tradeCount: 0,
});

const marketForSeries = (seriesId: string): string | undefined =>
  Object.entries(MARKET_TO_SERIES).find(([, s]) => String(s.seriesId) === seriesId)?.[0];

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
        ...emptyProvider(providerId),
        name: event.params.name,
      });
    }
  }
);

// SeriesCreated handler
indexer.onEvent(
  { contract: "SeriesFactory", event: "SeriesCreated" },
  async ({ event, context }) => {
    const seriesId = event.params.seriesId.toString();
    const existing = (await context.Series.get(seriesId)) ?? emptySeries(seriesId);
    context.Series.set({
      ...existing,
      symbol: event.params.symbol,
      gpuClass: event.params.gpuClass,
      token: event.params.token.toLowerCase(),
      windowStart: BigInt(event.params.windowStart),
      windowEnd: BigInt(event.params.windowEnd),
      market: existing.market ?? marketForSeries(seriesId),
    });
  }
);

// Minted handler
indexer.onEvent(
  { contract: "DeliveryEscrow", event: "Minted" },
  async ({ event, context }) => {
    const providerId = event.params.provider.toLowerCase();
    const seriesId = event.params.seriesId.toString();
    const hours = BigInt(event.params.hours_);
    const bond = BigInt(event.params.bond);

    // 1. Update Provider minted hours and posted bond
    const provider = (await context.Provider.get(providerId)) ?? emptyProvider(providerId);
    context.Provider.set({
      ...provider,
      minted: provider.minted + hours,
      bondPosted: provider.bondPosted + bond,
    });

    // 2. Update Series open hours & minted hours
    const series = (await context.Series.get(seriesId)) ?? emptySeries(seriesId);
    context.Series.set({
      ...series,
      openHours: series.openHours + hours,
      mintedHours: series.mintedHours + hours,
    });
  }
);

// DeliveryRequested handler
indexer.onEvent(
  { contract: "DeliveryEscrow", event: "DeliveryRequested" },
  async ({ event, context }) => {
    const deliveryId = event.params.deliveryId.toString();
    const seriesId = event.params.seriesId.toString();
    const providerId = event.params.provider.toLowerCase();
    const hours = BigInt(event.params.hours_);
    const ts = BigInt(event.block?.timestamp ?? 0);
    const txHash = (event as any).transaction?.hash ?? "0x";

    // Reconcile missing provider or series for mid-stream indexing
    if (!(await context.Provider.get(providerId))) {
      context.Provider.set(emptyProvider(providerId));
    }

    const series = (await context.Series.get(seriesId)) ?? emptySeries(seriesId);
    context.Series.set({
      ...series,
      openHours: series.openHours > hours ? series.openHours - hours : ZERO,
      redeemedHours: series.redeemedHours + hours,
    });

    context.Delivery.set({
      id: deliveryId,
      series_id: seriesId,
      buyer: event.params.buyer.toLowerCase(),
      provider_id: providerId,
      hours,
      buyerEncPubKey: event.params.buyerEncPubKey,
      deadline: BigInt(event.params.deadline),
      status: "REQUESTED",
      requestedAt: ts,
      provisionedAt: undefined,
      ciphertext: undefined,
      verdict: undefined,
      tflopsE2: undefined,
      toBuyer: undefined,
      toProvider: undefined,
      settledAt: undefined,
      txHash,
    });
  }
);

// Provisioned handler
indexer.onEvent(
  { contract: "DeliveryEscrow", event: "Provisioned" },
  async ({ event, context }) => {
    const deliveryId = event.params.deliveryId.toString();
    const delivery = await context.Delivery.get(deliveryId);
    const ts = BigInt(event.block?.timestamp ?? 0);

    if (delivery) {
      if (delivery.status === "SETTLED" || delivery.status === "TIMEOUT") {
        return; // idempotency guard
      }
      context.Delivery.set({
        ...delivery,
        status: "PROVISIONED",
        provisionedAt: ts,
        ciphertext: event.params.ciphertext,
      });
    } else {
      context.Delivery.set({
        id: deliveryId,
        series_id: "unknown",
        buyer: "unknown",
        provider_id: "unknown",
        hours: ZERO,
        buyerEncPubKey: "0x",
        deadline: ZERO,
        status: "PROVISIONED",
        requestedAt: ts,
        provisionedAt: ts,
        ciphertext: event.params.ciphertext,
        verdict: undefined,
        tflopsE2: undefined,
        toBuyer: undefined,
        toProvider: undefined,
        settledAt: undefined,
        txHash: (event as any).transaction?.hash ?? "0x",
      });
    }
  }
);

// Settled handler
indexer.onEvent(
  { contract: "DeliveryEscrow", event: "Settled" },
  async ({ event, context }) => {
    const deliveryId = event.params.deliveryId.toString();
    const delivery = await context.Delivery.get(deliveryId);
    const verdict = Number(event.params.verdict);
    const toBuyer = BigInt(event.params.toBuyer);
    const toProvider = BigInt(event.params.toProvider);
    const ts = BigInt(event.block?.timestamp ?? 0);

    if (delivery && (delivery.status === "SETTLED" || delivery.status === "TIMEOUT")) {
      return; // Replay / reorg idempotency protection
    }

    if (delivery) {
      context.Delivery.set({
        ...delivery,
        status: "SETTLED",
        verdict,
        tflopsE2: Number(event.params.tflopsE2),
        toBuyer,
        toProvider,
        settledAt: ts,
      });

      const providerId = delivery.provider_id;
      const provider = (await context.Provider.get(providerId)) ?? emptyProvider(providerId);

      context.Provider.set({
        ...provider,
        passes: provider.passes + (verdict === 1 ? 1 : 0),
        degraded: provider.degraded + (verdict === 2 ? 1 : 0),
        fails: provider.fails + (verdict === 3 ? 1 : 0),
        hoursDelivered: provider.hoursDelivered + (verdict === 3 ? ZERO : delivery.hours),
        slashedTotal: provider.slashedTotal + toBuyer,
        earnedTotal: provider.earnedTotal + toProvider,
      });
    } else {
      context.Delivery.set({
        id: deliveryId,
        series_id: "unknown",
        buyer: "unknown",
        provider_id: "unknown",
        hours: ZERO,
        buyerEncPubKey: "0x",
        deadline: ZERO,
        status: "SETTLED",
        requestedAt: ts,
        provisionedAt: undefined,
        ciphertext: undefined,
        verdict,
        tflopsE2: Number(event.params.tflopsE2),
        toBuyer,
        toProvider,
        settledAt: ts,
        txHash: (event as any).transaction?.hash ?? "0x",
      });
    }
  }
);

// TimeoutClaimed handler
indexer.onEvent(
  { contract: "DeliveryEscrow", event: "TimeoutClaimed" },
  async ({ event, context }) => {
    const deliveryId = event.params.deliveryId.toString();
    const delivery = await context.Delivery.get(deliveryId);
    const toBuyer = BigInt(event.params.toBuyer);
    const toProvider = BigInt(event.params.toProvider);
    const ts = BigInt(event.block?.timestamp ?? 0);

    if (delivery && (delivery.status === "SETTLED" || delivery.status === "TIMEOUT")) {
      return; // Replay / reorg protection
    }

    if (delivery) {
      context.Delivery.set({
        ...delivery,
        status: "TIMEOUT",
        toBuyer,
        toProvider,
        settledAt: ts,
      });

      const providerId = delivery.provider_id;
      const provider = (await context.Provider.get(providerId)) ?? emptyProvider(providerId);

      context.Provider.set({
        ...provider,
        timeouts: provider.timeouts + (toBuyer > ZERO ? 1 : 0),
        slashedTotal: provider.slashedTotal + toBuyer,
        earnedTotal: provider.earnedTotal + toProvider,
        hoursDelivered: provider.hoursDelivered + (toProvider > ZERO ? delivery.hours : ZERO),
      });
    } else {
      context.Delivery.set({
        id: deliveryId,
        series_id: "unknown",
        buyer: "unknown",
        provider_id: "unknown",
        hours: ZERO,
        buyerEncPubKey: "0x",
        deadline: ZERO,
        status: "TIMEOUT",
        requestedAt: ts,
        provisionedAt: undefined,
        ciphertext: undefined,
        verdict: undefined,
        tflopsE2: undefined,
        toBuyer,
        toProvider,
        settledAt: ts,
        txHash: (event as any).transaction?.hash ?? "0x",
      });
    }
  }
);

// PrintPublished handler
indexer.onEvent(
  { contract: "IndexOracle", event: "PrintPublished" },
  async ({ event, context }) => {
    const { gpuClass, dayKey, priceE8 } = event.params;
    const printId = `${gpuClass}-${dayKey}`;
    const ts = BigInt(event.block?.timestamp ?? 0);

    context.IndexPrint.set({
      id: printId,
      gpuClass,
      dayKey: BigInt(dayKey),
      priceE8: BigInt(priceE8),
      timestamp: ts,
    });

    const cls = await context.GpuClass.get(gpuClass);
    context.GpuClass.set({
      id: gpuClass,
      latestPriceE8: BigInt(priceE8),
      latestDayKey: BigInt(dayKey),
      printCount: (cls?.printCount ?? 0) + 1,
    });
  }
);

// KuruOrderBook Trade handler
indexer.onEvent(
  { contract: "KuruOrderBook", event: "Trade" },
  async ({ event, context }) => {
    const market = (event as any).srcAddress?.toLowerCase() ?? "0x";
    const mapped = MARKET_TO_SERIES[market];
    const seriesId = mapped ? String(mapped.seriesId) : undefined;
    const ts = BigInt(event.block?.timestamp ?? 0);
    const txHash = (event as any).transaction?.hash ?? "0x";

    context.Trade.set({
      id: `${event.chainId}-${(event as any).block?.number ?? 0}-${event.logIndex}`,
      market,
      series_id: seriesId,
      orderId: BigInt(event.params.orderId),
      isBuy: event.params.isBuy,
      maker: event.params.makerAddress.toLowerCase(),
      taker: event.params.takerAddress.toLowerCase(),
      price: BigInt(event.params.price),
      size: BigInt(event.params.filledSize),
      timestamp: ts,
      txHash,
    });

    if (!seriesId) return;
    const s = (await context.Series.get(seriesId)) ?? emptySeries(seriesId);
    context.Series.set({
      ...s,
      market,
      lastPrice: BigInt(event.params.price),
      lastTradeAt: ts,
      tradeCount: s.tradeCount + 1,
    });
  }
);
