import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const rpcUrl = process.env.MONAD_RPC || "https://testnet-rpc.monad.xyz";
  const providerPk = process.env.PROVIDER_PK;
  const buyerPk = process.env.BUYER_PK;

  if (!providerPk || !buyerPk) {
    console.error("Missing PROVIDER_PK or BUYER_PK in .env");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const providerSigner = new ethers.Wallet(providerPk, provider);
  const buyerSigner = new ethers.Wallet(buyerPk, provider);

  console.log(`Provider: ${providerSigner.address}`);
  console.log(`Buyer: ${buyerSigner.address}`);

  const deployments = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../deployments/testnet.json"), "utf-8"));

  // 1. Provider calls GridUSD.faucet() -> Escrow.mint() -> deposits into Kuru MarginAccount
  // 2. Posts limit asks (+2%, +4%, +6%, +8% over index)
  // 3. Buyer posts limit bids (-3% below index)
  console.log("Seeding order book ladder...");
}

main().catch(console.error);
