import { ethers } from "ethers";
import {
  encodeSettlementReport,
  decodeSettlementReport,
} from "../common/encoding.ts";
import { verifyUnanimousVerdict } from "../common/consensus.ts";
import { Logger } from "../common/logger.ts";
import { VerdictStatus, type VerifierVerdict, type SettlementReport } from "../common/types.ts";

const logger = new Logger("delivery-settler");

export const PROVISIONED_TOPIC = ethers.id("Provisioned(uint256,bytes)");

export interface SettlerConfig {
  verifierBaseUrl?: string;
  maxRetries?: number;
  retryIntervalMs?: number;
  donNodes?: number;
}

export const DEFAULT_VERIFIER_URL = "http://localhost:8000";

/**
 * Extracts and validates deliveryId and ciphertext from EVM log trigger
 */
export function parseProvisionedLog(log: {
  topics?: string[];
  data?: string;
  args?: { deliveryId?: bigint | number; ciphertext?: string };
}): { deliveryId: bigint; ciphertext?: string } {
  // If pre-parsed args provided by SDK
  if (log.args && log.args.deliveryId !== undefined) {
    const deliveryId = BigInt(log.args.deliveryId);
    if (deliveryId <= 0n) {
      throw new Error(`Invalid non-positive deliveryId: ${deliveryId}`);
    }
    return { deliveryId, ciphertext: log.args.ciphertext };
  }

  // Parse raw EVM log topics
  if (!log.topics || log.topics.length < 2) {
    throw new Error("Invalid EVM log format: Missing topics for Provisioned event");
  }

  const topic0 = log.topics[0].toLowerCase();
  if (topic0 !== PROVISIONED_TOPIC.toLowerCase()) {
    throw new Error(`Event signature mismatch. Expected ${PROVISIONED_TOPIC}, got ${topic0}`);
  }

  const deliveryIdHex = log.topics[1];
  const deliveryId = BigInt(deliveryIdHex);
  if (deliveryId <= 0n) {
    throw new Error(`Invalid non-positive deliveryId extracted: ${deliveryId}`);
  }

  return { deliveryId, ciphertext: log.data };
}

/**
 * Polls Verifier API with retries until verdict is reached or timeout
 */
export async function pollVerifierVerdict(
  deliveryId: bigint | number,
  baseUrl: string = DEFAULT_VERIFIER_URL,
  maxRetries: number = 8,
  intervalMs: number = 500,
  fetchFn: typeof fetch = fetch
): Promise<VerifierVerdict> {
  const url = `${baseUrl}/verdict/${deliveryId}`;
  logger.info(`Polling verifier verdict for delivery #${deliveryId}`, { url });

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchFn(url, { headers: { Accept: "application/json" } });

      if (res.status === 404 || res.status === 202) {
        logger.info(`Verification pending on verifier (attempt ${attempt}/${maxRetries})`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, intervalMs));
          continue;
        }
      }

      if (!res.ok) {
        throw new Error(`Verifier returned HTTP ${res.status}: ${res.statusText}`);
      }

      const body = (await res.json()) as any;
      if (!body || typeof body !== "object") {
        throw new Error("Malformed JSON response from Verifier API");
      }

      const verdictVal = Number(body.verdict);
      if (![1, 2, 3].includes(verdictVal)) {
        throw new Error(`Invalid verdict value: ${body.verdict} (must be 1: PASS, 2: DEGRADED, 3: FAIL)`);
      }

      const tflopsE2 = Number(body.tflopsE2);
      if (isNaN(tflopsE2) || tflopsE2 < 0) {
        throw new Error(`Invalid tflopsE2: ${body.tflopsE2}`);
      }

      const resultRoot = String(body.resultRoot || "");
      if (!ethers.isHexString(resultRoot, 32)) {
        throw new Error(`Invalid resultRoot: expected 32-byte hex string, got ${resultRoot}`);
      }

      logger.info(`Verdict received for delivery #${deliveryId}: ${body.verdictName || verdictVal}`, {
        deliveryId: Number(deliveryId),
        verdict: verdictVal,
        tflopsE2,
        resultRoot,
      });

      return {
        deliveryId: Number(deliveryId),
        verdict: verdictVal as VerdictStatus,
        verdictName: body.verdictName || (verdictVal === 1 ? "PASS" : verdictVal === 2 ? "DEGRADED" : "FAIL"),
        tflopsE2,
        resultRoot,
        signature: body.signature,
        timestamp: body.timestamp,
      };
    } catch (err: any) {
      lastError = err;
      logger.warn(`Polling attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }
  }

  throw new Error(
    `Polling verifier for delivery #${deliveryId} timed out after ${maxRetries} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Executes delivery-settler workflow for an incoming Provisioned event
 */
export async function handleDeliverySettler(
  event: any,
  config: SettlerConfig = {},
  fetchFn: typeof fetch = fetch
): Promise<SettlementReport> {
  const { deliveryId } = parseProvisionedLog(event);
  const verifierUrl = config.verifierBaseUrl || DEFAULT_VERIFIER_URL;
  const donNodes = config.donNodes || 3;

  logger.info(`Starting settlement workflow for delivery #${deliveryId}`, {
    deliveryId: deliveryId.toString(),
    verifierUrl,
    donNodes,
  });

  // Step 1: DON HTTP polling across nodes
  const nodeObservations: VerifierVerdict[] = [];
  for (let n = 0; n < donNodes; n++) {
    const verdict = await pollVerifierVerdict(
      deliveryId,
      verifierUrl,
      config.maxRetries || 5,
      config.retryIntervalMs || 200,
      fetchFn
    );
    nodeObservations.push(verdict);
  }

  // Step 2: DON Consensus (all nodes must agree unanimously on verdict, tflops, and resultRoot)
  const consensusVerdict = verifyUnanimousVerdict(nodeObservations);

  // Step 3: Encode onchain report for DeliveryEscrow.onReport
  const encodedReport = encodeSettlementReport(
    consensusVerdict.deliveryId,
    consensusVerdict.verdict,
    consensusVerdict.tflopsE2,
    consensusVerdict.resultRoot
  );

  logger.info(`Settlement report generated for delivery #${deliveryId}`, {
    deliveryId: consensusVerdict.deliveryId,
    verdict: consensusVerdict.verdict,
    tflopsE2: consensusVerdict.tflopsE2,
    resultRoot: consensusVerdict.resultRoot,
  });

  return {
    deliveryId: BigInt(consensusVerdict.deliveryId),
    verdict: consensusVerdict.verdict,
    tflopsE2: consensusVerdict.tflopsE2,
    resultRoot: consensusVerdict.resultRoot,
    encodedReport,
  };
}
