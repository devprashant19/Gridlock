import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// gridlock redeem --series gT4-NOW --hours 1
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

  // Generates dummy/agent buyerEncPubKey bytes32
  const dummyPubKey = "0x" + "aa".repeat(32);

  const tx = {
    to: deployments.contracts.DeliveryEscrow,
    value: "0x0",
    data: "0x...", // Encoded DeliveryEscrow.redeem(seriesId, hours, buyerEncPubKey)
    meta: {
      action: "REDEEM_GPU_HOURS",
      series: seriesSymbol,
      seriesId: seriesInfo.seriesId,
      hours: hours.toString(),
      buyerEncPubKey: dummyPubKey,
    },
  };

  console.log("\n[MetaMask Transaction Proposal - Pass to 'mm']");
  console.log(JSON.stringify(tx, null, 2));
}

main().catch(console.error);
