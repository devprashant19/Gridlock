/**
 * Heartbeat and Deviation Threshold Engine for Index Feeds
 * Mirrors standard Chainlink Data Feeds economic efficiency patterns.
 */

export interface ThresholdDecision {
  shouldPublish: boolean;
  reason: "INITIAL_SEED" | "DEVIATION_EXCEEDED" | "HEARTBEAT_EXPIRED" | "WITHIN_THRESHOLD";
  deviationPercent: number;
  timeElapsedSec: number;
}

/**
 * Evaluates whether an on-chain report should be submitted based on price shift and heartbeat
 *
 * @param currentPriceE8 Newly observed consensus price (scaled 1e8)
 * @param lastPriceE8 Previous on-chain price (scaled 1e8), 0n if no prior print
 * @param currentTimestampSec Current print timestamp in epoch seconds
 * @param lastTimestampSec Timestamp of last on-chain print in epoch seconds
 * @param deviationThresholdPercent Minimum % price shift to trigger an immediate update (default 1.0%)
 * @param heartbeatSec Maximum seconds allowed before forcing a refresh (default 3600s = 1h)
 */
export function evaluatePublicationThreshold(
  currentPriceE8: bigint,
  lastPriceE8: bigint,
  currentTimestampSec: bigint,
  lastTimestampSec: bigint,
  deviationThresholdPercent: number = 1.0,
  heartbeatSec: number = 3600
): ThresholdDecision {
  const timeElapsedSec = Number(currentTimestampSec - lastTimestampSec);

  // Case 1: Initial seed (no prior print on-chain)
  if (lastPriceE8 <= 0n || lastTimestampSec <= 0n) {
    return {
      shouldPublish: true,
      reason: "INITIAL_SEED",
      deviationPercent: 100.0,
      timeElapsedSec: Math.max(0, timeElapsedSec),
    };
  }

  // Case 2: Heartbeat expiration (forces a freshness refresh regardless of price change)
  if (timeElapsedSec >= heartbeatSec) {
    const diff = Number(currentPriceE8 > lastPriceE8 ? currentPriceE8 - lastPriceE8 : lastPriceE8 - currentPriceE8);
    const deviationPercent = (diff / Number(lastPriceE8)) * 100;
    return {
      shouldPublish: true,
      reason: "HEARTBEAT_EXPIRED",
      deviationPercent: Number(deviationPercent.toFixed(2)),
      timeElapsedSec,
    };
  }

  // Case 3: Price deviation check
  const diff = Number(currentPriceE8 > lastPriceE8 ? currentPriceE8 - lastPriceE8 : lastPriceE8 - currentPriceE8);
  const deviationPercent = (diff / Number(lastPriceE8)) * 100;

  if (deviationPercent >= deviationThresholdPercent) {
    return {
      shouldPublish: true,
      reason: "DEVIATION_EXCEEDED",
      deviationPercent: Number(deviationPercent.toFixed(2)),
      timeElapsedSec,
    };
  }

  // Case 4: Price is stable and heartbeat is still fresh -> skip write
  return {
    shouldPublish: false,
    reason: "WITHIN_THRESHOLD",
    deviationPercent: Number(deviationPercent.toFixed(2)),
    timeElapsedSec,
  };
}
