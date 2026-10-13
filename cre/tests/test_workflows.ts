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
import {
  APPROVED_SYMBOLS,
  fetchIndexHistory,
  extractLatestRecord,
  aggregateDonObservations,
  handleIndexFeed,
} from "../index-feed/workflow.ts";
import {
  PROVISIONED_TOPIC,
  parseProvisionedLog,
  pollVerifierVerdict,
  handleDeliverySettler,
} from "../delivery-settler/workflow.ts";
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
  console.log("RUNNING CHAINLINK CRE WORKFLOW TEST SUITE");
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
        { verdict: 3, tflopsE2: 815, resultRoot: "0x" + "aa".repeat(32) }, // Malicious node
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

    // Test rejection of unapproved symbol
    let unapprovedCaught = false;
    try {
      await fetchIndexHistory("RTX-4090", "https://mock");
    } catch {
      unapprovedCaught = true;
    }
    assert(unapprovedCaught, "Rejects unapproved GPU symbol RTX-4090");

    // Test extraction of latest record
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

    // Test malformed record rejection
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

  // TEST SUITE 4: Delivery Settler Workflow & Event Handling
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

    // Mock fetch for PASS
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

    const reportPass = await handleDeliverySettler(mockEvent, { donNodes: 3 }, mockPassFetch);
    assert(reportPass.deliveryId === 42n, "DeliveryId matches in settlement report");
    assert(reportPass.verdict === VerdictStatus.PASS, "Verdict is PASS (1)");
    assert(reportPass.tflopsE2 === 98900, "tflopsE2 is 98900");

    const decodedPass = decodeSettlementReport(reportPass.encodedReport);
    assert(decodedPass.deliveryId === 42n, "Decoded deliveryId matches");
    assert(decodedPass.verdict === 1, "Decoded verdict matches");
    assert(decodedPass.tflopsE2 === 98900, "Decoded tflopsE2 matches");
    assert(decodedPass.resultRoot === "0x" + "11".repeat(32), "Decoded resultRoot matches");

    // Mock fetch for FAIL (Anti-spoofing)
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

    const reportFail = await handleDeliverySettler(mockEvent, { donNodes: 3 }, mockFailFetch);
    assert(reportFail.verdict === VerdictStatus.FAIL, "Verdict is FAIL (3) for spoofing detection");
  }

  // TEST SUITE 5: Resilience & Timeout Handling
  console.log("\n[Suite 5: Timeout & Network Error Resilience]");
  {
    // Polling retry simulation: 2 pending (404), then success (200)
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

    // Permanent timeout simulation
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

  console.log("\n===============================================================================");
  console.log(`TEST RESULTS: ALL ${passed} TESTS PASSED (${failed} failed)`);
  console.log("===============================================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
