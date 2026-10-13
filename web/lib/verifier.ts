import type { Hex } from "viem";
import { VERIFIER_API } from "./config";

export type VerdictResponse = {
  deliveryId: number;
  verdict: number; // 1 pass, 2 degraded, 3 fail
  verdictName: "PASS" | "DEGRADED" | "FAIL";
  tflopsE2: number;
  resultRoot: Hex;
  signature: Hex;
  timestamp?: number;
};

/** GET /verdict/{id} (INTERFACES §3.4). null = no verdict yet / verifier unreachable. */
export async function fetchVerdict(deliveryId: string | number): Promise<VerdictResponse | null> {
  try {
    const r = await fetch(`${VERIFIER_API}/verdict/${deliveryId}`, { cache: "no-store" });
    if (!r.ok) return null;
    const v = (await r.json()) as VerdictResponse;
    return v && v.verdict ? v : null;
  } catch {
    return null;
  }
}

export const verifyCommand = (deliveryId: string | number, gpuClass: string) =>
  `python -m cli.main --api ${VERIFIER_API} --delivery ${deliveryId} --gpu-class "${gpuClass}"`;
