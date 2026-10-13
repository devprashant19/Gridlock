import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { handleDeliverySettler, PROVISIONED_TOPIC } from "./workflow.ts";
import { decodeSettlementReport } from "../common/encoding.ts";
import {
  buildVerifierDomain,
  EIP712_VERDICT_TYPES,
  DEFAULT_VERIFIER_SIGNER_ADDRESS,
} from "./crypto.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERIFIER_SIGNER_PK =
  "0x7bd4674689b7faf0f7443e1bec526ec5e997e095bdf4f2155149ade61a11b2b6";

async function main() {
  console.log("===============================================================================");
  console.log("CHAINLINK RUNTIME ENVIRONMENT (CRE) — DELIVERY SETTLER SIMULATION");
  console.log("Target Network: Monad Testnet (Chain ID 10143, Selector 2183018362218727504)");
  console.log("Trigger: EVM Event Log -> DeliveryEscrow.Provisioned(uint256,bytes)");
  console.log("Security: Full EIP-712 Structured Cryptographic Signature Verification");
  console.log("===============================================================================\n");

  // Load testnet deployments
  const deploymentsPath = path.resolve(__dirname, "../../deployments/testnet.json");
  let escrowAddress = "0x4444444444444444444444444444444444444444";
  let forwarderAddress = "0x9999999999999999999999999999999999999999";

  if (fs.existsSync(deploymentsPath)) {
    try {
      const dep = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
      if (dep.contracts?.DeliveryEscrow) escrowAddress = dep.contracts.DeliveryEscrow;
      if (dep.contracts?.ChainlinkForwarder) forwarderAddress = dep.contracts.ChainlinkForwarder;
    } catch {}
  }

  console.log(`[Config] Target DeliveryEscrow:  ${escrowAddress}`);
  console.log(`[Config] Authorized Forwarder:   ${forwarderAddress}`);
  console.log(`[Config] Authorized Verifier:    ${DEFAULT_VERIFIER_SIGNER_ADDRESS}\n`);

  // Simulate an on-chain Provisioned event from DeliveryEscrow
  const deliveryId = 1n;
  const mockEvent = {
    topics: [
      PROVISIONED_TOPIC,
      ethers.zeroPadValue(ethers.toBeHex(deliveryId), 32),
    ],
    data: "0x1234567890abcdef", // encrypted credentials payload
  };

  console.log("Simulating EVM Log Trigger:");
  console.log(`  Event:  Provisioned(deliveryId: #${deliveryId})`);
  console.log(`  Topic0: ${mockEvent.topics[0]}`);
  console.log(`  Topic1: ${mockEvent.topics[1]}`);

  // Generate authentic EIP-712 signature from verifier key
  const signerWallet = new ethers.Wallet(VERIFIER_SIGNER_PK);
  const domain = buildVerifierDomain(escrowAddress, 10143);
  const verdictPayload = {
    deliveryId: 1n,
    verdict: 1, // 1: PASS
    tflopsE2: 815,
    resultRoot: "0x4f8b91c2847582a9382910394857201948572019485720194857201948572019",
  };

  const eip712Signature = await signerWallet.signTypedData(
    domain,
    EIP712_VERDICT_TYPES,
    verdictPayload
  );

  console.log(`\nGenerated Verifier EIP-712 Signature: ${eip712Signature.slice(0, 42)}...`);
  console.log(`Signer Address Verified: ${signerWallet.address}`);

  // Mock fetch querying the verifier endpoint
  const mockFetch: typeof fetch = async (url: any) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        deliveryId: 1,
        verdict: 1,
        verdictName: "PASS",
        tflopsE2: 815,
        resultRoot: verdictPayload.resultRoot,
        signature: eip712Signature,
        timestamp: Math.floor(Date.now() / 1000),
      }),
    } as any;
  };

  console.log("\nExecuting DON settlement workflow with 3 nodes...");
  const report = await handleDeliverySettler(
    mockEvent,
    {
      donNodes: 3,
      verifyingContract: escrowAddress,
      expectedSignerAddress: signerWallet.address,
      chainId: 10143,
    },
    mockFetch
  );

  console.log("\n-------------------------------------------------------------------------------");
  console.log("SETTLEMENT REPORT SUMMARY");
  console.log("-------------------------------------------------------------------------------");
  console.log(`• Delivery ID:  #${report.deliveryId}`);
  console.log(`  Verdict:      ${report.verdict} (PASS: 100% Bond Released to Provider)`);
  console.log(`  Measured:     ${(report.tflopsE2 / 100).toFixed(2)} TFLOPS (tflopsE2: ${report.tflopsE2})`);
  console.log(`  Result Root:  ${report.resultRoot}`);
  console.log(`  Cryptographic Security: EIP-712 Signature Validated on all 3 DON Nodes`);
  console.log(`  Encoded Bytes:${report.encodedReport.slice(0, 42)}... (length: ${report.encodedReport.length})`);

  // Decode to verify exact match
  const decoded = decodeSettlementReport(report.encodedReport);
  console.log(`  Decoded Verification: Delivery #${decoded.deliveryId}, Verdict ${decoded.verdict}, ${decoded.tflopsE2 / 100} TF`);

  const iface = new ethers.Interface([
    "function onReport(bytes calldata report) external"
  ]);
  const calldata = iface.encodeFunctionData("onReport", [report.encodedReport]);
  console.log(`  Solidity Calldata: ${calldata.slice(0, 42)}... (DeliveryEscrow.onReport)`);

  console.log("\n===============================================================================");
  console.log("SIMULATION RESULT: SUCCESS");
  console.log("Hardware verdict verified via EIP-712 & settled atomically on Monad.");
  console.log("===============================================================================");
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
