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
  const bal = usePoll(() => (session ? readBalances(session.address) : Promise.resolve(undefined)), [session?.address], 15000);

  const faucet = () =>
    write("Claim 1,000 gUSD", { address: CONTRACTS.gridUSD, abi: gridUsdAbi, functionName: "faucet" }).catch(() => {});

  return (
    <>
      <div className="bg-gradient-to-br from-grid-800 to-grid-700/50 p-6 sm:p-8 rounded-2xl border border-grid-700">
        <div className="max-w-2xl space-y-4">
          <Badge tone="monad">Live on Monad Testnet</Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Physically delivered GPU forwards</h1>
          <p className="text-gray-300 sm:text-lg leading-relaxed">
            Lock in compute before prices spike. Providers mint GPU-hours against a 120% bond and sell them on a Kuru order book. If
            the in-pod verifier fails the machine, the bond is slashed to you in one block.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/market/gT4-NOW" className="px-5 py-3 rounded-xl bg-grid-monad text-black font-semibold hover:opacity-90">
              Trade on Kuru →
            </Link>
            {session ? (
              <Button variant="ghost" onClick={faucet} loading={pending} disabled={IS_MOCK} className="!py-3 !rounded-xl">
                Claim 1,000 gUSD faucet
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => signIn()} loading={busy} className="!py-3 !rounded-xl">
                Passkey sign in
              </Button>
            )}
          </div>
          {session && bal.data && (
            <p className="text-sm text-gray-400">
              Balance: <span className="text-white font-mono">{gusd(bal.data.gusd).toFixed(2)} gUSD</span>
            </p>
          )}
        </div>
      </div>

      <GasWarning mon={bal.data?.mon} />
      <MockBanner />

      <div className="p-3 sm:p-4 rounded-xl bg-purple-950/40 border border-purple-800/60 text-sm text-purple-200 flex gap-3 items-start">
        <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-purple-800 text-white shrink-0 mt-0.5">Demo mode</span>
        <span>
          <strong className="text-white">gT4-NOW</strong> uses a fixed ${GPU_CLASSES.T4?.referencePriceUsd.toFixed(2)}/hr reference price so it
          can be delivered and verified live on a free Colab T4. The other series track the Ornn index via Chainlink CRE.
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-bold">Forward curve</h2>
          {curve.data && <span className="text-xs text-gray-500">source: {curve.data.source}</span>}
        </div>
        {curve.loading && !curve.data ? (
          <Spinner />
        ) : curve.error && !curve.data ? (
          <ErrorBox>Couldn&apos;t load the curve: {curve.error}</ErrorBox>
        ) : (
          curve.data && <ForwardCurve rows={curve.data.rows} />
        )}
      </div>

      <Card title="Series">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left text-sm min-w-[640px]">
            <thead className="text-gray-400 text-xs uppercase border-b border-grid-700">
              <tr>
                <th className="p-3">Series</th>
                <th className="p-3">GPU</th>
                <th className="p-3">Delivery window</th>
                <th className="p-3 text-right">Spot index</th>
                <th className="p-3 text-right">Kuru</th>
                <th className="p-3 text-right">Basis</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-grid-700">
              {(curve.data?.rows ?? []).map((r) => {
                const basis = r.lastUsd != null && r.spotUsd ? (r.lastUsd / r.spotUsd - 1) * 100 : null;
                return (
                  <tr key={r.series.symbol} className="hover:bg-grid-700/30">
                    <td className="p-3 font-semibold">{r.series.symbol}</td>
                    <td className="p-3 text-gray-300">
                      {r.series.className}
                      <span className="text-gray-500"> · {GPU_CLASSES[r.series.className]?.ratedTflops ?? "?"} TF</span>
                    </td>
                    <td className="p-3 text-gray-400">
                      {fmtDate(r.series.windowStart)} – {fmtDate(r.series.windowEnd)}
                    </td>
                    <td className="p-3 text-right font-mono">{r.spotUsd != null ? fmtUsd(r.spotUsd, 3) : "—"}</td>
                    <td className="p-3 text-right font-mono text-grid-monad">{r.lastUsd != null ? fmtUsd(r.lastUsd, 3) : "—"}</td>
                    <td className={`p-3 text-right font-mono ${basis == null ? "text-gray-500" : basis >= 0 ? "text-grid-pass" : "text-grid-fail"}`}>
                      {basis == null ? "—" : `${basis >= 0 ? "+" : ""}${basis.toFixed(1)}%`}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/market/${r.series.symbol}`}
                        className="inline-block px-3 py-1.5 rounded-lg bg-grid-700 hover:bg-grid-600 text-xs font-semibold border border-grid-600"
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
    </>
  );
}
