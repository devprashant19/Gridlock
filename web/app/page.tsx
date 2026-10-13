"use client";

import Link from "next/link";
import { gridUsdAbi } from "@/lib/abis";
import { CONTRACTS, GPU_CLASSES, IS_MOCK } from "@/lib/config";
import { readBalances, readForwardCurve } from "@/lib/data";
import { fmtDate, fmtUsd, gusd } from "@/lib/format";
import { usePoll, useTx } from "@/lib/hooks";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { ForwardCurve } from "@/components/ForwardCurve";
import { Badge, Button, Card, ErrorBox, GasWarning, MockBanner, Spinner } from "@/components/ui";

export default function HomePage() {
  const { session, signIn, busy } = useWallet();
  const { write, pending } = useTx();
  const curve = usePoll(readForwardCurve, [], 15000);
  const bal = usePoll(
    () => (session ? readBalances(session.address) : Promise.resolve(undefined)),
    [session?.address],
    15000
  );

  const faucet = () =>
    write("Claim 1,000 gUSD Faucet", {
      address: CONTRACTS.gridUSD,
      abi: gridUsdAbi,
      functionName: "faucet",
    }).catch(() => {});

  return (
    <div className="space-y-6">
      {/* Hero Terminal Cockpit */}
      <div className="hud-box p-6 sm:p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-grid-monad/15 via-grid-cyan/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan" pulse>
              MONAD TESTNET (10143) · 400MS FINALITY
            </Badge>
            <Badge tone="pass">120% COLLATERAL BONDED</Badge>
            <Badge tone="monad">PROOF-SETTLED PHYSICAL DELIVERY</Badge>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-none">
            PHYSICALLY DELIVERED <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-grid-monad via-purple-300 to-grid-cyan">
              GPU COMPUTE FORWARDS
            </span>
          </h1>

          <p className="text-gray-300 sm:text-lg leading-relaxed max-w-2xl font-light">
            Lock in guaranteed AI compute weeks in advance before hyperscaler spikes. Providers deposit a 120% collateral bond.
            Credentials deliver via biometric passkey PRF. If in-pod hardware verification fails,{" "}
            <strong className="text-white font-semibold">100% of the bond is slashed to you in 1 Monad block (400ms)</strong>.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/market/gT4-NOW"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-grid-monad to-purple-600 text-black font-mono font-bold text-sm tracking-wider hover:brightness-110 shadow-lg shadow-grid-monad/25 transition-all active:scale-[0.98] flex items-center gap-2"
            >
              <span>⚡</span> ENTER KURU ORDER BOOK →
            </Link>

            {session ? (
              <Button
                variant="ghost"
                onClick={faucet}
                loading={pending}
                disabled={IS_MOCK}
                className="!py-3.5 !px-5 !rounded-xl font-mono text-xs"
              >
                Claim 1,000 gUSD Faucet
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => signIn()}
                loading={busy}
                className="!py-3.5 !px-5 !rounded-xl font-mono text-xs"
              >
                ⚿ Biometric Passkey Sign In
              </Button>
            )}
          </div>

          {session && bal.data && (
            <div className="flex items-center gap-3 text-xs font-mono text-gray-400 pt-1">
              <span>ACTIVE WALLET:</span>
              <span className="text-white font-bold">{gusd(bal.data.gusd).toFixed(2)} gUSD</span>
              <span className="text-gray-600">·</span>
              <span className="text-grid-cyan">{gusd(bal.data.mon).toFixed(3)} MON</span>
            </div>
          )}
        </div>

        {/* Live Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/[0.08]">
          <div className="p-3 rounded-xl bg-obsidian/60 border border-white/[0.06]">
            <div className="text-[10px] font-mono text-gray-400 uppercase">Collateral Ratio</div>
            <div className="text-lg font-bold font-mono text-grid-pass mt-0.5">120.0%</div>
            <div className="text-[10px] text-gray-500">Atomic Escrow Lock</div>
          </div>
          <div className="p-3 rounded-xl bg-obsidian/60 border border-white/[0.06]">
            <div className="text-[10px] font-mono text-gray-400 uppercase">Settlement Latency</div>
            <div className="text-lg font-bold font-mono text-grid-cyan mt-0.5">400 ms</div>
            <div className="text-[10px] text-gray-500">1 Monad Block</div>
          </div>
          <div className="p-3 rounded-xl bg-obsidian/60 border border-white/[0.06]">
            <div className="text-[10px] font-mono text-gray-400 uppercase">In-Pod Verification</div>
            <div className="text-lg font-bold font-mono text-grid-monad mt-0.5">O(√N) PROOF</div>
            <div className="text-[10px] text-gray-500">4096 Matrix Challenge</div>
          </div>
          <div className="p-3 rounded-xl bg-obsidian/60 border border-white/[0.06]">
            <div className="text-[10px] font-mono text-gray-400 uppercase">Credential Privacy</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">MERA PRF</div>
            <div className="text-[10px] text-gray-500">X25519 In-Browser Key</div>
          </div>
        </div>
      </div>

      <GasWarning mon={bal.data?.mon} />
      <MockBanner />

      {/* Demo Mode Notice */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-purple-950/40 border border-purple-800/60 text-xs sm:text-sm text-purple-200 flex gap-3 items-start backdrop-blur-md">
        <span className="font-bold text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-grid-monad text-black shrink-0 mt-0.5">
          DEMO STAGING
        </span>
        <span className="leading-relaxed">
          <strong className="text-white">gT4-NOW</strong> operates against a fixed ${GPU_CLASSES.T4?.referencePriceUsd.toFixed(2)}/hr reference price so developers can benchmark live on free Colab instances. Other forward series (`gH100-W43`, `gA100-W43`) track live spot feeds via Chainlink CRE.
        </span>
      </div>

      {/* Forward Curve Section */}
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3 border-b border-white/[0.06] pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-4 bg-grid-monad rounded-xs" />
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">FORWARD COMPUTE CURVE</h2>
          </div>
          {curve.data && <span className="text-xs font-mono text-gray-500">SOURCE: {curve.data.source.toUpperCase()}</span>}
        </div>

        {curve.loading && !curve.data ? (
          <Spinner />
        ) : curve.error && !curve.data ? (
          <ErrorBox>Failed to load forward curve: {curve.error}</ErrorBox>
        ) : (
          curve.data && <ForwardCurve rows={curve.data.rows} />
        )}
      </div>

      {/* Live Series Table */}
      <Card title="Available Forward Series & Term Deliveries">
        <div className="overflow-x-auto -mx-4 sm:mx-0 sleek-scroll">
          <table className="w-full text-left text-sm min-w-[700px] font-tabular">
            <thead className="text-gray-400 text-[11px] font-mono uppercase tracking-wider border-b border-white/[0.08] bg-obsidian/40">
              <tr>
                <th className="p-3.5">Series</th>
                <th className="p-3.5">Hardware Spec</th>
                <th className="p-3.5">Delivery Window</th>
                <th className="p-3.5 text-right">Ornn Spot</th>
                <th className="p-3.5 text-right">Kuru Forward</th>
                <th className="p-3.5 text-right">Basis Spread</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-xs sm:text-sm">
              {(curve.data?.rows ?? []).map((r) => {
                const basis = r.lastUsd != null && r.spotUsd ? ((r.lastUsd - r.spotUsd) / r.spotUsd) * 100 : null;
                const isDiscount = basis != null && basis <= 0;
                return (
                  <tr key={r.series.symbol} className="hover:bg-white/[0.03] transition-colors">
                    <td className="p-3.5 font-bold font-mono text-white flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-grid-cyan" />
                      {r.series.symbol}
                    </td>
                    <td className="p-3.5 text-gray-300">
                      {r.series.className}
                      <span className="text-gray-500 font-mono text-xs"> · {GPU_CLASSES[r.series.className]?.ratedTflops ?? "?"} TF</span>
                    </td>
                    <td className="p-3.5 text-gray-400 font-mono text-xs">
                      {fmtDate(r.series.windowStart)} – {fmtDate(r.series.windowEnd)}
                    </td>
                    <td className="p-3.5 text-right font-mono text-gray-300">
                      {r.spotUsd != null ? fmtUsd(r.spotUsd, 3) : "—"}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-grid-monad">
                      {r.lastUsd != null ? fmtUsd(r.lastUsd, 3) : "—"}
                    </td>
                    <td className="p-3.5 text-right font-mono">
                      {basis == null ? (
                        <span className="text-gray-500">—</span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            isDiscount
                              ? "text-grid-pass bg-grid-pass/10 border border-grid-pass/30"
                              : "text-grid-fail bg-grid-fail/10 border border-grid-fail/30"
                          }`}
                        >
                          {basis > 0 ? `+${basis.toFixed(1)}%` : `${basis.toFixed(1)}%`}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <Link
                        href={`/market/${r.series.symbol}`}
                        className="inline-block px-3 py-1.5 rounded-lg bg-surface hover:bg-grid-monad hover:text-black text-xs font-mono font-bold border border-white/10 hover:border-grid-monad transition-all duration-150"
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
  );
}
