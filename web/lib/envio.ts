// Envio GraphQL (indexer/ in this repo). Returns null when the endpoint isn't set or
// fails, so callers fall back to direct contract reads.
import { ENVIO_GRAPHQL, isReachableApi } from "./config";

export const ENVIO_GRAPHQL_ENDPOINT =
  ENVIO_GRAPHQL || process.env.NEXT_PUBLIC_ENVIO_GRAPHQL || "http://localhost:8080/v1/graphql";

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  const endpoint = ENVIO_GRAPHQL || ENVIO_GRAPHQL_ENDPOINT;
  if (!isReachableApi(endpoint)) return null;
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: T; errors?: unknown };
    return j.errors || !j.data ? null : j.data;
  } catch {
    return null;
  }
}

export type EnvioProvider = {
  id: string;
  name: string;
  minted: string;
  passes: number;
  degraded: number;
  fails: number;
  timeouts: number;
  hoursDelivered: string;
  slashedTotal: string;
  earnedTotal: string;
};

export interface ProviderRecord {
  id: string;
  name: string;
  passes: number;
  degraded: number;
  fails: number;
  timeouts: number;
  hoursDelivered: string;
  slashedTotal: string;
}

/** providersLeaderboard: fewest fails first, then most passes, then hours delivered. */
export const PROVIDERS_LEADERBOARD = /* GraphQL */ `
  query providersLeaderboard {
    Provider(order_by: [{ fails: asc }, { passes: desc }, { hoursDelivered: desc }], limit: 100) {
      id
      name
      minted
      passes
      degraded
      fails
      timeouts
      hoursDelivered
      slashedTotal
      earnedTotal
    }
  }
`;

export const PROVIDERS_LEADERBOARD_QUERY = PROVIDERS_LEADERBOARD;

export async function envioLeaderboard() {
  const d = await gql<{ Provider: EnvioProvider[] }>(PROVIDERS_LEADERBOARD);
  return d?.Provider ?? null;
}

export async function fetchProviderLeaderboard(): Promise<ProviderRecord[]> {
  const providers = await envioLeaderboard();
  if (!providers) return [];
  return providers.map((p) => ({
    ...p,
    slashedTotal: (Number(p.slashedTotal || 0) / 1e6).toFixed(2),
    hoursDelivered: Number(p.hoursDelivered || 0).toString(),
  }));
}

export type EnvioSeries = {
  id: string;
  symbol: string;
  gpuClass: string;
  market: string | null;
  lastPrice: string | null;
  lastTradeAt: string | null;
  openHours: string;
  tradeCount: number;
};

export type EnvioGpuClass = {
  id: string;
  latestPriceE8: string;
  latestDayKey: string;
};

/** forwardCurve: every series with its last Kuru trade + latest index print per class. */
export const FORWARD_CURVE = /* GraphQL */ `
  query forwardCurve {
    Series(order_by: { windowStart: asc }) {
      id
      symbol
      gpuClass
      market
      lastPrice
      lastTradeAt
      openHours
      tradeCount
    }
    GpuClass {
      id
      latestPriceE8
      latestDayKey
    }
  }
`;

export async function envioForwardCurve() {
  return gql<{ Series: EnvioSeries[]; GpuClass: EnvioGpuClass[] }>(FORWARD_CURVE);
}

export type EnvioDelivery = {
  id: string;
  series_id: string;
  buyer: string;
  provider_id: string;
  hours: string;
  status: string;
  verdict: number | null;
  tflopsE2: number | null;
  requestedAt: string;
};

export async function envioDeliveries(where: { buyer?: string; provider?: string }) {
  const filters: string[] = [];
  if (where.buyer) filters.push(`buyer: { _eq: "${where.buyer.toLowerCase()}" }`);
  if (where.provider) filters.push(`provider_id: { _eq: "${where.provider.toLowerCase()}" }`);
  const d = await gql<{ Delivery: EnvioDelivery[] }>(`
    query myDeliveries {
      Delivery(where: { ${filters.join(", ")} }, order_by: { requestedAt: desc }, limit: 200) {
        id
        series_id
        buyer
        provider_id
        hours
        status
        verdict
        tflopsE2
        requestedAt
      }
    }
  `);
  return d?.Delivery ?? null;
}
