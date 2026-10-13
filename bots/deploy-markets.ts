import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Reads deployments/testnet.json and deploys Kuru markets for series
async function main() {
  const rpcUrl = process.env.MONAD_RPC || "https://testnet-rpc.monad.xyz";
  const deployerPk = process.env.DEPLOYER_PK;

  if (!deployerPk) {
    console.error("Missing DEPLOYER_PK in .env");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(deployerPk, provider);
  console.log(`Using deployer: ${signer.address}`);

  const deploymentsPath = path.resolve(__dirname, "../deployments/testnet.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));

  console.log("Deploying Kuru markets for series...");
  // Iterates series and deploys using Kuru SDK ParamCreator & deployMarket
  // Updates deployments/testnet.json with kuruMarket addresses
}

main().catch(console.error);
