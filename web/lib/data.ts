// Chain reads. Envio is preferred for aggregates (leaderboard, forward curve); every
// read has a direct-contract fallback so the app works before the indexer is live.
import { formatEther, type Address, type Hex } from "viem";
import { deliveryEscrowAbi, gridUsdAbi, indexOracleAbi } from "./abis";
import { publicClient } from "./chain";
import { CONTRACTS, IS_MOCK, SERIES, type SeriesConfig } from "./config";
import { demoBook, demoDeliveries, demoIndex, demoLastPrice, demoLeaderboard } from "./demo";
import { envioForwardCurve, envioLeaderboard } from "./envio";
import { gusd, priceE8ToUsd } from "./format";
import { getBook, type Book } from "./kuru";

export const STATUS = ["None", "Requested", "Provisioned", "Settled", "TimedOut"] as const;
export const VERDICT = ["—", "PASS", "DEGRADED", "FAIL"] as const;

export type DeliveryView = {
  id: number;
  seriesId: number;
  buyer: Address;
  provider: Address;
  hours: bigint;
  buyerEncPubKey: Hex;
  deadline: number;
  provisionedAt: number;
  bondAmount: bigint;
  status: number;
  ciphertext: Hex;
  verdict: number;
  tflopsE2: number;
  resultRoot: Hex;
};

// ------------------------------------------------------------------ index prices

export type IndexMap = Record<string, { priceE8: bigint; dayKey: bigint } | undefined>;

/** Latest IndexOracle print per class used by a listed series. */
export async function readIndexPrices(): Promise<IndexMap> {
  if (IS_MOCK) return demoIndex();
  const classes = [...new Map(SERIES.map((s) => [s.className, s.gpuClass])).entries()];
  const res = await publicClient.multicall({
    contracts: classes.map(([, h]) => ({ address: CONTRACTS.indexOracle, abi: indexOracleAbi, functionName: "latest", args: [h] }) as const),
    allowFailure: true,
  });
  return Object.fromEntries(
    classes.map(([name], i) => {
      const r = res[i];
      return [name, r.status === "success" ? { priceE8: r.result[0], dayKey: r.result[1] } : undefined];
    }),
  );
}

// ------------------------------------------------------------------ balances

export type Balances = { mon: bigint; gusd: bigint; hours: Record<string, bigint> };

export async function readBalances(addr: Address): Promise<Balances> {
  if (IS_MOCK) return { mon: 0n, gusd: 0n, hours: Object.fromEntries(SERIES.map((s) => [s.symbol, 0n])) };
  const [mon, res] = await Promise.all([
    publicClient.getBalance({ address: addr }),
    publicClient.multicall({
      contracts: [CONTRACTS.gridUSD, ...SERIES.map((s) => s.token)].map(
        (address) => ({ address, abi: gridUsdAbi, functionName: "balanceOf", args: [addr] }) as const,
      ),
      allowFailure: true,
    }),
  ]);
  const val = (i: number) => (res[i].status === "success" ? (res[i].result as bigint) : 0n);
  return { mon, gusd: val(0), hours: Object.fromEntries(SERIES.map((s, i) => [s.symbol, val(i + 1)])) };
}

export const monLabel = (wei: bigint) => Number(formatEther(wei)).toFixed(3);

// ------------------------------------------------------------------ deliveries

type RawDelivery = {
  seriesId: bigint; buyer: Address; provider: Address; hours_: bigint; buyerEncPubKey: Hex; deadline: bigint;
  provisionedAt: bigint; bondAmount: bigint; status: number; ciphertext: Hex; verdict: number; tflopsE2: number; resultRoot: Hex;
};

const toView = (id: number, d: RawDelivery): DeliveryView => ({
  id,
  seriesId: Number(d.seriesId),
  buyer: d.buyer,
  provider: d.provider,
  hours: d.hours_,
  buyerEncPubKey: d.buyerEncPubKey,
  deadline: Number(d.deadline),
  provisionedAt: Number(d.provisionedAt),
  bondAmount: d.bondAmount,
  status: Number(d.status),
  ciphertext: d.ciphertext,
  verdict: Number(d.verdict),
  tflopsE2: Number(d.tflopsE2),
  resultRoot: d.resultRoot,
});

export async function readDelivery(id: number): Promise<DeliveryView | null> {
  if (IS_MOCK) return demoDeliveries().find((d) => d.id === id) ?? null;
  try {
    const d = await publicClient.readContract({ address: CONTRACTS.deliveryEscrow, abi: deliveryEscrowAbi, functionName: "getDelivery", args: [BigInt(id)] });
    return toView(id, d as RawDelivery);
  } catch {
    return null; // reverts with "Invalid deliveryId" past the end
  }
}

/** All deliveries, read by id until getDelivery reverts (no getLogs range limits). */
export async function scanDeliveries(max = 2000): Promise<DeliveryView[]> {
  if (IS_MOCK) return demoDeliveries();
  const out: DeliveryView[] = [];
  const BATCH = 40;
  for (let start = 0; start < max; start += BATCH) {
    const ids = Array.from({ length: BATCH }, (_, i) => start + i);
    const res = await publicClient.multicall({
      contracts: ids.map((i) => ({ address: CONTRACTS.deliveryEscrow, abi: deliveryEscrowAbi, functionName: "getDelivery", args: [BigInt(i)] }) as const),
      allowFailure: true,
    });
    for (let i = 0; i < res.length; i++) {
      const r = res[i];
      if (r.status !== "success") return out;
      out.push(toView(ids[i], r.result as RawDelivery));
    }
  }
  return out;
}

// ------------------------------------------------------------------ providers

export async function readProvider(addr: Address) {
  if (IS_MOCK) return { name: "", registered: false, openHours: Object.fromEntries(SERIES.map((s) => [s.symbol, 0n])) as Record<string, bigint> };
  const [info, hours] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.deliveryEscrow, abi: deliveryEscrowAbi, functionName: "providers", args: [addr] }),
    publicClient.multicall({
      contracts: SERIES.map(
        (s) => ({ address: CONTRACTS.deliveryEscrow, abi: deliveryEscrowAbi, functionName: "openHours", args: [BigInt(s.seriesId), addr] }) as const,
      ),
      allowFailure: true,
    }),
  ]);
  return {
    name: info[0],
    registered: info[1],
    openHours: Object.fromEntries(SERIES.map((s, i) => [s.symbol, hours[i].status === "success" ? (hours[i].result as bigint) : 0n])),
  };
}

export type LeaderRow = {
  address: string;
  name: string;
  minted: number;
  passes: number;
  degraded: number;
  fails: number;
  timeouts: number;
  hoursDelivered: number;
  slashed: number;
  earned: number;
};

export type Sourced<T> = { rows: T; source: "envio" | "chain" | "demo" };

export const rankProviders = (rows: LeaderRow[]) =>
  [...rows].sort((a, b) => a.fails + a.timeouts - (b.fails + b.timeouts) || b.passes - a.passes || b.hoursDelivered - a.hoursDelivered);

export async function readLeaderboard(): Promise<Sourced<LeaderRow[]>> {
  if (IS_MOCK) return { rows: rankProviders(demoLeaderboard()), source: "demo" };
  const env = await envioLeaderboard();
  if (env) {
    return {
      source: "envio",
      rows: rankProviders(
        env.map((p) => ({
          address: p.id,
          name: p.name,
          minted: Number(p.minted),
          passes: p.passes,
          degraded: p.degraded,
          fails: p.fails,
          timeouts: p.timeouts,
          hoursDelivered: Number(p.hoursDelivered),
          slashed: gusd(BigInt(p.slashedTotal)),
          earned: gusd(BigInt(p.earnedTotal)),
        })),
      ),
    };
  }
  // Fallback: aggregate from deliveries; minted hours not reconstructable without logs.
  const ds = await scanDeliveries();
  const by = new Map<string, LeaderRow>();
  for (const d of ds) {
    const k = d.provider.toLowerCase();
    const r = by.get(k) ?? { address: k, name: "", minted: 0, passes: 0, degraded: 0, fails: 0, timeouts: 0, hoursDelivered: 0, slashed: 0, earned: 0 };
    const share = (pct: bigint) => gusd((d.bondAmount * pct) / 100n);
    if (d.status === 3) {
      if (d.verdict === 1) { r.passes++; r.hoursDelivered += Number(d.hours); r.earned += gusd(d.bondAmount); }
      if (d.verdict === 2) { r.degraded++; r.hoursDelivered += Number(d.hours); r.earned += share(30n); r.slashed += gusd(d.bondAmount) - share(30n); }
      if (d.verdict === 3) { r.fails++; r.slashed += gusd(d.bondAmount); }
    }
    if (d.status === 4) {
      if (d.provisionedAt === 0) { r.timeouts++; r.slashed += gusd(d.bondAmount); }
      else { r.hoursDelivered += Number(d.hours); r.earned += gusd(d.bondAmount); }
    }
    by.set(k, r);
  }
  const rows = [...by.values()];
  const names = await publicClient.multicall({
    contracts: rows.map((r) => ({ address: CONTRACTS.deliveryEscrow, abi: deliveryEscrowAbi, functionName: "providers", args: [r.address as Address] }) as const),
    allowFailure: true,
  });
  rows.forEach((r, i) => {
    const n = names[i];
    if (n.status === "success") r.name = (n.result as readonly [string, boolean])[0];
  });
  return { rows: rankProviders(rows), source: "chain" };
}

// ------------------------------------------------------------------ forward curve

export type CurveRow = {
  series: SeriesConfig;
  spotUsd: number | null; // IndexOracle print
  lastUsd: number | null; // last Kuru trade (Envio) or book mid
  bestBid: number | null;
  bestAsk: number | null;
  openHours: number | null;
};

const mid = (b: Book) => (b.bids[0] && b.asks[0] ? (b.bids[0][0] + b.asks[0][0]) / 2 : b.asks[0]?.[0] ?? b.bids[0]?.[0] ?? null);

export async function readForwardCurve(): Promise<Sourced<CurveRow[]>> {
  if (IS_MOCK) {
    const idx = demoIndex();
    return {
      source: "demo",
      rows: SERIES.map((s) => {
        const b = demoBook(s.symbol);
        return { series: s, spotUsd: priceE8ToUsd(idx[s.className]?.priceE8), lastUsd: demoLastPrice(s.symbol), bestBid: b.bids[0][0], bestAsk: b.asks[0][0], openHours: null };
      }),
    };
  }

  const [env, idx, books] = await Promise.all([
    envioForwardCurve(),
    readIndexPrices().catch(() => ({}) as IndexMap),
    Promise.all(SERIES.map((s) => (s.kuruMarket ? getBook(s.kuruMarket).catch(() => null) : Promise.resolve(null)))),
  ]);
  const envSeries = new Map(env?.Series.map((s) => [s.symbol, s]) ?? []);
  const envClass = new Map(env?.GpuClass.map((c) => [c.id.toLowerCase(), c]) ?? []);

  return {
    source: env ? "envio" : "chain",
    rows: SERIES.map((s, i) => {
      const es = envSeries.get(s.symbol);
      const ec = envClass.get(s.gpuClass.toLowerCase());
      const book = books[i];
      const spot = ec ? priceE8ToUsd(BigInt(ec.latestPriceE8)) : idx[s.className] ? priceE8ToUsd(idx[s.className]!.priceE8) : null;
      const last = es?.lastPrice ? Number(BigInt(es.lastPrice)) / 1e18 : book ? mid(book) : null;
      return {
        series: s,
        spotUsd: spot,
        lastUsd: last,
        bestBid: book?.bids[0]?.[0] ?? null,
        bestAsk: book?.asks[0]?.[0] ?? null,
        openHours: es ? Number(es.openHours) : null,
      };
    }),
  };
}

export async function readBook(s: SeriesConfig): Promise<Book | null> {
  if (IS_MOCK) return demoBook(s.symbol);
  if (!s.kuruMarket) return null;
  return getBook(s.kuruMarket);
}
