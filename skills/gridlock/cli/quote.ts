import * as path from "path";
import * as fs from "fs";

// gridlock quote --class "H100 SXM"
async function main() {
  const deployments = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../../deployments/testnet.json"), "utf-8")
  );

  console.log("=== Gridlock Forward Compute Quotes (Monad Testnet) ===");
  for (const [symbol, info] of Object.entries(deployments.series as Record<string, any>)) {
    const start = new Date(info.windowStart * 1000).toISOString().split("T")[0];
    const end = new Date(info.windowEnd * 1000).toISOString().split("T")[0];
    console.log(`\nSeries: ${symbol}`);
    console.log(`  Delivery Window: ${start} -> ${end}`);
    console.log(`  Token: ${info.token}`);
    console.log(`  Kuru Market: ${info.kuruMarket || "Deploying"}`);
  }
}

main().catch(console.error);
