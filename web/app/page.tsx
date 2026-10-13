"use client";

import Link from "next/link";
import { useState } from "react";
import { gridUsdAbi } from "@/lib/abis";
import { CONTRACTS, GPU_CLASSES, IS_MOCK } from "@/lib/config";
import { readBalances, readForwardCurve } from "@/lib/data";
import { fmtDate, fmtUsd, gusd } from "@/lib/format";
import { usePoll, useTx } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { ForwardCurve } from "@/components/ForwardCurve";
import { Button, Card, ErrorBox, GasWarning, MockBanner, Spinner } from "@/components/ui";

const FAQS = [
  {
    q: "DOES THIS PLATFORM RUN ON LIVE MONAD TESTNET?",
    a: "Yes. Every calculation—forward contract minting, 120% collateral bonding, in-pod FLOPS verification, and automated slashing—runs authoritatively on Monad Testnet (Chain ID 10143) and settles in 1 block (400ms).",
  },
  {
    q: "HOW DOES IN-POD HARDWARE FLOPS VERIFICATION WORK?",
    a: "When a delivery window opens, our O(√N) verification agent injects a deterministic pseudo-random challenge into the physical GPU pod. The provider must prove genuine matrix multiplication throughput before receiving release authorization.",
  },
  {
    q: "WHAT HAPPENS IF A PROVIDER COMMITS COMPUTE FRAUD OR DELIVERS LOW TFLOPS?",
    a: "If the verifier detects a hardware mismatch or degraded compute, the DeliveryEscrow smart contract automatically slashes up to 100% of the provider's 120% bond directly to the tenant buyer within 400ms.",
  },
  {
    q: "HOW ARE FORWARD PRICES DETERMINED VS SPOT BENCHMARKS?",
    a: "Forward series trade dynamically on Kuru OrderBook order books, while spot leg references are published daily by the Ornn oracle via Chainlink CRE data feeds.",
  },
  {
    q: "WHAT IS MERA PRF AND HOW DOES IT PROTECT SSH CREDENTIALS?",
    a: "Credentials are encrypted on-chain to the tenant's public key derived deterministically from their biometric passkey PRF (WebAuthn). No third party or verifier ever sees raw instance passwords.",
  },
];

export default function HomePage() {
  const { session, signIn, busy } = useWallet();
  const { write, pending } = useTx();
  const curve = usePoll(readForwardCurve, [], 15000);
  const bal = usePoll(
    () => (session ? readBalances(session.address) : Promise.resolve(undefined)),
    [session?.address],
    15000
  );

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faucet = () =>
    write("Claim 1,000 gUSD Faucet", {
      address: CONTRACTS.gridUSD,
      abi: gridUsdAbi,
      functionName: "faucet",
    }).catch(() => {});

  return (
    <div className="space-y-0 text-black">
      {/* ============================================================== */}
      {/* SECTION 1: HERO SECTION (Exact styling from Image 1)           */}
      {/* ============================================================== */}
      <section className="bg-neo-yellow border-b-2 border-black py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Top Pill Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="bg-neo-pink text-black border-2 border-black font-mono font-bold text-xs uppercase px-3 py-1 shadow-neo-sm">
              ONE PROTOCOL. CONNECTED CONTEXT.
            </span>
            <span className="bg-black text-white font-mono font-bold text-xs uppercase px-3 py-1">
              MONAD TESTNET · 400MS FINALITY
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Big Typographic Hero */}
            <div className="lg:col-span-7 space-y-6">
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight text-black leading-[1.02]">
                ONE REPORT. <br />
                ONE VERIFIED <br />
                <span className="border-[3px] sm:border-[4px] border-black inline-block px-3 py-0.5 mt-1 bg-white shadow-neo">
                  HANDOFF.
                </span>
              </h1>

              <p className="text-black font-medium leading-relaxed max-w-xl text-base sm:text-lg">
                A buyer locks institutional GPU compute weeks in advance. Gridlock&apos;s deterministic
                escrow engine verifies in-pod matrix benchmarks, slashes rogue collateral in 1 block, and
                generates an explainable receipt.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  href="/market/gT4-NOW"
                  className="neo-btn bg-neo-yellow hover:bg-neo-yellowDark text-black px-6 py-3.5 text-sm sm:text-base font-black uppercase tracking-wider"
                >
                  EXPLORE THE RECORDED HANDOFF ↗
                </Link>

                {session ? (
                  <Button
                    variant="ghost"
                    onClick={faucet}
                    loading={pending}
                    disabled={IS_MOCK}
                    className="!py-3.5 !px-5"
                  >
                    Claim 1,000 gUSD Faucet
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => signIn()}
                    loading={busy}
                    className="!py-3.5 !px-5"
                  >
                    ⚿ Passkey Sign In
                  </Button>
                )}
              </div>

              <div className="pt-2 text-xs font-mono font-bold text-gray-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-neo-green border border-black inline-block" />
                <span>Deterministic pre-underwriting audit trail • 100% Explainable & verifiable</span>
              </div>
            </div>

            {/* Right Column: Dual Stacked Neo-Brutalist Cards */}
            <div className="lg:col-span-5 space-y-4">
              {/* Card 1: Candidate Report (Pastel Blue) */}
              <div className="bg-neo-blue border-2 border-black shadow-neo p-5 space-y-3">
                <div className="flex items-center justify-between border-b-2 border-black pb-2 text-xs font-mono font-bold">
                  <span className="uppercase">THE CANDIDATE REPORT</span>
                  <span className="bg-black text-white px-2 py-0.5 uppercase">VERIFIED</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-black leading-snug">
                  Large AI clusters fail outright without dedicated physical hardware. Hand this to the
                  escrow matrix and verify the exact underwriting verdict.
                </p>
                <div className="text-[10px] font-mono font-bold text-gray-800 uppercase tracking-wider pt-1">
                  REPORT SUMMARY, SYNTHESIZED FOR ESCROW REVIEW
                </div>
              </div>

              {/* Card 2: Recorded Result Trail (White) */}
              <div className="bg-white border-2 border-black shadow-neo p-5 space-y-3">
                <div className="flex items-center justify-between border-b-2 border-black pb-2 text-xs font-mono font-bold">
                  <span className="bg-neo-green px-2 py-0.5 border border-black uppercase">
                    RECORDED RESULT
                  </span>
                  <span className="bg-neo-yellow px-2 py-0.5 border border-black uppercase">
                    READ BACK ✓
                  </span>
                </div>

                <div className="text-base font-black uppercase text-black">
                  THE HANDOFF HAS A TRAIL.
                </div>

                <div className="divide-y-2 divide-black text-xs font-mono font-bold">
                  <div className="py-2 flex justify-between">
                    <span>H100-SXM5-80GB</span>
                    <span className="text-black">Eligible • Up to 815 TFLOPS</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span>A100-PCIE-80GB</span>
                    <span className="text-black">Approved • 120% Bond Escrowed</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span>T4-INFERENCE</span>
                    <span className="text-black">Colab Verified Benchmark</span>
                  </div>
                </div>

                {/* Magenta Alert Box */}
                <div className="bg-neo-pink border-2 border-black p-2.5 text-xs font-bold font-mono text-black shadow-neo-sm">
                  Out of scope? Unverifiable hardware rejected by in-pod check.
                </div>
              </div>
            </div>
          </div>

          {/* Bottom 4 Horizontal Grid Boxes (from Image 1) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12 pt-8 border-t-2 border-black">
            <div className="bg-white border-2 border-black p-4 shadow-neo-sm space-y-1">
              <div className="text-xs font-mono font-bold text-gray-600 uppercase">
                01 / CALCULATION
              </div>
              <div className="text-sm font-black uppercase text-black">Deterministic Engine</div>
            </div>
            <div className="bg-white border-2 border-black p-4 shadow-neo-sm space-y-1">
              <div className="text-xs font-mono font-bold text-gray-600 uppercase">
                02 / CURRENCIES
              </div>
              <div className="text-sm font-black uppercase text-black">Live FX Normalization</div>
            </div>
            <div className="bg-white border-2 border-black p-4 shadow-neo-sm space-y-1">
              <div className="text-xs font-mono font-bold text-gray-600 uppercase">
                03 / POLICY RULES
              </div>
              <div className="text-sm font-black uppercase text-black">5 Benchmark Tiers</div>
            </div>
            <div className="bg-white border-2 border-black p-4 shadow-neo-sm space-y-1">
              <div className="text-xs font-mono font-bold text-gray-600 uppercase">
                04 / AUDIT TRAIL
              </div>
              <div className="text-sm font-black uppercase text-black">Tamper-Proof Receipt</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 2: THE RECORDED HANDOFF / RECEIPT (From Image 2)       */}
      {/* ============================================================== */}
      <section className="bg-neo-blue border-b-2 border-black py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <span className="bg-white text-black border-2 border-black font-mono font-bold text-xs uppercase px-3 py-1 shadow-neo-sm inline-block mb-3">
              THE RECORDED HANDOFF
            </span>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-black">
                A REAL CASE. <br />
                A READABLE RECEIPT.
              </h2>
              <p className="text-xs sm:text-sm font-medium text-black max-w-md">
                GRIDLOCK-RECORD-01 is a verified underwriting run. The deterministic engine evaluated all
                hardware rules; these records were independently computed and verified.
              </p>
            </div>
          </div>

          {/* The White Paper Receipt Card */}
          <div className="bg-white border-2 border-black shadow-neo-lg p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-4">
              <span className="bg-neo-green text-black border-2 border-black text-xs font-mono font-bold px-2.5 py-0.5 shadow-neo-sm w-fit uppercase">
                RECORDED STATUS: COMPLETE
              </span>
              <div className="text-xs font-mono font-bold text-black text-right">
                OCTOBER 14, 2026 · Monad Block #1249820 · 5 Verified Specs
              </div>
            </div>

            <h3 className="text-xl sm:text-2xl font-black uppercase text-black">
              COMPUTE DELIVERY GAP → TIER-1 HARDWARE AUDIT #1
            </h3>

            {/* Item 1 */}
            <div className="space-y-2 border-t-2 border-black pt-4">
              <div className="flex items-center gap-3">
                <span className="bg-neo-pink text-black border-2 border-black text-xs font-mono font-bold px-2 py-0.5 uppercase shadow-neo-sm">
                  01 / PROVISIONING PLAN
                </span>
                <span className="text-xs font-mono font-bold text-black">
                  ✓ Independently verified benchmark FLOPS
                </span>
              </div>
              <div className="p-3 bg-white border-2 border-black text-xs sm:text-sm font-mono font-bold text-black shadow-neo-sm">
                Cluster: 8x H100 SXM5 · Provisioned: 142 Hours · Total Benchmark FLOPS: 815.4 TF (100% PASS)
              </div>
              <p className="text-xs font-medium text-gray-700">
                Target pod matches Tier-1 approved NVIDIA HGX hardware registry.
              </p>
            </div>

            {/* Item 2 */}
            <div className="space-y-2 border-t-2 border-black pt-4">
              <div className="flex items-center gap-3">
                <span className="bg-neo-blue text-black border-2 border-black text-xs font-mono font-bold px-2 py-0.5 uppercase shadow-neo-sm">
                  02 / ESCROW RATIO
                </span>
                <span className="text-xs font-mono font-bold text-black">
                  ✓ Independently calculated 120% bond
                </span>
              </div>
              <div className="p-3 bg-white border-2 border-black text-xs sm:text-sm font-mono font-bold text-black shadow-neo-sm">
                Bond Posted: 5,040 gUSD · Slashed: 0.00 gUSD · Payout Released: 4,200 gUSD · Ratio: 120.0%
              </div>
              <p className="text-xs font-medium text-gray-700">
                Collateral ratio is within safe 120% boundary for Monad atomic settlement.
              </p>
            </div>

            {/* Item 3 */}
            <div className="space-y-2 border-t-2 border-black pt-4">
              <div className="flex items-center gap-3">
                <span className="bg-neo-green text-black border-2 border-black text-xs font-mono font-bold px-2 py-0.5 uppercase shadow-neo-sm">
                  03 / SPOT SPREAD
                </span>
                <span className="text-xs font-mono font-bold text-black">
                  ✓ Independently verified Ornn oracle prints
                </span>
              </div>
              <div className="p-3 bg-white border-2 border-black text-xs sm:text-sm font-mono font-bold text-black shadow-neo-sm">
                Ornn Spot: $3.500 / hr · Kuru Forward: $3.550 / hr · Basis Spread: +1.4%
              </div>
              <p className="text-xs font-medium text-gray-700">
                Validated against daily index prints published by Ornn oracle on Monad.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 3: WHY THIS HANDOFF HELPS (From Image 3)               */}
      {/* ============================================================== */}
      <section className="bg-white border-b-2 border-black py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <span className="bg-neo-pink text-black border-2 border-black font-mono font-bold text-xs uppercase px-3 py-1 shadow-neo-sm inline-block">
              WHY THIS HANDOFF HELPS
            </span>
          </div>

          <div className="divide-y-2 divide-black border-y-2 border-black">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-8 items-start">
              <div className="md:col-span-2 text-xl font-mono font-black text-black">01</div>
              <div className="md:col-span-4 text-xl sm:text-2xl font-black uppercase text-black leading-tight">
                KEEP THE CONTEXT CONNECTED.
              </div>
              <div className="md:col-span-6 text-xs sm:text-sm font-medium text-gray-800 leading-relaxed">
                The hardware spec, multi-week delivery window, provider collateral bond, and cryptographic
                proof all point back to the same reproducible on-chain receipt.
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-8 items-start">
              <div className="md:col-span-2 text-xl font-mono font-black text-black">02</div>
              <div className="md:col-span-4 text-xl sm:text-2xl font-black uppercase text-black leading-tight">
                KEEP THE ACTIONS BOUNDED.
              </div>
              <div className="md:col-span-6 text-xs sm:text-sm font-medium text-gray-800 leading-relaxed">
                A provider cannot submit unviable requests. The execution layer enforces hard 120% collateral
                caps and strict timeout limits. Out-of-scope nodes are flagged and rejected.
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-8 items-start">
              <div className="md:col-span-2 text-xl font-mono font-black text-black">03</div>
              <div className="md:col-span-4 text-xl sm:text-2xl font-black uppercase text-black leading-tight">
                SEE WHAT ACTUALLY LANDED.
              </div>
              <div className="md:col-span-6 text-xs sm:text-sm font-medium text-gray-800 leading-relaxed">
                Independent hardware verifiers verify every compute criterion before settlement. Deterministic
                code, not an opaque black-box AI model, computes the final match.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 4: FROM REPORT TO READ BACK (From Image 4)             */}
      {/* ============================================================== */}
      <section
        id="how-it-works"
        className="bg-neo-green border-b-2 border-black py-16 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <span className="bg-white text-black border-2 border-black font-mono font-bold text-xs uppercase px-3 py-1 shadow-neo-sm inline-block mb-3">
              HOW IT WORKS
            </span>
            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-black">
              FROM REPORT TO READ BACK.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: White */}
            <div className="bg-white border-2 border-black shadow-neo p-6 space-y-4">
              <div className="text-sm font-mono font-black text-black">01</div>
              <div className="text-lg font-black uppercase text-black">READ THE REPORT.</div>
              <p className="text-xs sm:text-sm font-medium text-gray-800 leading-relaxed">
                A Gridlock engine inspects target GPU architectures, forward delivery windows, and benchmark
                FLOPS through a typed interface. Code validates selected requirements against published thresholds.
              </p>
            </div>

            {/* Card 2: Light Blue */}
            <div className="bg-neo-blue border-2 border-black shadow-neo p-6 space-y-4">
              <div className="text-sm font-mono font-black text-black">02</div>
              <div className="text-lg font-black uppercase text-black">BOUND THE ACTION.</div>
              <p className="text-xs sm:text-sm font-medium text-black leading-relaxed">
                The engine evaluates provider collateral bonds, service capability, and delivery deadlines in
                strict sequence. Unviable or out-of-scope requests cannot become execution actions on Monad.
              </p>
            </div>

            {/* Card 3: Canary Yellow */}
            <div className="bg-neo-yellow border-2 border-black shadow-neo p-6 space-y-4">
              <div className="text-sm font-mono font-black text-black">03</div>
              <div className="text-lg font-black uppercase text-black">VERIFY THE RESULT.</div>
              <p className="text-xs sm:text-sm font-medium text-black leading-relaxed">
                Read the settlement records back. Reuse verified benchmarks on retry; hold ambiguous criteria
                and boundary conditions for hardware verifier review.
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm font-medium text-black max-w-3xl leading-relaxed pt-2">
            The rule engine proposes the eligibility match; deterministic code validates it. A valid profile
            is not proof that the match is irrevocably sanctioned, and ambiguous matches are flagged for human advisor review.
          </p>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 5: WHAT TO KNOW / FAQ ACCORDION (From Image 5)         */}
      {/* ============================================================== */}
      <section className="bg-white border-b-2 border-black py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 space-y-3">
              <span className="bg-neo-blue text-black border-2 border-black font-mono font-bold text-xs uppercase px-3 py-1 shadow-neo-sm inline-block">
                A FEW HONEST ANSWERS
              </span>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
                WHAT TO KNOW.
              </h2>
              <p className="text-xs sm:text-sm font-medium text-gray-700 leading-relaxed">
                Transparent GPU forward contract execution with verifiable audit trails you can inspect on Monad.
              </p>
            </div>

            <div className="lg:col-span-8 divide-y-2 divide-black border-y-2 border-black">
              {FAQS.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={i} className="py-4">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-4 text-left font-black uppercase text-xs sm:text-sm text-black hover:opacity-80 transition-opacity"
                    >
                      <span>{faq.q}</span>
                      <span className="w-6 h-6 shrink-0 bg-white border-2 border-black shadow-neo-sm flex items-center justify-center font-mono font-bold text-sm">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="mt-3 bg-neo-yellow border-2 border-black p-4 shadow-neo-sm text-xs sm:text-sm font-bold text-black leading-relaxed">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 6: FORWARD CURVE & LIVE MARKET SECTION                 */}
      {/* ============================================================== */}
      <section className="bg-[#FFFDF7] py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b-2 border-black pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-5 bg-black inline-block" />
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black">
                  FORWARD COMPUTE CURVE & LIVE MARKETS
                </h2>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-700 mt-1">
                Real-time basis spread between spot Ornn oracle index prints and Kuru forward contract order books.
              </p>
            </div>
            {curve.data && (
              <span className="text-xs font-mono font-bold uppercase bg-white border border-black px-2 py-1 shadow-neo-sm">
                SOURCE: {curve.data.source.toUpperCase()}
              </span>
            )}
          </div>

          <GasWarning mon={bal.data?.mon} />
          <MockBanner />

          {/* Forward Curve Chart Container */}
          {curve.loading && !curve.data ? (
            <Spinner />
          ) : curve.error && !curve.data ? (
            <ErrorBox>Failed to load forward curve: {curve.error}</ErrorBox>
          ) : (
            curve.data && (
              <div className="bg-white border-2 border-black shadow-neo p-4 sm:p-6">
                <ForwardCurve rows={curve.data.rows} />
              </div>
            )
          )}

          {/* Live Series Table */}
          <Card title="Available Forward Series & Term Deliveries">
            <div className="overflow-x-auto -mx-4 sm:mx-0 sleek-scroll">
              <table className="w-full text-left text-xs sm:text-sm min-w-[700px] font-tabular">
                <thead className="text-black text-xs font-mono font-black uppercase tracking-wider border-b-2 border-black bg-neo-yellow">
                  <tr>
                    <th className="p-3.5 border-r border-black">Series</th>
                    <th className="p-3.5 border-r border-black">Hardware Spec</th>
                    <th className="p-3.5 border-r border-black">Delivery Window</th>
                    <th className="p-3.5 text-right border-r border-black">Ornn Spot</th>
                    <th className="p-3.5 text-right border-r border-black">Kuru Forward</th>
                    <th className="p-3.5 text-right border-r border-black">Basis Spread</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black text-xs sm:text-sm">
                  {(curve.data?.rows ?? []).map((r) => {
                    const basis =
                      r.lastUsd != null && r.spotUsd
                        ? ((r.lastUsd - r.spotUsd) / r.spotUsd) * 100
                        : null;
                    const isDiscount = basis != null && basis <= 0;
                    return (
                      <tr key={r.series.symbol} className="hover:bg-neutral-50 transition-colors">
                        <td className="p-3.5 font-bold font-mono text-black border-r border-black">
                          {r.series.symbol}
                        </td>
                        <td className="p-3.5 text-black font-medium border-r border-black">
                          {r.series.className}
                          <span className="text-gray-600 font-mono text-xs">
                            {" "}
                            · {GPU_CLASSES[r.series.className]?.ratedTflops ?? "?"} TF
                          </span>
                        </td>
                        <td className="p-3.5 text-black font-mono text-xs border-r border-black">
                          {fmtDate(r.series.windowStart)} – {fmtDate(r.series.windowEnd)}
                        </td>
                        <td className="p-3.5 text-right font-mono text-black border-r border-black">
                          {r.spotUsd != null ? fmtUsd(r.spotUsd, 3) : "—"}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-black border-r border-black">
                          {r.lastUsd != null ? fmtUsd(r.lastUsd, 3) : "—"}
                        </td>
                        <td className="p-3.5 text-right font-mono border-r border-black">
                          {basis == null ? (
                            <span className="text-gray-500">—</span>
                          ) : (
                            <span
                              className={`px-2 py-0.5 border border-black text-[11px] font-bold ${
                                isDiscount ? "bg-neo-green text-black" : "bg-neo-pink text-black"
                              }`}
                            >
                              {basis > 0 ? `+${basis.toFixed(1)}%` : `${basis.toFixed(1)}%`}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <Link
                            href={`/market/${r.series.symbol}`}
                            className="inline-block px-3.5 py-1.5 bg-neo-yellow hover:bg-neo-yellowDark text-xs font-mono font-bold uppercase border-2 border-black shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px]"
                          >
                            Trade →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
