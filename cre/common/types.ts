export interface OrnnRecord {
  timestamp: string;
  index_value: number;
}

export interface OrnnApiResponse {
  success: boolean;
  gpu_type: string;
  access?: string;
  data: OrnnRecord[];
}

export interface IndexPrint {
  symbol: string;
  gpuClass: string; // bytes32 hex
  dayKey: bigint;
  priceE8: bigint;
  rawIndexValue: number;
  timestamp: string;
  encodedReport: string;
}

export const VerdictStatus = {
  NONE: 0,
  PASS: 1,
  DEGRADED: 2,
  FAIL: 3,
} as const;
export type VerdictStatus = (typeof VerdictStatus)[keyof typeof VerdictStatus];

export interface VerifierVerdict {
  deliveryId: number;
  verdict: VerdictStatus;
  verdictName: string;
  tflopsE2: number;
  resultRoot: string;
  signature?: string;
  timestamp?: number;
}

export interface SettlementReport {
  deliveryId: bigint;
  verdict: VerdictStatus;
  tflopsE2: number;
  resultRoot: string; // bytes32 hex
  encodedReport: string;
}
