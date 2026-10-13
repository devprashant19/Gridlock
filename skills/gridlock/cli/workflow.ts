import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { encodeKuruBuyCalldata, encodeRedeemCalldata } from "./calldata.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// gridlock workflow --series gT4-NOW --hours 1
async function main() {
  const deployments = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../deployments/testnet.json"), "utf-8")
  );
  const classesData = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../shared/classes.json"), "utf-8")
  ).classes;

  const seriesSymbol = process.argv[2] || "gT4-NOW";
  const hours = BigInt(process.argv[3] || "1");
  const seriesInfo = deployments.series[seriesSymbol];

  if (!seriesInfo) {
    console.error(`Unknown series: ${seriesSymbol}`);
    process.exit(1);
  }

  const className = seriesSymbol.includes("T4") ? "T4" : seriesSymbol.includes("A100") ? "A100 SXM4" : "H100 SXM";
  const refPrice = classesData[className]?.referencePriceUsd || 0.35;
  const estCost = Number(hours) * refPrice;

  console.log("=============================================================");
  console.log("GRIDLOCK AUTONOMOUS AGENT COMPUTE WORKFLOW");
  console.log("=============================================================");
  console.log(`Target: ${hours} Hours of ${seriesSymbol} (${className})`);
  console.log(`Estimated Budget: $${estCost.toFixed(2)} USD (Ref Spot: $${refPrice.toFixed(2)}/hr)`);
  console.log("-------------------------------------------------------------");

  // Step 1: Buy Calldata
  const marketAddress = seriesInfo.kuruMarket || deployments.external.kuruRouter;
  const buyCalldata = encodeKuruBuyCalldata(marketAddress, hours, BigInt(Math.round(refPrice * 1e6)));
  console.log("\n[Step 1: Kuru Order Book Buy]");
  console.log(`  To:   ${marketAddress}`);
  console.log(`  Data: ${buyCalldata}`);

  // Step 2: Redeem Calldata
  const dummyPubKey = "0x" + "aa".repeat(32);
  const redeemCalldata = encodeRedeemCalldata(seriesInfo.seriesId, hours, dummyPubKey);
  console.log("\n[Step 2: DeliveryEscrow Redeem]");
  console.log(`  To:   ${deployments.contracts.DeliveryEscrow}`);
  console.log(`  Data: ${redeemCalldata}`);

  // Step 3: In-Pod Verification Command
  console.log("\n[Step 3: In-Pod Verification Command]");
  console.log(`  gridlock verify --delivery <id> --class "${className}"`);
  console.log("=============================================================");
}

main().catch(console.error);
