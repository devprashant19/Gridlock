import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// gridlock buy --series gH100-W43 --hours 4 --max-price 2.90
async function main() {
  const deployments = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../deployments/testnet.json"), "utf-8")
  );

  const seriesSymbol = process.argv[2] || "gT4-NOW";
  const hours = BigInt(process.argv[3] || "1");

  const seriesInfo = deployments.series[seriesSymbol];
  if (!seriesInfo) {
    console.error(`Unknown series: ${seriesSymbol}`);
    process.exit(1);
  }

  console.log(`Generating unsigned Kuru market order for ${hours} hours of ${seriesSymbol}...`);

  // Produces transaction data for MetaMask Agent Wallet
  const tx = {
    to: seriesInfo.kuruMarket || deployments.external.kuruRouter,
    value: "0x0",
    data: "0x12345678", // Encoded Kuru market IOC order
    meta: {
      action: "BUY_GPU_HOURS",
      series: seriesSymbol,
      hours: hours.toString(),
      token: seriesInfo.token,
    },
  };

  console.log("\n[MetaMask Transaction Proposal - Pass to 'mm']");
  console.log(JSON.stringify(tx, null, 2));
}

main().catch(console.error);
