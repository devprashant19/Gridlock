import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

export const DEPLOYMENTS = path.resolve(__dirname, process.env.DEPLOYMENTS ?? "../deployments/testnet.json");
export const KURU_ROUTER = process.env.KURU_ROUTER ?? "0x7EFbE105Ca7415dE98F96622173458ac1c054630";
export const KURU_MARGIN_ACCOUNT = process.env.KURU_MARGIN_ACCOUNT ?? "0xd029C2D98ff85D8F64799017fE00a59B1159CE02";

export function provider() {
  const rpc = process.env.MONAD_RPC ?? "https://testnet-rpc.monad.xyz";
  return new ethers.providers.StaticJsonRpcProvider(rpc, { chainId: Number(process.env.MONAD_CHAIN_ID ?? 10143), name: "monad" });
}

export function wallet(envName: string, p = provider()) {
  const pk = process.env[envName];
  if (!pk) throw new Error(`Missing ${envName} in .env`);
  return new ethers.Wallet(pk, p);
}

export type SeriesEntry = {
  seriesId: number;
  gpuClass: string;
  token: string;
  kuruMarket?: string;
  windowStart: number;
  windowEnd: number;
};

export type Deployments = {
  chainId: number;
  network?: string;
  deployBlock?: number;
  contracts: { GridUSD: string; IndexOracle: string; SeriesFactory: string; DeliveryEscrow: string };
  external: Record<string, string>;
  series?: Record<string, SeriesEntry>;
};

export const readDeployments = (): Deployments => JSON.parse(fs.readFileSync(DEPLOYMENTS, "utf8"));
export const writeDeployments = (d: Deployments) => fs.writeFileSync(DEPLOYMENTS, JSON.stringify(d, null, 2) + "\n");

export const ABI = {
  erc20: [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function faucet()",
  ],
  factory: [
    "function seriesCount() view returns (uint256)",
    "function series(uint256) view returns (bytes32 gpuClass, address token, uint64 windowStart, uint64 windowEnd, string symbol)",
  ],
  oracle: ["function latest(bytes32) view returns (uint128 priceE8, uint64 dayKey)"],
  escrow: [
    "function registerProvider(string name)",
    "function providers(address) view returns (string name, bool registered)",
    "function mint(uint256 seriesId, uint256 hours_) returns (uint256)",
    "function openHours(uint256, address) view returns (uint256)",
  ],
};

/** Kuru prices must be a multiple of the tick (0.001 gUSD with the params below). */
export const snap = (price: number) => (Math.round(price * 1000) / 1000).toFixed(3);

/**
 * Market params for every gUSD-quoted HourToken book: price precision 1e5, tick 100 (= 0.001 gUSD),
 * size precision 1e6, min size 0.01 h. Market type 0 = ERC20/ERC20 (1/2 are native-asset markets).
 */
export const MARKET = {
  type: 0,
  sizePrecision: ethers.BigNumber.from(1_000_000),
  pricePrecision: ethers.BigNumber.from(100_000),
  tickSize: ethers.BigNumber.from(100),
  minSize: ethers.BigNumber.from(10_000),
  maxSize: ethers.BigNumber.from("100000000000"),
  takerFeeBps: 30,
  makerFeeBps: 10,
  ammSpread: ethers.BigNumber.from(100),
};
