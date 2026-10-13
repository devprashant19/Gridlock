// Demo data served while deployments/testnet.json still has placeholder addresses,
// so every page renders before Stream A deploys. Never used once IS_MOCK is false.
import type { Address, Hex } from "viem";
import { GPU_CLASSES, SERIES } from "./config";
import type { DeliveryView, LeaderRow } from "./data";

const now = () => Math.floor(Date.now() / 1000);
const P1 = "0x00000000000000000000000000000000000000a1" as Address;
const P2 = "0x00000000000000000000000000000000000000a2" as Address;
const B1 = "0x00000000000000000000000000000000000000b1" as Address;
const Z32 = `0x${"00".repeat(32)}` as Hex;

export const demoIndex = () =>
  Object.fromEntries(Object.entries(GPU_CLASSES).map(([k, c]) => [k, { priceE8: BigInt(c.priceE8), dayKey: BigInt(now()) }]));

export const demoLastPrice = (symbol: string) => {
  const s = SERIES.find((x) => x.symbol === symbol);
  const ref = s ? GPU_CLASSES[s.className]?.referencePriceUsd ?? 1 : 1;
  const premium = 1 + 0.03 * SERIES.findIndex((x) => x.symbol === symbol);
  return +(ref * premium).toFixed(3);
};

export const demoBook = (symbol: string) => {
  const mid = demoLastPrice(symbol);
  const tick = +(mid * 0.01).toFixed(3) || 0.001;
  return {
    asks: [1, 2, 3, 4, 5].map((i) => [+(mid + tick * i).toFixed(4), 4 * i] as [number, number]),
    bids: [1, 2, 3, 4, 5].map((i) => [+(mid - tick * i).toFixed(4), 3 * i] as [number, number]),
    blockNumber: 0,
  };
};

export const demoDeliveries = (): DeliveryView[] => [
  { id: 0, seriesId: SERIES[0]?.seriesId ?? 1, buyer: B1, provider: P1, hours: 1n, buyerEncPubKey: Z32, deadline: now() + 5400, provisionedAt: now() - 600, bondAmount: 420_000n, status: 2, ciphertext: "0x4a9b21f83c7e0981d390a78b5c42e18d9f00128ac78b6540e1d89b128540c98f7e21a8c9b3d0e5124b8932ef10a7204891b2c4e6a8d01934", verdict: 0, tflopsE2: 0, resultRoot: Z32 },
  { id: 1, seriesId: SERIES[0]?.seriesId ?? 1, buyer: B1, provider: P2, hours: 2n, buyerEncPubKey: Z32, deadline: now() - 100, provisionedAt: now() - 7200, bondAmount: 840_000n, status: 3, ciphertext: "0x4a9b21f83c7e0981d390a78b5c42e18d9f00128ac78b6540e1d89b128540c98f7e21a8c9b3d0e5124b8932ef10a7204891b2c4e6a8d01934", verdict: 3, tflopsE2: 212, resultRoot: Z32 },
];

export const demoLeaderboard = (): LeaderRow[] => [
  { address: P1, name: "HyperNode-Bangalore", minted: 160, passes: 24, degraded: 1, fails: 0, timeouts: 0, hoursDelivered: 142, slashed: 0, earned: 59.6 },
  { address: P2, name: "MonadGPU-Alpha", minted: 120, passes: 19, degraded: 0, fails: 0, timeouts: 0, hoursDelivered: 96, slashed: 0, earned: 40.3 },
  { address: "0x00000000000000000000000000000000000000a3", name: "FastCloud-Delhi", minted: 80, passes: 12, degraded: 3, fails: 1, timeouts: 0, hoursDelivered: 58, slashed: 4.2, earned: 22.1 },
  { address: "0x00000000000000000000000000000000000000a4", name: "Rogue-Compute", minted: 40, passes: 2, degraded: 1, fails: 4, timeouts: 1, hoursDelivered: 14, slashed: 16.8, earned: 3.1 },
];
