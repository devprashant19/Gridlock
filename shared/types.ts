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

export interface SeriesDeploymentInfo {
  id: number;
  seriesId: number;
  gpuClass?: `0x${string}`;
  token: `0x${string}`;
  kuruMarket?: `0x${string}`;
  windowStart: number;
  windowEnd: number;
}

export interface DeploymentAddresses {
  chainId: number;
  network?: string;
  deployBlock?: number;
  gridUSD: `0x${string}`;
  indexOracle: `0x${string}`;
  seriesFactory: `0x${string}`;
  deliveryEscrow: `0x${string}`;
  verifierSigner: `0x${string}`;
  kuruRouter: `0x${string}`;
  contracts: {
    GridUSD: `0x${string}`;
    IndexOracle: `0x${string}`;
    SeriesFactory: `0x${string}`;
    DeliveryEscrow: `0x${string}`;
  };
  external: {
    kuruRouter: `0x${string}`;
    verifierSigner: `0x${string}`;
    creForwarder?: `0x${string}`;
  };
  series: {
    [symbol: string]: SeriesDeploymentInfo;
  };
}

/**
 * Validates and canonicalizes deployment JSON metadata against DeploymentAddresses schema.
 */
export function parseDeploymentAddresses(raw: any): DeploymentAddresses {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid deployment metadata: expected object");
  }

  const contracts = raw.contracts || {};
  const external = raw.external || {};

  const gridUSD = (raw.gridUSD || contracts.GridUSD) as `0x${string}`;
  const indexOracle = (raw.indexOracle || contracts.IndexOracle) as `0x${string}`;
  const seriesFactory = (raw.seriesFactory || contracts.SeriesFactory) as `0x${string}`;
  const deliveryEscrow = (raw.deliveryEscrow || contracts.DeliveryEscrow) as `0x${string}`;
  const verifierSigner = (raw.verifierSigner || external.verifierSigner) as `0x${string}`;
  const kuruRouter = (raw.kuruRouter || external.kuruRouter) as `0x${string}`;

  if (!gridUSD || !indexOracle || !seriesFactory || !deliveryEscrow) {
    throw new Error("Missing required core contract addresses");
  }

  const normalizedSeries: { [symbol: string]: SeriesDeploymentInfo } = {};
  if (raw.series && typeof raw.series === "object") {
    for (const [symbol, info] of Object.entries(raw.series as Record<string, any>)) {
      const id = Number(info.seriesId ?? info.id ?? 0);
      normalizedSeries[symbol] = {
        id,
        seriesId: id,
        gpuClass: info.gpuClass,
        token: info.token,
        kuruMarket: info.kuruMarket,
        windowStart: Number(info.windowStart ?? 0),
        windowEnd: Number(info.windowEnd ?? 0),
      };
    }
  }

  return {
    chainId: Number(raw.chainId || 10143),
    network: raw.network || "monad-testnet",
    deployBlock: Number(raw.deployBlock || 0),
    gridUSD,
    indexOracle,
    seriesFactory,
    deliveryEscrow,
    verifierSigner,
    kuruRouter,
    contracts: {
      GridUSD: gridUSD,
      IndexOracle: indexOracle,
      SeriesFactory: seriesFactory,
      DeliveryEscrow: deliveryEscrow,
    },
    external: {
      kuruRouter,
      verifierSigner,
      creForwarder: external.creForwarder,
    },
    series: normalizedSeries,
  };
}

