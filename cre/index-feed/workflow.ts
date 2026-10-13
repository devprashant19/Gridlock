import {
  computeGpuClassHash,
  computeDayKey,
  computePriceE8,
  encodeIndexReport,
} from "../common/encoding.ts";
import { calculateMedian } from "../common/consensus.ts";
import { Logger } from "../common/logger.ts";
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
    // Allow for future prints within 1 day (clock drift) or past up to max staleness
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
 * Simulates DON multi-node observation and median consensus aggregation
 */
export function aggregateDonObservations(
  observations: number[]
): number {
  if (observations.length === 0) {
    throw new Error("No DON observations to aggregate");
  }
  return calculateMedian(observations);
}

/**
 * Main workflow handler: executes full cycle across all approved symbols
 */
export async function handleIndexFeed(
  config: WorkflowConfig = {},
  fetchFn: typeof fetch = fetch
): Promise<IndexPrint[]> {
  const apiBase = config.ornnApiBase || DEFAULT_ORNN_BASE;
  const donNodes = config.donNodes || 3;
  const prints: IndexPrint[] = [];

  logger.info("Executing Chainlink CRE index-feed workflow", {
    symbols: APPROVED_SYMBOLS,
    donNodes,
  });

  for (const symbol of APPROVED_SYMBOLS) {
    try {
      // Step 1: DON HTTP Capability simulation (each node queries Ornn endpoint)
      const nodeObservations: number[] = [];
      let latestRecordTimestamp = "";

      for (let n = 0; n < donNodes; n++) {
        const history = await fetchIndexHistory(symbol, apiBase, fetchFn);
        const latest = extractLatestRecord(history, MAX_STALENESS_MS, config.skipFreshnessCheck);
        nodeObservations.push(latest.index_value);
        latestRecordTimestamp = latest.timestamp;
      }

      // Step 2: Consensus median aggregation
      const consensusValue = aggregateDonObservations(nodeObservations);

      // Step 3: Encoding for onchain IndexOracle
      const gpuClass = computeGpuClassHash(symbol);
      const dayKey = computeDayKey(latestRecordTimestamp);
      const priceE8 = computePriceE8(consensusValue);
      const encodedReport = encodeIndexReport(gpuClass, dayKey, priceE8);

      logger.info(`Consensus reached for ${symbol}`, {
        symbol,
        gpuClass,
        consensusValue,
        priceE8: priceE8.toString(),
        dayKey: dayKey.toString(),
      });

      prints.push({
        symbol,
        gpuClass,
        dayKey,
        priceE8,
        rawIndexValue: consensusValue,
        timestamp: latestRecordTimestamp,
        encodedReport,
      });
    } catch (err: any) {
      logger.error(`Failed to process symbol ${symbol}`, { error: err.message });
      throw err;
    }
  }

  return prints;
}
