/**
 * Computes standard oracle median across an array of numeric readings
 */
export function calculateMedian(values: number[]): number {
  if (!values || values.length === 0) {
    throw new Error("Cannot calculate median of an empty array");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Validates unanimous consensus across an array of DON node observations.
 * For settlement verdicts, all nodes must strictly agree on (verdict, tflopsE2, resultRoot).
 */
export function verifyUnanimousVerdict<T extends { verdict: number; tflopsE2: number; resultRoot: string }>(
  nodeObservations: T[]
): T {
  if (!nodeObservations || nodeObservations.length === 0) {
    throw new Error("No node observations provided for consensus verification");
  }

  const primary = nodeObservations[0];
  for (let i = 1; i < nodeObservations.length; i++) {
    const obs = nodeObservations[i];
    if (
      obs.verdict !== primary.verdict ||
      obs.tflopsE2 !== primary.tflopsE2 ||
      obs.resultRoot.toLowerCase() !== primary.resultRoot.toLowerCase()
    ) {
      throw new Error(
        `DON Consensus Discrepancy detected between Node 0 and Node ${i}: ` +
        `Node 0=(${primary.verdict}, ${primary.tflopsE2}, ${primary.resultRoot}) vs ` +
        `Node ${i}=(${obs.verdict}, ${obs.tflopsE2}, ${obs.resultRoot})`
      );
    }
  }

  return primary;
}
