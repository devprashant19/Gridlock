import { ethers } from "ethers";

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

/**
 * Computes bytes32 hash of the approved GPU symbol string
 * e.g. keccak256(toUtf8Bytes("H100 SXM"))
 */
export function computeGpuClassHash(symbol: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(symbol));
}

/**
 * Converts a date/ISO timestamp string or numeric ms to uint64 unix epoch seconds
 */
export function computeDayKey(timestamp: string | number | Date): bigint {
  const ms = typeof timestamp === "string" || typeof timestamp === "number"
    ? new Date(timestamp).getTime()
    : timestamp.getTime();
  if (isNaN(ms)) {
    throw new Error(`Invalid timestamp for dayKey conversion: ${timestamp}`);
  }
  return BigInt(Math.floor(ms / 1000));
}

/**
 * Converts float USD price to uint128 priceE8 (scaled by 1e8)
 */
export function computePriceE8(value: number): bigint {
  if (typeof value !== "number" || isNaN(value) || value < 0) {
    throw new Error(`Invalid numeric price value: ${value}`);
  }
  return BigInt(Math.round(value * 1e8));
}

/**
 * ABI-encodes IndexOracle report: (bytes32 gpuClass, uint64 dayKey, uint128 priceE8)
 */
export function encodeIndexReport(
  gpuClass: string,
  dayKey: bigint | number,
  priceE8: bigint | number
): string {
  return abiCoder.encode(
    ["bytes32", "uint64", "uint128"],
    [gpuClass, BigInt(dayKey), BigInt(priceE8)]
  );
}

/**
 * Decodes IndexOracle report bytes back into tuple
 */
export function decodeIndexReport(report: string): {
  gpuClass: string;
  dayKey: bigint;
  priceE8: bigint;
} {
  const [gpuClass, dayKey, priceE8] = abiCoder.decode(
    ["bytes32", "uint64", "uint128"],
    report
  );
  return { gpuClass, dayKey, priceE8 };
}

/**
 * ABI-encodes DeliveryEscrow settlement report:
 * (uint256 deliveryId, uint8 verdict, uint32 tflopsE2, bytes32 resultRoot)
 */
export function encodeSettlementReport(
  deliveryId: bigint | number,
  verdict: number,
  tflopsE2: number,
  resultRoot: string
): string {
  if (verdict < 1 || verdict > 3) {
    throw new Error(`Invalid verdict value: ${verdict} (must be 1: PASS, 2: DEGRADED, 3: FAIL)`);
  }
  return abiCoder.encode(
    ["uint256", "uint8", "uint32", "bytes32"],
    [BigInt(deliveryId), verdict, tflopsE2, resultRoot]
  );
}

/**
 * Decodes DeliveryEscrow settlement report bytes
 */
export function decodeSettlementReport(report: string): {
  deliveryId: bigint;
  verdict: number;
  tflopsE2: number;
  resultRoot: string;
} {
  const [deliveryId, verdict, tflopsE2, resultRoot] = abiCoder.decode(
    ["uint256", "uint8", "uint32", "bytes32"],
    report
  );
  return {
    deliveryId,
    verdict: Number(verdict),
    tflopsE2: Number(tflopsE2),
    resultRoot,
  };
}
