export enum DeliveryStatus {
  None = 0,
  Requested = 1,
  Provisioned = 2,
  Settled = 3,
  TimedOut = 4,
}

export enum VerdictStatus {
  None = 0,
  Pass = 1,
  Degraded = 2,
  Fail = 3,
}

export interface Series {
  id: string;
  symbol: string;
  gpuClass: `0x${string}`;
  token: `0x${string}`;
  windowStart: number;
  windowEnd: number;
  marketAddress?: `0x${string}`;
  openHours?: bigint;
  lastPrice?: bigint;
}

export interface Delivery {
  id: string;
  seriesId: string;
  buyer: `0x${string}`;
  provider: `0x${string}`;
  hours: bigint;
  buyerEncPubKey: `0x${string}`;
  deadline: number;
  status: DeliveryStatus;
  provisionedAt?: number;
  ciphertext?: `0x${string}`;
  verdict?: VerdictStatus;
  tflopsE2?: number;
  resultRoot?: `0x${string}`;
}

export interface CredentialPayload {
  host: string;
  port: number;
  username: string;
  authType: 'ssh-key' | 'password';
  keyOrPassword: string;
  gpuCount: number;
  gpuClass: string;
}

export interface VerifierChallengeRequest {
  deliveryId: number;
  gpuClass: string;
}

export interface VerifierChallengeResponse {
  deliveryId: number;
  seed: number;
  n: number;
  steps: number;
  deadlineMs: number;
}

export interface VerifierCommitRequest {
  deliveryId: number;
  root: `0x${string}`;
  tflops: number;
  sm: number;
  device: string;
}

export interface VerifierCommitResponse {
  deliveryId: number;
  sampleIndices: number[];
}

export interface VerifierRevealRequest {
  deliveryId: number;
  rows: Array<{
    index: number;
    data: `0x${string}`;
  }>;
  proofs: Array<`0x${string}`[]>;
}

export interface VerifierVerdictResponse {
  deliveryId: number;
  verdict: VerdictStatus;
  verdictName: 'PASS' | 'DEGRADED' | 'FAIL';
  tflopsE2: number;
  resultRoot: `0x${string}`;
  signature: `0x${string}`;
  timestamp?: number;
}

export interface DeploymentAddresses {
  chainId: number;
  gridUSD: `0x${string}`;
  indexOracle: `0x${string}`;
  seriesFactory: `0x${string}`;
  deliveryEscrow: `0x${string}`;
  verifierSigner: `0x${string}`;
  kuruRouter: `0x${string}`;
  series: {
    [symbol: string]: {
      id: number;
      token: `0x${string}`;
      kuruMarket?: `0x${string}`;
    };
  };
}
