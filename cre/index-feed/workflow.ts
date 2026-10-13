import {
  computeGpuClassHash,
  computeDayKey,
  computePriceE8,
  encodeIndexReport,
} from "../common/encoding.ts";
import { calculateMedian } from "../common/consensus.ts";
import { filterExtremeAnomalies, filterOutliersIQR } from "../common/outliers.ts";
import { Logger } from "../common/logger.ts";
import { fetchWithFailover } from "./sources.ts";
import { evaluatePublicationThreshold, type ThresholdDecision } from "./threshold.ts";
import type { OrnnApiResponse, IndexPrint } from "../common/types.ts";

const logger = new Logger("index-feed");

export const APPROVED_SYMBOLS = ["H100 SXM", "H200", "B200", "A100 SXM4"] as const;
export type ApprovedSymbol = (typeof APPROVED_SYMBOLS)[number];

export const DEFAULT_ORNN_BASE =
  "https://ornn-backend-api-135941626504.us-central1.run.app/api/gpu";

// Maximum allowable staleness (7 days in ms) for demo/testnet data
const MAX_STALENESS_MS = 7 * 24 * 60 * 60 * 1000;

export interface WorkflowConfig {
  ornnApiBase?: string;
  donNodes?: number;
  skipFreshnessCheck?: boolean;
  deviationThresholdPercent?: number; // default 1.0%
  heartbeatSec?: number; // default 3600s
  lastPrints?: Record<string, { priceE8: bigint; dayKey: bigint }>;
}

export interface EnhancedIndexPrint extends IndexPrint {
  source: string;
  thresholdDecision: ThresholdDecision;
}

/**
 * Fetches and strictly validates index history from Ornn backend
 */
export async function fetchIndexHistory(
  symbol: string,
  apiBase: string = DEFAULT_ORNN_BASE,
  fetchFn: typeof fetch = fetch
): Promise<OrnnApiResponse> {
  if (!APPROVED_SYMBOLS.includes(symbol as ApprovedSymbol)) {
    throw new Error(`Unapproved GPU symbol: "${symbol}". Must be one of ${APPROVED_SYMBOLS.join(", ")}`);
  }

  const url = `${apiBase}/${encodeURIComponent(symbol)}/index-history`;
  logger.info(`Fetching index prints for ${symbol}`, { url });

  const res = await fetchFn(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Ornn API HTTP error for ${symbol}: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as OrnnApiResponse;

  if (!data || typeof data !== "object") {
    throw new Error(`Malformed Ornn response for ${symbol}: Expected JSON object`);
  }

  if (data.success !== true) {
    throw new Error(`Ornn API reported success=false for ${symbol}`);
  }

  if (!Array.isArray(data.data) || data.data.length === 0) {
    throw new Error(`Ornn API returned empty data series for ${symbol}`);
  }

  return data;
}

/**
 * Validates, sorts, and extracts the latest price print
 */
export function extractLatestRecord(
  apiResponse: OrnnApiResponse,
  maxStalenessMs: number = MAX_STALENESS_MS,
  skipFreshness: boolean = false
) {
  const records = apiResponse.data;
  if (!records || records.length === 0) {
    throw new Error("Cannot extract record from empty series");
  }

  // Validate all records and find latest by timestamp
  let latest = records[0];
  let latestTime = -Infinity;

  for (let i = 0; i < records.length; i++) {
    const cur = records[i];
    const curTime = new Date(cur.timestamp).getTime();
    if (isNaN(curTime)) {
      throw new Error(`Malformed timestamp in record: ${cur.timestamp}`);
    }
    if (typeof cur.index_value !== "number" || isNaN(cur.index_value) || cur.index_value <= 0) {
      throw new Error(`Invalid numeric index_value in record: ${cur.index_value}`);
    }
    if (curTime > latestTime) {
      latest = cur;
      latestTime = curTime;
    }
  }

  if (isNaN(latestTime)) {
    throw new Error(`Latest record has invalid timestamp: ${latest.timestamp}`);
  }

  if (!skipFreshness) {
    const now = Date.now();
    if (latestTime < now - maxStalenessMs) {
      logger.warn(`Stale index print detected for ${apiResponse.gpu_type}`, {
        latestTimestamp: latest.timestamp,
        ageHours: Math.round((now - latestTime) / (3600 * 1000)),
      });
    }
  }

  return latest;
}

/**
 * Robust DON multi-node observation aggregation:
 * Discards extreme anomalies, applies IQR filtering, and computes median.
 */
export function aggregateDonObservations(observations: number[]): number {
  if (observations.length === 0) {
    throw new Error("No DON observations to aggregate");
  }

  // Step 1: Discard extreme adversarial spikes
  const cleanObservations = filterExtremeAnomalies(observations, 0.6);

  // Step 2: Filter IQR statistical outliers if sufficient samples
  const robustObservations = filterOutliersIQR(cleanObservations);

  // Step 3: Compute median
  return calculateMedian(robustObservations);
}

/**
 * Main workflow handler: executes full cycle across all approved symbols
 */
export async function handleIndexFeed(
  config: WorkflowConfig = {},
  fetchFn: typeof fetch = fetch
): Promise<EnhancedIndexPrint[]> {
  const apiBase = config.ornnApiBase || DEFAULT_ORNN_BASE;
  const donNodes = config.donNodes || 3;
  const prints: EnhancedIndexPrint[] = [];

  logger.info("Executing Chainlink CRE index-feed workflow", {
    symbols: APPROVED_SYMBOLS,
    donNodes,
    deviationThreshold: `${config.deviationThresholdPercent ?? 1.0}%`,
    heartbeat: `${config.heartbeatSec ?? 3600}s`,
  });

  for (const symbol of APPROVED_SYMBOLS) {
    try {
      const nodeObservations: number[] = [];
      let latestRecordTimestamp = "";
      let sourceUsed = "ORNN_API";

      // DON Multi-Node HTTP capability with failover
      for (let n = 0; n < donNodes; n++) {
        const fetchResult = await fetchWithFailover(symbol, () =>
          fetchIndexHistory(symbol, apiBase, fetchFn)
        );
        sourceUsed = fetchResult.source;

        const latest = extractLatestRecord(
          fetchResult.response,
          MAX_STALENESS_MS,
          config.skipFreshnessCheck
        );
        nodeObservations.push(latest.index_value);
        latestRecordTimestamp = latest.timestamp;
      }

      // Consensus median aggregation with outlier protection
      const consensusValue = aggregateDonObservations(nodeObservations);

      // Encoding
      const gpuClass = computeGpuClassHash(symbol);
      const dayKey = computeDayKey(latestRecordTimestamp);
      const priceE8 = computePriceE8(consensusValue);
      const encodedReport = encodeIndexReport(gpuClass, dayKey, priceE8);

      // Evaluate economic publication threshold (deviation vs heartbeat)
      const lastPrint = config.lastPrints?.[symbol];
      const thresholdDecision = evaluatePublicationThreshold(
        priceE8,
        lastPrint?.priceE8 ?? 0n,
        dayKey,
        lastPrint?.dayKey ?? 0n,
        config.deviationThresholdPercent ?? 1.0,
        config.heartbeatSec ?? 3600
      );

      logger.info(`Consensus reached for ${symbol}`, {
        symbol,
        gpuClass,
        consensusValue,
        priceE8: priceE8.toString(),
        dayKey: dayKey.toString(),
        source: sourceUsed,
        decision: thresholdDecision.reason,
        shouldPublish: thresholdDecision.shouldPublish,
      });

      prints.push({
        symbol,
        gpuClass,
        dayKey,
        priceE8,
        rawIndexValue: consensusValue,
        timestamp: latestRecordTimestamp,
        encodedReport,
        source: sourceUsed,
        thresholdDecision,
      });
    } catch (err: any) {
      logger.error(`Failed to process symbol ${symbol}`, { error: err.message });
      throw err;
    }
  }

  return prints;
}
