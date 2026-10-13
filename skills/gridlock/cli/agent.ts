import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { encodeApproveCalldata, encodeKuruBuyCalldata, encodeRedeemCalldata } from "./calldata.ts";
import { deriveBuyerKeys } from "./prf.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SeriesInfo {
  seriesId: number;
  gpuClass: string;
  token: string;
  kuruMarket: string;
  windowStart: number;
  windowEnd: number;
}

interface MarketOpportunity {
  seriesSymbol: string;
  className: string;
  spotPriceUsd: number;
  forwardBidUsd: number;
  forwardAskUsd: number;
  discountPct: number;
  recommendation: "STRONG_BUY_HEDGE" | "BUY_HEDGE" | "NEUTRAL" | "EXPENSIVE";
  guardApproved: boolean;
}

export class AutonomousComputeTraderAgent {
  private deployments: any;
  private classesData: any;
  public dailyBudgetUsd: number;
  public maxSlippagePct: number;

  constructor(dailyBudgetUsd = 500.0, maxSlippagePct = 15.0) {
    this.dailyBudgetUsd = dailyBudgetUsd;
    this.maxSlippagePct = maxSlippagePct;

    const depPath = path.resolve(__dirname, "../../../deployments/testnet.json");
    this.deployments = JSON.parse(fs.readFileSync(depPath, "utf-8"));

    const clsPath = path.resolve(__dirname, "../../../shared/classes.json");
    this.classesData = JSON.parse(fs.readFileSync(clsPath, "utf-8")).classes;
  }

  public getGpuClassForSeries(seriesSymbol: string): string {
    if (seriesSymbol.includes("T4")) return "T4";
    if (seriesSymbol.includes("A100")) return "A100 SXM4";
    if (seriesSymbol.includes("H200")) return "H200";
    if (seriesSymbol.includes("B200")) return "B200";
    return "H100 SXM";
  }

  public scanMarketOpportunities(): MarketOpportunity[] {
    const opps: MarketOpportunity[] = [];
    const seriesMap: Record<string, SeriesInfo> = this.deployments.series;

    // Simulated market spreads around spot
    const spreadFactors: Record<string, { bidFactor: number; askFactor: number }> = {
      "gT4-NOW": { bidFactor: 0.90, askFactor: 0.92 },     // 8% forward discount
      "gH100-W43": { bidFactor: 0.92, askFactor: 0.94 },   // 6% forward discount
      "gH100-W44": { bidFactor: 0.97, askFactor: 0.99 },   // 1% discount
      "gA100-W43": { bidFactor: 1.02, askFactor: 1.06 },   // 6% premium
    };

    for (const [symbol, info] of Object.entries(seriesMap)) {
      const clsName = this.getGpuClassForSeries(symbol);
      const spot = this.classesData[clsName]?.referencePriceUsd || 1.0;
      const spreads = spreadFactors[symbol] || { bidFactor: 0.95, askFactor: 0.98 };

      const ask = Number((spot * spreads.askFactor).toFixed(2));
      const bid = Number((spot * spreads.bidFactor).toFixed(2));
      const discountPct = Number((((spot - ask) / spot) * 100).toFixed(1));

      let recommendation: MarketOpportunity["recommendation"] = "NEUTRAL";
      if (discountPct >= 7.0) recommendation = "STRONG_BUY_HEDGE";
      else if (discountPct >= 3.0) recommendation = "BUY_HEDGE";
      else if (discountPct < -5.0) recommendation = "EXPENSIVE";

      const premium = -discountPct;
      const guardApproved = premium <= this.maxSlippagePct;

      opps.push({
        seriesSymbol: symbol,
        className: clsName,
        spotPriceUsd: spot,
        forwardBidUsd: bid,
        forwardAskUsd: ask,
        discountPct,
        recommendation,
        guardApproved,
      });
    }

    return opps.sort((a, b) => b.discountPct - a.discountPct);
  }

  public planPurchase(seriesSymbol: string, hours: number) {
    const seriesInfo = this.deployments.series[seriesSymbol];
    if (!seriesInfo) {
      throw new Error(`Unknown series: ${seriesSymbol}`);
    }

    const clsName = this.getGpuClassForSeries(seriesSymbol);
    const spot = this.classesData[clsName]?.referencePriceUsd || 1.0;
    const opps = this.scanMarketOpportunities();
    const opp = opps.find((o) => o.seriesSymbol === seriesSymbol) || {
      forwardAskUsd: spot * 0.95,
      discountPct: 5.0,
      guardApproved: true,
      recommendation: "BUY_HEDGE",
    };

    const estCostUsd = hours * opp.forwardAskUsd;
    if (estCostUsd > this.dailyBudgetUsd) {
      throw new Error(
        `[Guard Mode Violation] Order cost ($${estCostUsd.toFixed(2)}) exceeds daily budget cap ($${this.dailyBudgetUsd.toFixed(2)})`
      );
    }

    // Step 1: Token Approval (gUSD)
    const requiredGUsdWei = BigInt(Math.round(estCostUsd * 1e6));
    const marketAddress = seriesInfo.kuruMarket || this.deployments.external.kuruRouter;
    const approveCalldata = encodeApproveCalldata(marketAddress, requiredGUsdWei);

    // Step 2: Kuru Market Order
    const maxPriceE6 = BigInt(Math.round(opp.forwardAskUsd * 1e6));
    const buyCalldata = encodeKuruBuyCalldata(marketAddress, BigInt(hours), maxPriceE6);

    // Step 3: Mera PRF Keypair & Escrow Redeem Calldata
    const mockPrfOutput = "0x" + crypto.randomBytes(32).toString("hex");
    const buyerKeys = deriveBuyerKeys(mockPrfOutput);
    const escrowAddress = this.deployments.contracts.DeliveryEscrow;
    const redeemCalldata = encodeRedeemCalldata(seriesInfo.seriesId, BigInt(hours), buyerKeys.buyerEncPubKeyHex);

    return {
      seriesSymbol,
      gpuClass: clsName,
      hours,
      spotPriceUsd: spot,
      executionPriceUsd: opp.forwardAskUsd,
      discountPct: opp.discountPct,
      totalCostUsd: estCostUsd,
      dailyBudgetUsd: this.dailyBudgetUsd,
      guardStatus: opp.guardApproved ? "APPROVED" : "REJECTED_SLIPPAGE",
      buyerKeys,
      transactions: [
        {
          step: 1,
          description: "Approve gUSD for Kuru Order Book",
          to: this.deployments.contracts.GridUSD,
          calldata: approveCalldata,
        },
        {
          step: 2,
          description: "Market Buy GPU Forward Hours on Kuru DEX",
          to: marketAddress,
          calldata: buyCalldata,
        },
        {
          step: 3,
          description: "Redeem Physical GPU Delivery on DeliveryEscrow",
          to: escrowAddress,
          calldata: redeemCalldata,
        },
      ],
      nextCommand: `gridlock verify --delivery <id> --class "${clsName}"`,
    };
  }
}

// CLI Execution Handler
async function main() {
  const args = process.argv.slice(2);
  const budgetIdx = args.indexOf("--budget");
  const budget = budgetIdx !== -1 && args[budgetIdx + 1] ? parseFloat(args[budgetIdx + 1]) : 500.0;

  const agent = new AutonomousComputeTraderAgent(budget);

  if (args.includes("--scan") || args.length === 0) {
    console.log("==========================================================================");
    console.log("GRIDLOCK AUTONOMOUS COMPUTE ARBITRAGEUR & TRADER AGENT");
    console.log("==========================================================================");
    console.log(`[Config] Guard Mode Active | Daily Cap: $${budget.toFixed(2)} USD | Max Slippage: 15%`);
    console.log("--------------------------------------------------------------------------");
    console.log("SCANNING FORWARD SPREADS VS SPOT BENCHMARKS:");
    console.log("--------------------------------------------------------------------------");

    const opps = agent.scanMarketOpportunities();
    for (const opp of opps) {
      const discountLabel = opp.discountPct >= 0 ? `-${opp.discountPct.toFixed(1)}%` : `+${(-opp.discountPct).toFixed(1)}%`;
      console.log(
        `* [${opp.seriesSymbol.padEnd(10)}] Class: ${opp.className.padEnd(10)} | Spot: $${opp.spotPriceUsd.toFixed(2)}/hr | Fwd: $${opp.forwardAskUsd.toFixed(2)}/hr | Spread: ${discountLabel.padEnd(7)} | Rec: ${opp.recommendation}`
      );
    }
    console.log("==========================================================================");
    console.log("To formulate an automated execution plan:");
    console.log("  node --experimental-strip-types cli/agent.ts --series gT4-NOW --hours 4");
    console.log("==========================================================================");
    return;
  }

  const seriesIdx = args.indexOf("--series");
  const seriesSymbol = seriesIdx !== -1 && args[seriesIdx + 1] ? args[seriesIdx + 1] : "gT4-NOW";
  const hoursIdx = args.indexOf("--hours");
  const hours = hoursIdx !== -1 && args[hoursIdx + 1] ? parseInt(args[hoursIdx + 1], 10) : 2;

  try {
    const plan = agent.planPurchase(seriesSymbol, hours);
    console.log("==========================================================================");
    console.log(`GRIDLOCK AGENT EXECUTION PLAN: ${plan.seriesSymbol} (${plan.gpuClass})`);
    console.log("==========================================================================");
    console.log(`  Hours Requested:    ${plan.hours} hrs`);
    console.log(`  Spot Reference:     $${plan.spotPriceUsd.toFixed(2)} / hr`);
    console.log(`  Forward Bid/Ask:    $${plan.executionPriceUsd.toFixed(2)} / hr (Discount: ${plan.discountPct}%)`);
    console.log(`  Total Capital:      $${plan.totalCostUsd.toFixed(2)} USD / $${plan.dailyBudgetUsd.toFixed(2)} Daily Budget`);
    console.log(`  Guard Mode Check:   [${plan.guardStatus}]`);
    console.log(`  Buyer Public Key:   ${plan.buyerKeys.buyerEncPubKeyHex}`);
    console.log("--------------------------------------------------------------------------");
    console.log("AUTONOMOUS TRANSACTION BUNDLE:");
    for (const tx of plan.transactions) {
      console.log(`  Step ${tx.step}: ${tx.description}`);
      console.log(`    To:   ${tx.to}`);
      console.log(`    Data: ${tx.calldata}`);
    }
    console.log("--------------------------------------------------------------------------");
    console.log(`In-Pod Verification Command:`);
    console.log(`  ${plan.nextCommand}`);
    console.log("==========================================================================");
  } catch (err: any) {
    console.error(`[AGENT ERROR] ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith("agent.ts") || process.argv[1]?.endsWith("agent.js")) {
  main().catch((err) => {
    console.error("Agent error:", err);
    process.exit(1);
  });
}
