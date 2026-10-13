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
  const totalSessions = rows.reduce((acc, r) => acc + r.passes + r.degraded + r.fails + r.timeouts, 0);
  const netPassRate = totalSessions > 0 ? ((totalPasses / totalSessions) * 100).toFixed(1) : "100.0";

  const sourceBadge =
    lb.data?.source === "envio" ? (
      <Badge tone="pass" pulse>
        Envio Indexer · Live 400ms
      </Badge>
    ) : lb.data?.source === "chain" ? (
      <Badge tone="degraded">
        {ENVIO_GRAPHQL ? "Envio Reconnecting · Direct Chain Reads" : "Direct RPC Chain Reads"}
      </Badge>
    ) : lb.data ? (
      <Badge tone="neutral">Preview Data Mode</Badge>
    ) : undefined;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Compute Provider Reputation Wall"
        sub="Node reputation is derived strictly from cryptographic hardware verifier verdicts settled on Monad. Ranked by zero fail history, then total verified compute hours."
        right={sourceBadge}
      />
      <MockBanner />

      {/* Network Health Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              <thead className="text-gray-400 text-[11px] font-mono uppercase tracking-wider border-b border-white/[0.08] bg-obsidian/40">
                <tr>
                  <th className="p-3.5 text-center">Rank</th>
                  <th className="p-3.5">Provider Node Identity</th>
                  <th className="p-3.5 text-center">Pass (100%)</th>
                  <th className="p-3.5 text-center">Degraded (30%)</th>
                  <th className="p-3.5 text-center">Fail (Slashed)</th>
                  <th className="p-3.5 text-center">No-Show</th>
                  <th className="p-3.5 text-right">Reliability Bar</th>
                  <th className="p-3.5 text-right">Hours Delivered</th>
                  <th className="p-3.5 text-right">Slashed Penalty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.map((p, i) => {
                  const total = p.passes + p.degraded + p.fails + p.timeouts;
                  const rate = total ? (p.passes / total) * 100 : null;
                  const rankBadge =
                    i === 0
                      ? "🥇"
                      : i === 1
                      ? "🥈"
                      : i === 2
                      ? "🥉"
                      : `#${i + 1}`;

                  return (
                    <tr key={p.address} className="hover:bg-white/[0.03] transition-colors">
                      <td className="p-3.5 text-center font-mono font-bold text-white text-sm">
                        {rankBadge}
                      </td>
                      <td className="p-3.5 space-y-0.5">
                        <div className="font-bold text-white text-sm flex items-center gap-1.5">
                          <span>{p.name || "Unnamed Provider"}</span>
                          {i === 0 && <span className="text-[10px] text-grid-cyan font-mono">[TOP NODE]</span>}
                        </div>
                        <a
                          href={addressUrl(p.address)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-mono text-gray-500 hover:text-grid-cyan transition-colors"
                        >
                          {shortAddr(p.address)} ↗
                        </a>
                      </td>
                      <td className="p-3.5 text-center text-grid-pass font-mono font-bold">{p.passes}</td>
                      <td className="p-3.5 text-center text-grid-degraded font-mono font-bold">{p.degraded}</td>
                      <td className="p-3.5 text-center text-grid-fail font-mono font-bold">{p.fails}</td>
                      <td className="p-3.5 text-center text-gray-500 font-mono">{p.timeouts}</td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10 hidden sm:block">
                            <div
                              className="h-full bg-grid-pass rounded-full"
                              style={{ width: `${rate ?? 0}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-white text-xs">
                            {rate == null ? "—" : `${rate.toFixed(0)}%`}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 text-right font-mono text-gray-300 font-medium">
                        {fmtNum(p.hoursDelivered, 0)} h
                      </td>
                      <td
                        className={`p-3.5 text-right font-mono font-bold ${
                          p.slashed > 0 ? "text-grid-fail" : "text-gray-500"
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
