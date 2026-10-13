"use client";

import { addressUrl, ENVIO_GRAPHQL } from "@/lib/config";
import { readLeaderboard } from "@/lib/data";
import { fmtNum, shortAddr } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import { Badge, Card, Empty, ErrorBox, MockBanner, PageTitle, Spinner, StatMetric } from "@/components/ui";

export default function ProvidersPage() {
  const lb = usePoll(readLeaderboard, [], 10000);
  const rows = lb.data?.rows ?? [];

  const totalDelivered = rows.reduce((acc, r) => acc + (r.hoursDelivered || 0), 0);
  const totalSlashed = rows.reduce((acc, r) => acc + (r.slashed || 0), 0);
  const totalPasses = rows.reduce((acc, r) => acc + (r.passes || 0), 0);
  const totalSessions = rows.reduce(
    (acc, r) => acc + r.passes + r.degraded + r.fails + r.timeouts,
    0
  );
  const netPassRate = totalSessions > 0 ? ((totalPasses / totalSessions) * 100).toFixed(1) : "100.0";

  const sourceBadge =
    lb.data?.source === "envio" ? (
      <Badge tone="pass">Envio Indexer · Live 400ms</Badge>
    ) : lb.data?.source === "chain" ? (
      <Badge tone="degraded">
        {ENVIO_GRAPHQL ? "Envio Reconnecting · Direct RPC" : "Direct RPC Chain Reads"}
      </Badge>
    ) : lb.data ? (
      <Badge tone="neutral">Preview Data Mode</Badge>
    ) : undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-black">
      <PageTitle
        title="Compute Provider Reputation Wall"
        sub="Node reputation is derived strictly from cryptographic hardware verifier verdicts settled on Monad. Ranked by zero fail history, then total verified compute hours."
        right={sourceBadge}
      />
      <MockBanner />

      {/* Network Health Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatMetric
          label="Network Reliability"
          value={`${netPassRate}%`}
          positive={Number(netPassRate) >= 90}
          sub="Verified pass ratio"
        />
        <StatMetric
          label="Total Hours Delivered"
          value={`${fmtNum(totalDelivered, 0)} h`}
          sub="Physical compute hours"
        />
        <StatMetric
          label="Collateral Slashed"
          value={`${fmtNum(totalSlashed)} gUSD`}
          delta={totalSlashed > 0 ? "SEIZURES RECORDED" : "ZERO FRAUD"}
          positive={totalSlashed === 0}
          sub="Awarded to tenant buyers"
        />
        <StatMetric
          label="Active Providers"
          value={String(rows.length)}
          sub="Registered node operators"
        />
      </div>

      <Card title="Provider Nodes Ranked by Proof of Delivery">
        {lb.loading && !lb.data ? (
          <Spinner />
        ) : lb.error && !lb.data ? (
          <ErrorBox>{lb.error}</ErrorBox>
        ) : !rows.length ? (
          <Empty>No providers have completed verifiable delivery sessions yet.</Empty>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0 sleek-scroll">
            <table className="w-full text-left text-xs sm:text-sm min-w-[760px] font-tabular">
              <thead className="text-black text-xs font-mono font-black uppercase tracking-wider border-b-2 border-black bg-neo-yellow">
                <tr>
                  <th className="p-3.5 text-center border-r border-black">Rank</th>
                  <th className="p-3.5 border-r border-black">Provider Node Identity</th>
                  <th className="p-3.5 text-center border-r border-black">Pass (100%)</th>
                  <th className="p-3.5 text-center border-r border-black">Degraded (30%)</th>
                  <th className="p-3.5 text-center border-r border-black">Fail (Slashed)</th>
                  <th className="p-3.5 text-center border-r border-black">No-Show</th>
                  <th className="p-3.5 text-right border-r border-black">Reliability</th>
                  <th className="p-3.5 text-right border-r border-black">Hours Delivered</th>
                  <th className="p-3.5 text-right">Slashed Penalty</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {rows.map((p, i) => {
                  const total = p.passes + p.degraded + p.fails + p.timeouts;
                  const rate = total ? (p.passes / total) * 100 : null;
                  const rankBadge =
                    i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;

                  return (
                    <tr key={p.address} className="hover:bg-neutral-50 transition-colors">
                      <td className="p-3.5 text-center font-mono font-black text-black text-sm border-r border-black">
                        {rankBadge}
                      </td>
                      <td className="p-3.5 space-y-0.5 border-r border-black">
                        <div className="font-black text-black text-sm flex items-center gap-1.5">
                          <span>{p.name || "Unnamed Provider"}</span>
                          {i === 0 && (
                            <span className="text-[10px] bg-neo-yellow px-1 border border-black font-mono font-bold">
                              TOP NODE
                            </span>
                          )}
                        </div>
                        <a
                          href={addressUrl(p.address)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-mono text-gray-700 hover:text-black underline"
                        >
                          {shortAddr(p.address)} ↗
                        </a>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-black border-r border-black">
                        <span className="px-2 py-0.5 bg-neo-green border border-black shadow-neo-sm">
                          {p.passes}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-black border-r border-black">
                        <span className="px-2 py-0.5 bg-neo-yellow border border-black shadow-neo-sm">
                          {p.degraded}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-black border-r border-black">
                        <span className="px-2 py-0.5 bg-neo-pink border border-black shadow-neo-sm">
                          {p.fails}
                        </span>
                      </td>
                      <td className="p-3.5 text-center text-gray-700 font-mono font-bold border-r border-black">
                        {p.timeouts}
                      </td>
                      <td className="p-3.5 text-right border-r border-black">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-white border border-black overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-neo-green"
                              style={{ width: `${rate ?? 0}%` }}
                            />
                          </div>
                          <span className="font-mono font-black text-black text-xs">
                            {rate == null ? "—" : `${rate.toFixed(0)}%`}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 text-right font-mono text-black font-bold border-r border-black">
                        {fmtNum(p.hoursDelivered, 0)} h
                      </td>
                      <td
                        className={`p-3.5 text-right font-mono font-black ${
                          p.slashed > 0 ? "text-rose-700" : "text-gray-600"
                        }`}
                      >
                        {fmtNum(p.slashed)} gUSD
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
