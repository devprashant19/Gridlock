import { Logger } from "../common/logger.ts";

const logger = new Logger("settler-poller");

export interface PollerOptions {
  baseUrl: string;
  maxAttempts?: number;
  initialIntervalMs?: number;
  maxIntervalMs?: number;
  jitterMs?: number;
}

/**
 * Calculates exponential backoff interval with randomized jitter
 */
export function calculateBackoffWithJitter(
  attempt: number,
  initialMs: number = 500,
  maxMs: number = 5000,
  jitterMs: number = 150
): number {
  const exponential = initialMs * Math.pow(1.4, attempt - 1);
  const capped = Math.min(exponential, maxMs);
  const jitter = Math.random() * jitterMs;
  return Math.round(capped + jitter);
}

/**
 * Discovers and polls Verifier endpoints with exponential backoff and dual-endpoint fallback
 */
export async function fetchVerifierVerdictWithRetry(
  deliveryId: bigint | number,
  options: PollerOptions,
  fetchFn: typeof fetch = fetch
): Promise<any> {
  const maxAttempts = options.maxAttempts || 8;
  const initialMs = options.initialIntervalMs || 400;
  const maxMs = options.maxIntervalMs || 3000;
  const jitterMs = options.jitterMs || 100;

  // Try dedicated Chainlink CRE endpoint first, then standard endpoint
  const candidateUrls = [
    `${options.baseUrl}/cre/verdict/${deliveryId}`,
    `${options.baseUrl}/verdict/${deliveryId}`,
  ];

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    for (const url of candidateUrls) {
      try {
        const res = await fetchFn(url, { headers: { Accept: "application/json" } });

        if (res.status === 404 || res.status === 202) {
          // Verdict pending execution on the GPU host
          continue;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (data && typeof data === "object" && data.verdict !== undefined) {
          logger.info(`Verdict successfully resolved via ${url} on attempt ${attempt}`);
          return data;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (attempt < maxAttempts) {
      const waitTime = calculateBackoffWithJitter(attempt, initialMs, maxMs, jitterMs);
      logger.debug(`Verifier still evaluating delivery #${deliveryId}. Backing off for ${waitTime}ms (attempt ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, waitTime));
    }
  }

  throw new Error(
    `Verifier polling timed out for delivery #${deliveryId} after ${maxAttempts} attempts. Last error: ${lastError?.message || "Pending state"}`
  );
}
