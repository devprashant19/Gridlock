/**
 * Outlier filtering primitives for DON node observations
 */

/**
 * Filters numeric outliers using the Interquartile Range (IQR) method.
 * Values outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR] are removed.
 */
export function filterOutliersIQR(values: number[]): number[] {
  if (values.length < 4) {
    return [...values]; // Insufficient samples for IQR quartiles, return as-is
  }

  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  if (iqr === 0) {
    return sorted; // All middle elements identical
  }

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const filtered = sorted.filter((v) => v >= lowerBound && v <= upperBound);
  return filtered.length > 0 ? filtered : sorted;
}

/**
 * Filters extreme adversarial anomalies deviating beyond maxDevRatio from reference.
 * e.g., if maxDevRatio is 0.8, any price < 0.2x or > 1.8x the median is rejected.
 */
export function filterExtremeAnomalies(
  values: number[],
  maxRelativeDeviation: number = 0.6
): number[] {
  if (values.length <= 2) {
    return [...values];
  }

  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  if (median <= 0) {
    return values;
  }

  const lowerLimit = median * (1 - maxRelativeDeviation);
  const upperLimit = median * (1 + maxRelativeDeviation);

  const cleaned = values.filter((v) => v >= lowerLimit && v <= upperLimit);
  return cleaned.length > 0 ? cleaned : values;
}
