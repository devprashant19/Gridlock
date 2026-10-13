import { Logger } from "../common/logger.ts";
import type { OrnnApiResponse } from "../common/types.ts";

const logger = new Logger("index-sources");

// Baseline reference hourly rates from shared/INTERFACES.md
export const BASELINE_REFERENCE_PRICES: Record<string, number> = {
  "T4": 0.35,
  "A100 SXM4": 1.80,
  "H100 SXM": 2.65,
  "H200": 3.40,
  "B200": 4.80,
};

// Memory cache for recent successful API snapshots
const snapshotCache: Map<string, { data: OrnnApiResponse; cachedAt: number }> = new Map();

export interface FetchWithFailoverResult {
  response: OrnnApiResponse;
  source: "ORNN_API" | "CACHED_SNAPSHOT" | "FALLBACK_BASELINE";
}

/**
 * Fetches index data with automatic fallback to cache or baseline pricing
 */
export async function fetchWithFailover(
  symbol: string,
  primaryFetch: () => Promise<OrnnApiResponse>
): Promise<FetchWithFailoverResult> {
  // Attempt 1: Primary live API
  try {
    const liveResponse = await primaryFetch();
    snapshotCache.set(symbol, {
      data: liveResponse,
      cachedAt: Date.now(),
    });
    return {
      response: liveResponse,
      source: "ORNN_API",
    };
  } catch (err: any) {
    logger.warn(`Primary Ornn fetch failed for ${symbol}: ${err.message}. Initiating failover...`);
  }

  // Attempt 2: Cached snapshot (if available within last 24h)
  const cached = snapshotCache.get(symbol);
  if (cached && Date.now() - cached.cachedAt < 24 * 3600 * 1000) {
    logger.info(`Serving cached snapshot for ${symbol} (age: ${Math.round((Date.now() - cached.cachedAt) / 1000)}s)`);
    return {
      response: cached.data,
      source: "CACHED_SNAPSHOT",
    };
  }

  // Attempt 3: Baseline fallback
  const baselineRate = BASELINE_REFERENCE_PRICES[symbol];
  if (baselineRate !== undefined) {
    logger.warn(`Synthesizing baseline emergency print for ${symbol} at $${baselineRate}/hr`);
    const fallbackResponse: OrnnApiResponse = {
      success: true,
      gpu_type: symbol,
      access: "emergency-fallback-baseline",
      data: [
        {
          timestamp: new Date().toISOString(),
          index_value: baselineRate,
        },
      ],
    };
    return {
      response: fallbackResponse,
      source: "FALLBACK_BASELINE",
    };
  }

  throw new Error(`All data sources and fallbacks exhausted for GPU symbol: ${symbol}`);
}
