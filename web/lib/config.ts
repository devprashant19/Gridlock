import { keccak256, toBytes, type Address, type Hex } from "viem";
import deployments from "./shared/deployments.json";
import classes from "./shared/classes.json";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? deployments.chainId ?? 10143);
export const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC ?? "https://testnet-rpc.monad.xyz";
export const EXPLORER = "https://testnet.monadexplorer.com";
export const ENVIO_GRAPHQL = process.env.NEXT_PUBLIC_ENVIO_GRAPHQL ?? "";
export const VERIFIER_API = (process.env.NEXT_PUBLIC_VERIFIER_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const MON_FAUCET = "https://faucet.monad.xyz";

/** Kuru Monad-testnet MarginAccount (docs.kuru.io/contracts/contract-addresses). */
export const KURU_MARGIN_ACCOUNT = (process.env.NEXT_PUBLIC_KURU_MARGIN_ACCOUNT ??
  "0xd029C2D98ff85D8F64799017fE00a59B1159CE02") as Address;
export const KURU_ROUTER = deployments.external.kuruRouter as Address;

/** Per-session GridUSD spend cap enforced by the scoped Mera signer. */
export const SESSION_CAP_GUSD = Number(process.env.NEXT_PUBLIC_SESSION_CAP_GUSD ?? 200);

export const CONTRACTS = {
  gridUSD: deployments.contracts.GridUSD as Address,
  indexOracle: deployments.contracts.IndexOracle as Address,
  seriesFactory: deployments.contracts.SeriesFactory as Address,
  deliveryEscrow: deployments.contracts.DeliveryEscrow as Address,
};

/**
 * True while deployments/testnet.json still holds Stream A's placeholder addresses
 * (0x1111…, 0x2222…). The app then serves demo data and blocks writes.
 */
export const IS_MOCK = Object.values(CONTRACTS).some((a) => /^0x(.)\1{39}$/i.test(a));

export type GpuClassInfo = {
  symbol: string;
  ratedTflops: number;
  passMinTflops: number;
  failMaxTflops: number;
  referencePriceUsd: number;
  priceE8: number;
};
export const GPU_CLASSES = classes.classes as Record<string, GpuClassInfo>;

const CLASS_BY_HASH: Record<string, string> = Object.fromEntries(
  Object.keys(GPU_CLASSES).map((name) => [keccak256(toBytes(name)).toLowerCase(), name]),
);
export const classNameFromHash = (h: string) => CLASS_BY_HASH[h.toLowerCase()] ?? `${h.slice(0, 10)}…`;
export const classHash = (name: string) => keccak256(toBytes(name));

// "gH100-W43" -> "H100 SXM". Used when the series' gpuClass hash isn't a known class
// (the placeholder deployments file has made-up hashes).
const classFromSymbol = (symbol: string) => {
  const prefix = symbol.replace(/^g/, "").split("-")[0];
  return Object.keys(GPU_CLASSES).find((c) => c === prefix || c.split(" ")[0] === prefix);
};

export type SeriesConfig = {
  symbol: string;
  seriesId: number;
  gpuClass: Hex;
  className: string;
  token: Address;
  kuruMarket?: Address;
  windowStart: number;
  windowEnd: number;
};

export const SERIES: SeriesConfig[] = Object.entries(
  deployments.series as Record<string, Omit<SeriesConfig, "symbol" | "className">>,
)
  .map(([symbol, s]) => ({
    ...s,
    symbol,
    className: CLASS_BY_HASH[s.gpuClass.toLowerCase()] ?? classFromSymbol(symbol) ?? classNameFromHash(s.gpuClass),
  }))
  .sort((a, b) => a.windowStart - b.windowStart || a.seriesId - b.seriesId);

export const seriesBySymbol = (sym: string) => SERIES.find((s) => s.symbol === sym);
export const seriesById = (id: number | bigint) => SERIES.find((s) => s.seriesId === Number(id));

/** Every address the scoped trading session may send a transaction to. */
export const SESSION_ALLOWLIST: Address[] = [
  CONTRACTS.gridUSD,
  CONTRACTS.deliveryEscrow,
  KURU_MARGIN_ACCOUNT,
  KURU_ROUTER,
  ...SERIES.map((s) => s.token),
  ...SERIES.flatMap((s) => (s.kuruMarket ? [s.kuruMarket] : [])),
];

/**
 * False for a loopback API (localhost / 127.x) when the page itself is served from a
 * public host: the browser can never reach it, it only produces console errors.
 */
export function isReachableApi(url: string) {
  if (!url) return false;
  try {
    const target = new URL(url).hostname;
    const loopback = (h: string) => h === "localhost" || h === "::1" || h.startsWith("127.");
    if (!loopback(target)) return true;
    return typeof window === "undefined" ? false : loopback(window.location.hostname);
  } catch {
    return false;
  }
}

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`;
