// Envio handlers for Gridlock. Feeds the web app's provider leaderboard (/providers)
// and forward curve (/), plus delivery timelines.
import {
  DeliveryEscrow,
  IndexOracle,
  KuruOrderBook,
  SeriesFactory,
  type Provider,
  type Series,
} from "generated";
import { MARKET_TO_SERIES } from "./markets";

const ZERO = 0n;

const emptyProvider = (id: string): Provider => ({
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

// Series normally arrive via SeriesCreated, but a Minted/Trade can be seen first if
// start_block is after the factory deploy. Keep a placeholder so relations still resolve.
const emptySeries = (id: string): Series => ({
  id,
  symbol: "",
  gpuClass: "",
  token: "",
  windowStart: ZERO,
  windowEnd: ZERO,
  market: undefined,
  lastPrice: undefined,
  lastTradeAt: undefined,
  openHours: ZERO,
  mintedHours: ZERO,
  redeemedHours: ZERO,
  tradeCount: 0,
});

const marketForSeries = (seriesId: string): string | undefined =>
  Object.entries(MARKET_TO_SERIES).find(([, s]) => String(s.seriesId) === seriesId)?.[0];

// ---------------------------------------------------------------- SeriesFactory

SeriesFactory.SeriesCreated.handler(async ({ event, context }) => {
  const id = event.params.seriesId.toString();
  const existing = (await context.Series.get(id)) ?? emptySeries(id);
  context.Series.set({
    ...existing,
    symbol: event.params.symbol,
    gpuClass: event.params.gpuClass,
    token: event.params.token.toLowerCase(),
    windowStart: event.params.windowStart,
    windowEnd: event.params.windowEnd,
    market: existing.market ?? marketForSeries(id),
  });
});

// ---------------------------------------------------------------- IndexOracle

IndexOracle.PrintPublished.handler(async ({ event, context }) => {
  const { gpuClass, dayKey, priceE8 } = event.params;
  context.IndexPrint.set({
    id: `${gpuClass}-${dayKey}-${event.logIndex}`,
    gpuClass,
    dayKey,
    priceE8,
    timestamp: BigInt(event.block.timestamp),
  });
  const cls = await context.GpuClass.get(gpuClass);
  context.GpuClass.set({
    id: gpuClass,
    latestPriceE8: priceE8,
    latestDayKey: dayKey,
    printCount: (cls?.printCount ?? 0) + 1,
  });
});

// ---------------------------------------------------------------- DeliveryEscrow

DeliveryEscrow.ProviderRegistered.handler(async ({ event, context }) => {
  const id = event.params.provider.toLowerCase();
  const p = (await context.Provider.get(id)) ?? emptyProvider(id);
  context.Provider.set({ ...p, name: event.params.name });
});

DeliveryEscrow.Minted.handler(async ({ event, context }) => {
  const providerId = event.params.provider.toLowerCase();
  const seriesId = event.params.seriesId.toString();
  const hours = event.params.hours_;

  const p = (await context.Provider.get(providerId)) ?? emptyProvider(providerId);
  context.Provider.set({
    ...p,
    minted: p.minted + hours,
    bondPosted: p.bondPosted + event.params.bond,
  });

  const s = (await context.Series.get(seriesId)) ?? emptySeries(seriesId);
  context.Series.set({
    ...s,
    openHours: s.openHours + hours,
    mintedHours: s.mintedHours + hours,
  });
});

DeliveryEscrow.DeliveryRequested.handler(async ({ event, context }) => {
  const { deliveryId, seriesId, buyer, provider, hours_, buyerEncPubKey, deadline } = event.params;
  const sid = seriesId.toString();
  const providerId = provider.toLowerCase();

  // Make sure relation targets exist even if we missed their creation events.
  if (!(await context.Provider.get(providerId))) context.Provider.set(emptyProvider(providerId));
  const s = (await context.Series.get(sid)) ?? emptySeries(sid);
  context.Series.set({
    ...s,
    openHours: s.openHours > hours_ ? s.openHours - hours_ : ZERO,
    redeemedHours: s.redeemedHours + hours_,
  });

  context.Delivery.set({
    id: deliveryId.toString(),
    series_id: sid,
    buyer: buyer.toLowerCase(),
    provider_id: providerId,
    hours: hours_,
    buyerEncPubKey,
    deadline,
    status: "Requested",
    requestedAt: BigInt(event.block.timestamp),
    provisionedAt: undefined,
    ciphertext: undefined,
    verdict: undefined,
    tflopsE2: undefined,
    toBuyer: undefined,
    toProvider: undefined,
    settledAt: undefined,
    txHash: event.transaction.hash,
  });
});

DeliveryEscrow.Provisioned.handler(async ({ event, context }) => {
  const d = await context.Delivery.get(event.params.deliveryId.toString());
  if (!d) {
    context.log.warn(`Provisioned for unknown delivery ${event.params.deliveryId}`);
    return;
  }
  context.Delivery.set({
    ...d,
    status: "Provisioned",
    provisionedAt: BigInt(event.block.timestamp),
    ciphertext: event.params.ciphertext,
  });
});

DeliveryEscrow.Settled.handler(async ({ event, context }) => {
  const { deliveryId, verdict, tflopsE2, toBuyer, toProvider } = event.params;
  const d = await context.Delivery.get(deliveryId.toString());
  if (!d) {
    context.log.warn(`Settled for unknown delivery ${deliveryId}`);
    return;
  }
  const v = Number(verdict);
  context.Delivery.set({
    ...d,
    status: "Settled",
    verdict: v,
    tflopsE2: Number(tflopsE2),
    toBuyer,
    toProvider,
    settledAt: BigInt(event.block.timestamp),
  });

  const p = (await context.Provider.get(d.provider_id)) ?? emptyProvider(d.provider_id);
  context.Provider.set({
    ...p,
    passes: p.passes + (v === 1 ? 1 : 0),
    degraded: p.degraded + (v === 2 ? 1 : 0),
    fails: p.fails + (v === 3 ? 1 : 0),
    // Hours count as delivered unless the verifier failed the machine outright.
    hoursDelivered: p.hoursDelivered + (v === 3 ? ZERO : d.hours),
    slashedTotal: p.slashedTotal + toBuyer,
    earnedTotal: p.earnedTotal + toProvider,
  });
});

DeliveryEscrow.TimeoutClaimed.handler(async ({ event, context }) => {
  const { deliveryId, toBuyer, toProvider } = event.params;
  const d = await context.Delivery.get(deliveryId.toString());
  if (!d) {
    context.log.warn(`TimeoutClaimed for unknown delivery ${deliveryId}`);
    return;
  }
  context.Delivery.set({
    ...d,
    status: "TimedOut",
    toBuyer,
    toProvider,
    settledAt: BigInt(event.block.timestamp),
  });

  // toBuyer > 0 means the provider never provisioned: that's a slash + a timeout strike.
  // toProvider > 0 means the verifier never settled: provider keeps the bond, no strike.
  const p = (await context.Provider.get(d.provider_id)) ?? emptyProvider(d.provider_id);
  context.Provider.set({
    ...p,
    timeouts: p.timeouts + (toBuyer > ZERO ? 1 : 0),
    slashedTotal: p.slashedTotal + toBuyer,
    earnedTotal: p.earnedTotal + toProvider,
    hoursDelivered: p.hoursDelivered + (toProvider > ZERO ? d.hours : ZERO),
  });
});

// ---------------------------------------------------------------- Kuru OrderBook

KuruOrderBook.Trade.handler(async ({ event, context }) => {
  const market = event.srcAddress.toLowerCase();
  const mapped = MARKET_TO_SERIES[market];
  const seriesId = mapped ? String(mapped.seriesId) : undefined;
  const ts = BigInt(event.block.timestamp);

  context.Trade.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    market,
    series_id: seriesId,
    orderId: event.params.orderId,
    isBuy: event.params.isBuy,
    maker: event.params.makerAddress.toLowerCase(),
    taker: event.params.takerAddress.toLowerCase(),
    price: event.params.price,
    size: event.params.filledSize,
    timestamp: ts,
    txHash: event.transaction.hash,
  });

  if (!seriesId) return;
  const s = (await context.Series.get(seriesId)) ?? emptySeries(seriesId);
  context.Series.set({
    ...s,
    market,
    lastPrice: event.params.price,
    lastTradeAt: ts,
    tradeCount: s.tradeCount + 1,
  });
});
