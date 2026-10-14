// Seeds every Kuru book so the demo has depth:
//   provider: register -> faucet -> post 120% bond + mint HourTokens -> margin deposit -> asks
//             at +2/+4/+6/+8% over the IndexOracle print
//   buyer (optional BUYER_PK): faucet -> margin deposit gUSD -> bids at -3/-5%
// Re-running mints and posts another ladder; skip a side with SEED_ASKS=0 / SEED_BIDS=0.
import { ethers } from "ethers";
import { GTC, MarginDeposit, ParamFetcher } from "@kuru-labs/kuru-sdk";
import { ABI, KURU_MARGIN_ACCOUNT, provider, readDeployments, snap, wallet } from "./common";

const HOURS: Record<string, number> = { "gT4-NOW": 40 };
const DEFAULT_HOURS = 12;
const ASK_LEVELS = [1.02, 1.04, 1.06, 1.08];
const BID_LEVELS = [0.97, 0.95];

async function ensureFaucet(w: ethers.Wallet, gusd: ethers.Contract, need: ethers.BigNumber) {
  const bal: ethers.BigNumber = await gusd.balanceOf(w.address);
  if (bal.gte(need)) return;
  try {
    await (await gusd.connect(w).faucet()).wait();
    console.log(`  faucet -> ${w.address}`);
  } catch (e) {
    console.warn(`  faucet skipped for ${w.address} (rate limited?)`);
  }
}

async function main() {
  const p = provider();
  const dep = readDeployments();
  if (!dep.series || !Object.keys(dep.series).length) throw new Error("No series in deployments; run deploy-markets first");
  const prov = wallet("PROVIDER_PK", p);
  const buyer = process.env.BUYER_PK ? wallet("BUYER_PK", p) : undefined;

  const gusd = new ethers.Contract(dep.contracts.GridUSD, ABI.erc20, p);
  const oracle = new ethers.Contract(dep.contracts.IndexOracle, ABI.oracle, p);
  const escrow = new ethers.Contract(dep.contracts.DeliveryEscrow, ABI.escrow, prov);

  const [, registered] = await escrow.providers(prov.address);
  if (!registered) {
    await (await escrow.registerProvider(process.env.PROVIDER_NAME ?? "Gridlock-Genesis-Node")).wait();
    console.log(`Registered provider ${prov.address}`);
  }
  await ensureFaucet(prov, gusd, ethers.utils.parseUnits("200", 6));
  if (buyer) await ensureFaucet(buyer, gusd, ethers.utils.parseUnits("100", 6));

  for (const [symbol, s] of Object.entries(dep.series)) {
    if (!s.kuruMarket) continue;
    const [priceE8] = await oracle.latest(s.gpuClass);
    const index = Number(priceE8) / 1e8;
    const params = await ParamFetcher.getMarketParams(p, s.kuruMarket);
    const hours = HOURS[symbol] ?? DEFAULT_HOURS;
    console.log(`${symbol}: index $${index.toFixed(3)}, market ${s.kuruMarket}`);

    if (process.env.SEED_ASKS !== "0") {
      const bond = ethers.BigNumber.from(hours).mul(priceE8).mul(120).div(10000);
      await (await gusd.connect(prov).approve(dep.contracts.DeliveryEscrow, bond)).wait();
      await (await escrow.mint(s.seriesId, hours)).wait();
      console.log(`  minted ${hours}h (bond ${ethers.utils.formatUnits(bond, 6)} gUSD)`);

      // keep 25% off-book so a buyer redeeming straight from the provider still works
      const onBook = Math.floor(hours * 0.75);
      const per = Math.max(1, Math.floor(onBook / ASK_LEVELS.length));
      await MarginDeposit.deposit(prov, KURU_MARGIN_ACCOUNT, prov.address, s.token, String(per * ASK_LEVELS.length), 18, true);
      for (const m of ASK_LEVELS) {
        await GTC.placeLimit(prov, s.kuruMarket, params, { price: snap(index * m), size: String(per), isBuy: false, postOnly: true });
      }
      console.log(`  asks: ${ASK_LEVELS.map((m) => `${per}h@${snap(index * m)}`).join(", ")}`);
    }

    if (buyer && process.env.SEED_BIDS !== "0") {
      const size = 2;
      const quote = BID_LEVELS.reduce((a, m) => a + Number(snap(index * m)) * size, 0) * 1.01;
      await MarginDeposit.deposit(buyer, KURU_MARGIN_ACCOUNT, buyer.address, dep.contracts.GridUSD, quote.toFixed(6), 6, true);
      for (const m of BID_LEVELS) {
        await GTC.placeLimit(buyer, s.kuruMarket, params, { price: snap(index * m), size: String(size), isBuy: true, postOnly: true });
      }
      console.log(`  bids: ${BID_LEVELS.map((m) => `${size}h@${snap(index * m)}`).join(", ")}`);
    }
  }
  console.log("Ladder seeded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
