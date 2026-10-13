import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { encodeKuruBuyCalldata } from "./calldata.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// gridlock buy --series gH100-W43 --hours 4 --max-price 2.90
async function main() {
  const deployments = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../deployments/testnet.json"), "utf-8")
  );
  const classesData = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../shared/classes.json"), "utf-8")
  ).classes;

  const seriesSymbol = process.argv[2] || "gT4-NOW";
  const hours = BigInt(process.argv[3] || "1");
  const maxPriceUsd = parseFloat(process.argv[4] || "0.40");

  const seriesInfo = deployments.series[seriesSymbol];
  if (!seriesInfo) {
    console.error(`Unknown series: ${seriesSymbol}`);
    process.exit(1);
  }

  // Guard Mode: Slippage & Budget Cap Protection
  const className = seriesSymbol.includes("T4") ? "T4" : seriesSymbol.includes("A100") ? "A100 SXM4" : "H100 SXM";
  const refPrice = classesData[className]?.referencePriceUsd || 0.35;
  const premiumPct = ((maxPriceUsd - refPrice) / refPrice) * 100;

  console.log(`[Gridlock Guard Mode] Evaluating forward order for ${hours} hours of ${seriesSymbol}...`);
  console.log(`  Reference Spot: $${refPrice.toFixed(2)} / hr | Max Bid: $${maxPriceUsd.toFixed(2)} / hr (Premium: ${premiumPct.toFixed(1)}%)`);

  if (premiumPct > 15.0) {
    console.warn(`[WARNING: Guard Mode] Max price exceeds reference spot by >15%. Ensure human approval before broadcast.`);
  }

  const maxPriceE6 = BigInt(Math.round(maxPriceUsd * 1e6));
  const marketAddress = seriesInfo.kuruMarket || deployments.external.kuruRouter;
  const calldata = encodeKuruBuyCalldata(marketAddress, hours, maxPriceE6);

  // Produces transaction data for MetaMask Agent Wallet
  const tx = {
    to: marketAddress,
    value: "0x0",
    data: calldata,
    meta: {
      action: "BUY_GPU_HOURS",
      series: seriesSymbol,
      hours: hours.toString(),
      maxPrice: maxPriceUsd,
      token: seriesInfo.token,
      guardApproved: premiumPct <= 15.0,
    },
  };

  console.log("\n[MetaMask Transaction Proposal - Send with 'mm tx send']");
  console.log(JSON.stringify(tx, null, 2));
}

main().catch(console.error);
