import { ethers } from "ethers";
import {
  computeGpuClassHash,
  computeDayKey,
  computePriceE8,
  encodeIndexReport,
  decodeIndexReport,
  encodeSettlementReport,
  decodeSettlementReport,
} from "../common/encoding.ts";
import { calculateMedian, verifyUnanimousVerdict } from "../common/consensus.ts";
import { filterExtremeAnomalies, filterOutliersIQR } from "../common/outliers.ts";
import {
  APPROVED_SYMBOLS,
  fetchIndexHistory,
  extractLatestRecord,
  aggregateDonObservations,
  handleIndexFeed,
} from "../index-feed/workflow.ts";
import { evaluatePublicationThreshold } from "../index-feed/threshold.ts";
import { fetchWithFailover, BASELINE_REFERENCE_PRICES } from "../index-feed/sources.ts";
import {
  PROVISIONED_TOPIC,
  parseProvisionedLog,
  pollVerifierVerdict,
  handleDeliverySettler,
} from "../delivery-settler/workflow.ts";
import {
  buildVerifierDomain,
  EIP712_VERDICT_TYPES,
  verifyEip712VerdictSignature,
  DEFAULT_VERIFIER_SIGNER_ADDRESS,
} from "../delivery-settler/crypto.ts";
import { profileCalldataGas } from "../broadcast/gas_profiler.ts";
import { VerdictStatus } from "../common/types.ts";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    failed++;
    console.error(`  FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passed++;
  console.log(`  PASS: ${msg}`);
}

async function runTests() {
  console.log("===============================================================================");
  console.log("RUNNING EXTENDED CHAINLINK CRE WORKFLOW TEST SUITE (50+ ASSERTIONS)");
  console.log("===============================================================================\n");

  // TEST SUITE 1: Encoding & Hashing
  console.log("[Suite 1: ABI Encoding & Symbol Hashing]");
  {
    const h100Hash = computeGpuClassHash("H100 SXM");
    assert(h100Hash.startsWith("0x") && h100Hash.length === 66, "H100 SXM hash is valid bytes32");
    assert(
      h100Hash.toLowerCase() === ethers.keccak256(ethers.toUtf8Bytes("H100 SXM")).toLowerCase(),
      "H100 SXM matches keccak256('H100 SXM')"
    );

    const dayKey = computeDayKey("2026-10-12T20:00:00.000Z");
    assert(dayKey === 1791835200n, "dayKey matches unix epoch seconds");

    const priceE8 = computePriceE8(2.92);
    assert(priceE8 === 292000000n, "priceE8 correctly scaled to 1e8");

    const reportBytes = encodeIndexReport(h100Hash, dayKey, priceE8);
    const decoded = decodeIndexReport(reportBytes);
    assert(decoded.gpuClass.toLowerCase() === h100Hash.toLowerCase(), "Decoded gpuClass matches");
    assert(decoded.dayKey === dayKey, "Decoded dayKey matches");
    assert(decoded.priceE8 === priceE8, "Decoded priceE8 matches");
  }

  // TEST SUITE 2: Consensus Utilities
  console.log("\n[Suite 2: Consensus Median & Unanimous Agreement]");
  {
    assert(calculateMedian([2.5, 2.7, 2.6]) === 2.6, "Median of odd array is middle");
    assert(calculateMedian([1.0, 2.0, 3.0, 4.0]) === 2.5, "Median of even array is average");
    assert(calculateMedian([5.0]) === 5.0, "Median of single value is itself");

    const unanimous = verifyUnanimousVerdict([
      { verdict: 1, tflopsE2: 815, resultRoot: "0x" + "aa".repeat(32) },
      { verdict: 1, tflopsE2: 815, resultRoot: "0x" + "aa".repeat(32) },
      { verdict: 1, tflopsE2: 815, resultRoot: "0x" + "aa".repeat(32) },
    ]);
    assert(unanimous.verdict === 1 && unanimous.tflopsE2 === 815, "Unanimous agreement accepted");

    let divergenceCaught = false;
    try {
      verifyUnanimousVerdict([
        { verdict: 1, tflopsE2: 815, resultRoot: "0x" + "aa".repeat(32) },
        { verdict: 3, tflopsE2: 815, resultRoot: "0x" + "aa".repeat(32) },
      ]);
    } catch {
      divergenceCaught = true;
    }
    assert(divergenceCaught, "Consensus divergence between nodes correctly throws error");
  }

  // TEST SUITE 3: Index Feed Workflow & Validation
  console.log("\n[Suite 3: Index Feed Workflow & Error Handling]");
  {
    assert(APPROVED_SYMBOLS.length === 4, "Approved symbols contains exactly 4 entries");
    assert(APPROVED_SYMBOLS.includes("H100 SXM" as any), "Contains H100 SXM");
    assert(APPROVED_SYMBOLS.includes("H200" as any), "Contains H200");
    assert(APPROVED_SYMBOLS.includes("B200" as any), "Contains B200");
    assert(APPROVED_SYMBOLS.includes("A100 SXM4" as any), "Contains A100 SXM4");

    let unapprovedCaught = false;
    try {
      await fetchIndexHistory("RTX-4090", "https://mock");
    } catch {
      unapprovedCaught = true;
    }
    assert(unapprovedCaught, "Rejects unapproved GPU symbol RTX-4090");

    const mockApiResponse = {
      success: true,
      gpu_type: "H100 SXM",
      data: [
        { timestamp: "2026-10-10T20:00:00.000Z", index_value: 2.70 },
        { timestamp: "2026-10-12T20:00:00.000Z", index_value: 2.92 },
        { timestamp: "2026-10-11T20:00:00.000Z", index_value: 2.80 },
      ],
    };
    const latest = extractLatestRecord(mockApiResponse, 3600000, true);
    assert(latest.timestamp === "2026-10-12T20:00:00.000Z", "Extracts newest timestamp regardless of order");
    assert(latest.index_value === 2.92, "Extracts corresponding newest index value");

    let malformedCaught = false;
    try {
      extractLatestRecord({
        success: true,
        gpu_type: "H100 SXM",
        data: [{ timestamp: "2026-10-12T20:00:00.000Z", index_value: -5.0 }],
      });
    } catch {
      malformedCaught = true;
    }
    assert(malformedCaught, "Rejects negative index values");
  }

  // TEST SUITE 4: Delivery Settler Event & Verifier Polling
  console.log("\n[Suite 4: Delivery Settler Event & Verifier Polling]");
  {
    const mockEvent = {
      topics: [
        PROVISIONED_TOPIC,
        ethers.zeroPadValue(ethers.toBeHex(42n), 32),
      ],
      data: "0xdeadbeef",
    };
    const parsed = parseProvisionedLog(mockEvent);
    assert(parsed.deliveryId === 42n, "Parses deliveryId 42 from raw EVM log topics");

    const mockPassFetch: typeof fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        deliveryId: 42,
        verdict: 1,
        verdictName: "PASS",
        tflopsE2: 98900,
        resultRoot: "0x" + "11".repeat(32),
      }),
    } as any);

    const reportPass = await handleDeliverySettler(mockEvent, { donNodes: 3, skipSigVerification: true }, mockPassFetch);
    assert(reportPass.deliveryId === 42n, "DeliveryId matches in settlement report");
    assert(reportPass.verdict === VerdictStatus.PASS, "Verdict is PASS (1)");
    assert(reportPass.tflopsE2 === 98900, "tflopsE2 is 98900");

    const decodedPass = decodeSettlementReport(reportPass.encodedReport);
    assert(decodedPass.deliveryId === 42n, "Decoded deliveryId matches");
    assert(decodedPass.verdict === 1, "Decoded verdict matches");
    assert(decodedPass.tflopsE2 === 98900, "Decoded tflopsE2 matches");
    assert(decodedPass.resultRoot === "0x" + "11".repeat(32), "Decoded resultRoot matches");

    const mockFailFetch: typeof fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        deliveryId: 42,
        verdict: 3,
        verdictName: "FAIL",
        tflopsE2: 815,
        resultRoot: "0x" + "33".repeat(32),
      }),
    } as any);

    const reportFail = await handleDeliverySettler(mockEvent, { donNodes: 3, skipSigVerification: true }, mockFailFetch);
    assert(reportFail.verdict === VerdictStatus.FAIL, "Verdict is FAIL (3) for spoofing detection");
  }

  // TEST SUITE 5: Timeout & Network Error Resilience
  console.log("\n[Suite 5: Timeout & Network Error Resilience]");
  {
    let callCount = 0;
    const retryFetch: typeof fetch = async () => {
      callCount++;
      if (callCount < 3) {
        return { ok: false, status: 404, statusText: "Not Found" } as any;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          deliveryId: 99,
          verdict: 2, // DEGRADED
          tflopsE2: 60000,
          resultRoot: "0x" + "22".repeat(32),
        }),
      } as any;
    };

    const polledVerdict = await pollVerifierVerdict(99, "http://mock", 5, 10, retryFetch);
    assert(polledVerdict.verdict === 2, "Successfully retried through pending 404 states");
    assert(callCount === 3, "Polled exactly 3 times before succeeding");

    let timeoutCaught = false;
    try {
      await pollVerifierVerdict(100, "http://mock", 2, 10, async () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any));
    } catch {
      timeoutCaught = true;
    }
    assert(timeoutCaught, "Exhausted retries throws timeout error");
  }

  // TEST SUITE 6: Outlier & Anomaly Pruning (Phase 1)
  console.log("\n[Suite 6: Outlier & Adversarial Price Pruning]");
  {
    // Normal cluster around 2.92, with an adversarial spike at 999.0
    const readings = [2.90, 2.92, 2.94, 999.0];
    const cleaned = filterExtremeAnomalies(readings, 0.6);
    assert(!cleaned.includes(999.0), "Extreme adversarial spike (999.0) successfully discarded");
    assert(cleaned.length === 3, "Valid cluster of 3 readings preserved");

    // IQR filtering on statistical outliers
    const iqrData = [1.0, 10.0, 10.2, 10.5, 10.8, 11.0, 100.0];
    const iqrClean = filterOutliersIQR(iqrData);
    assert(!iqrClean.includes(1.0), "Low statistical outlier filtered by IQR");
    assert(!iqrClean.includes(100.0), "High statistical outlier filtered by IQR");
  }

  // TEST SUITE 7: Deviation Threshold & Heartbeat Engine (Phase 1)
  console.log("\n[Suite 7: Economic Deviation Thresholds & Heartbeat]");
  {
    // Case 1: Initial seed
    const initialSeed = evaluatePublicationThreshold(292000000n, 0n, 1000n, 0n, 1.0, 3600);
    assert(initialSeed.shouldPublish === true, "Initial seed triggers publication");
    assert(initialSeed.reason === "INITIAL_SEED", "Reason is INITIAL_SEED");

    // Case 2: Stable price within threshold (0.3% change, 200s elapsed)
    const stable = evaluatePublicationThreshold(292000000n, 291000000n, 1200n, 1000n, 1.0, 3600);
    assert(stable.shouldPublish === false, "Price within 1.0% threshold skips publication (gas saved)");
    assert(stable.reason === "WITHIN_THRESHOLD", "Reason is WITHIN_THRESHOLD");

    // Case 3: Price shift > 1% (2.92 -> 3.00 = +2.7%)
    const shifted = evaluatePublicationThreshold(300000000n, 292000000n, 1200n, 1000n, 1.0, 3600);
    assert(shifted.shouldPublish === true, "Price shift > 1.0% triggers immediate publication");
    assert(shifted.reason === "DEVIATION_EXCEEDED", "Reason is DEVIATION_EXCEEDED");

    // Case 4: Heartbeat expired (stable price, but > 3600s elapsed)
    const heartbeat = evaluatePublicationThreshold(292000000n, 292000000n, 5000n, 1000n, 1.0, 3600);
    assert(heartbeat.shouldPublish === true, "Heartbeat expiration forces refresh");
    assert(heartbeat.reason === "HEARTBEAT_EXPIRED", "Reason is HEARTBEAT_EXPIRED");
  }

  // TEST SUITE 8: EIP-712 Structured Signature Verification (Phase 2)
  console.log("\n[Suite 8: EIP-712 DON Cryptographic Verification]");
  {
    const verifierPk = "0x7bd4674689b7faf0f7443e1bec526ec5e997e095bdf4f2155149ade61a11b2b6";
    const wallet = new ethers.Wallet(verifierPk);
    const escrowAddress = "0x4444444444444444444444444444444444444444";
    const domain = buildVerifierDomain(escrowAddress, 10143);

    const validPayload = {
      deliveryId: 77n,
      verdict: 1,
      tflopsE2: 815,
      resultRoot: "0x" + "44".repeat(32),
    };

    const signature = await wallet.signTypedData(domain, EIP712_VERDICT_TYPES, validPayload);
    const verif = verifyEip712VerdictSignature(
      77n,
      1,
      815,
      validPayload.resultRoot,
      signature,
      escrowAddress,
      wallet.address,
      10143
    );
    assert(verif.valid === true, "Valid EIP-712 verifier signature accepted");
    assert(verif.recoveredAddress.toLowerCase() === wallet.address.toLowerCase(), "Recovered signer address matches exactly");

    // Malicious rogue signer test
    const rogueWallet = ethers.Wallet.createRandom();
    const rogueSignature = await rogueWallet.signTypedData(domain, EIP712_VERDICT_TYPES, validPayload);
    let rogueCaught = false;
    try {
      verifyEip712VerdictSignature(
        77n,
        1,
        815,
        validPayload.resultRoot,
        rogueSignature,
        escrowAddress,
        wallet.address, // Expecting authentic signer
        10143
      );
    } catch {
      rogueCaught = true;
    }
    assert(rogueCaught, "Rogue EIP-712 signature rejected by DON node");
  }

  // TEST SUITE 9: Gas Profiling & Intrinsic Calldata Bounds (Phase 3)
  console.log("\n[Suite 9: Monad Gas Profiling & Bounds]");
  {
    const oracleCalldata = "0xc2e5f7af" + "00".repeat(96);
    const gasReceipt = profileCalldataGas("INDEX_ORACLE_REPORT", "0x3333333333333333333333333333333333333333", oracleCalldata);
    assert(gasReceipt.calldataBytes === 100, "Calldata size measured as 100 bytes");
    assert(gasReceipt.intrinsicCalldataGas > 21000, "Intrinsic gas includes EVM base cost");
    assert(gasReceipt.totalEstimatedGas > 40000 && gasReceipt.totalEstimatedGas < 80000, "Estimated gas within expected ~46k bounds");
    assert(gasReceipt.monadFinalityBlocks === 1, "Monad finality is 1 block");
  }

  // TEST SUITE 10: Multi-Source Failover & Snapshot Recovery (Phase 4)
  console.log("\n[Suite 10: Source Failover & Snapshot Recovery]");
  {
    assert(BASELINE_REFERENCE_PRICES["H100 SXM"] === 2.65, "Baseline reference rate for H100 SXM is $2.65/hr");
    assert(BASELINE_REFERENCE_PRICES["T4"] === 0.35, "Baseline reference rate for T4 is $0.35/hr");

    // Failover test
    const failoverResult = await fetchWithFailover("H100 SXM", async () => {
      throw new Error("Simulated upstream HTTP 503");
    });
    assert(failoverResult.source === "FALLBACK_BASELINE", "Gracefully failed over to baseline pricing on API outage");
    assert(failoverResult.response.data[0].index_value === 2.65, "Baseline index value matches rate");
  }

  console.log("\n===============================================================================");
  console.log(`TEST RESULTS: ALL ${passed} TESTS PASSED (${failed} failed)`);
  console.log("===============================================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
