import { spawn } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// gridlock verify --delivery <id> --class "H100 SXM"
async function main() {
  const deliveryId = process.argv[2] || "1";
  const gpuClass = process.argv[3] || "T4";
  const apiUrl = process.env.VERIFIER_API_URL || "http://localhost:8000";

  console.log(`Running in-pod verification for delivery #${deliveryId} (${gpuClass})...`);

  const verifierScript = path.resolve(__dirname, "../../../verifier/cli/main.py");
  const proc = spawn("python", [verifierScript, "--api", apiUrl, "--delivery", deliveryId, "--gpu-class", gpuClass], {
    stdio: "inherit",
  });

  proc.on("close", (code) => {
    if (code === 0) {
      console.log("\n[Gridlock] Verification completed successfully.");
    } else {
      console.error(`\n[Gridlock] Verification failed with exit code ${code}`);
      process.exit(code || 1);
    }
  });
}

main().catch(console.error);
