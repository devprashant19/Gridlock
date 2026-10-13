import { ethers } from "ethers";
import {
  computeGpuClassHash,
  computeDayKey,
  computePriceE8,
  encodeIndexReport,
  encodeSettlementReport,
} from "../common/encoding.ts";

/**
 * Mock Forwarder Utility for Local / Testnet Contract Developers (Stream A)
 */
async function main() {
  const args = process.argv.slice(2);
  const type = args[0] || "--help";

  if (type === "--help" || type === "-h") {
    console.log("Gridlock Mock Forwarder Harness (Stream A Contract Integration)");
    console.log("\nUsage:");
    console.log("  node --experimental-strip-types cre/mocks/mock_forwarder.ts index <symbol> <usdPrice>");
    console.log("  node --experimental-strip-types cre/mocks/mock_forwarder.ts settle <deliveryId> <verdict> <tflops>");
    console.log("\nExamples:");
    console.log("  node --experimental-strip-types cre/mocks/mock_forwarder.ts index 'H100 SXM' 2.92");
    console.log("  node --experimental-strip-types cre/mocks/mock_forwarder.ts settle 1 PASS 8.15");
    return;
  }

  if (type === "index") {
    const symbol = args[1] || "H100 SXM";
    const priceUsd = parseFloat(args[2] || "2.92");
    const gpuClass = computeGpuClassHash(symbol);
    const dayKey = computeDayKey(Date.now());
    const priceE8 = computePriceE8(priceUsd);
    const reportBytes = encodeIndexReport(gpuClass, dayKey, priceE8);

    const iface = new ethers.Interface(["function onReport(bytes calldata report) external"]);
    const calldata = iface.encodeFunctionData("onReport", [reportBytes]);

    console.log("\n[Mock Forwarder -> IndexOracle.onReport]");
    console.log(`Symbol:       ${symbol}`);
    console.log(`GPU Class:    ${gpuClass}`);
    console.log(`DayKey:       ${dayKey}`);
    console.log(`PriceE8:      ${priceE8} ($${priceUsd.toFixed(2)}/hr)`);
    console.log(`Report Bytes: ${reportBytes}`);
    console.log(`Calldata:     ${calldata}`);
    return;
  }

  if (type === "settle") {
    const deliveryId = BigInt(args[1] || "1");
    const verdictName = (args[2] || "PASS").toUpperCase();
    const verdict = verdictName === "PASS" ? 1 : verdictName === "DEGRADED" ? 2 : 3;
    const tflops = parseFloat(args[3] || "8.15");
    const tflopsE2 = Math.round(tflops * 100);
    const resultRoot = "0x" + "4f8b91c2847582a93829103948572019".padEnd(64, "0");

    const reportBytes = encodeSettlementReport(deliveryId, verdict, tflopsE2, resultRoot);
    const iface = new ethers.Interface(["function onReport(bytes calldata report) external"]);
    const calldata = iface.encodeFunctionData("onReport", [reportBytes]);

    console.log("\n[Mock Forwarder -> DeliveryEscrow.onReport]");
    console.log(`Delivery ID:  #${deliveryId}`);
    console.log(`Verdict:      ${verdict} (${verdictName})`);
    console.log(`TFLOPS:       ${tflops} (tflopsE2: ${tflopsE2})`);
    console.log(`Result Root:  ${resultRoot}`);
    console.log(`Report Bytes: ${reportBytes}`);
    console.log(`Calldata:     ${calldata}`);
    return;
  }

  console.error(`Unknown command: ${type}. Run with --help for usage.`);
}

main().catch(console.error);
