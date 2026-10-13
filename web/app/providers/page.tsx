"use client";

import { addressUrl, ENVIO_GRAPHQL } from "@/lib/config";
import { readLeaderboard } from "@/lib/data";
import { fmtNum, shortAddr } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import { Badge, Card, Empty, ErrorBox, MockBanner, PageTitle, Spinner } from "@/components/ui";

export default function ProvidersPage() {
  const lb = usePoll(readLeaderboard, [], 10000);
  const rows = lb.data?.rows ?? [];

  const sourceBadge =
    lb.data?.source === "envio" ? (
      <Badge tone="pass">Envio indexer · live</Badge>
    ) : lb.data?.source === "chain" ? (
      <Badge tone="degraded">{ENVIO_GRAPHQL ? "Envio unreachable · reading chain" : "Direct chain reads"}</Badge>
    ) : lb.data ? (
      <Badge>preview</Badge>
    ) : undefined;

  return (
    <>
      <PageTitle
        title="Provider leaderboard"
        sub="Reputation comes only from verifier verdicts settled onchain. Ranked by fewest fails, then most passes."
        right={sourceBadge}
      />
      <MockBanner />

      <Card>
        {lb.loading && !lb.data ? (
          <Spinner />
        ) : lb.error && !lb.data ? (
          <ErrorBox>{lb.error}</ErrorBox>
        ) : !rows.length ? (
          <Empty>No providers have delivered yet.</Empty>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead className="text-gray-400 text-xs uppercase border-b border-grid-700">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3 text-center">Pass</th>
                  <th className="p-3 text-center">Degraded</th>
                  <th className="p-3 text-center">Fail</th>
                  <th className="p-3 text-center">No-show</th>
                  <th className="p-3 text-right">Pass rate</th>
                  <th className="p-3 text-right">Hours delivered</th>
                  <th className="p-3 text-right">Slashed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grid-700">
                {rows.map((p, i) => {
                  const total = p.passes + p.degraded + p.fails + p.timeouts;
                  const rate = total ? (p.passes / total) * 100 : null;
                  return (
                    <tr key={p.address} className="hover:bg-grid-700/30">
                      <td className="p-3 font-bold text-gray-500">{i + 1}</td>
                      <td className="p-3">
                        <div className="font-semibold">{p.name || "Unnamed provider"}</div>
                        <a href={addressUrl(p.address)} target="_blank" rel="noreferrer" className="text-xs font-mono text-gray-500 hover:underline">
                          {shortAddr(p.address)}
                        </a>
                      </td>
                      <td className="p-3 text-center text-grid-pass font-bold">{p.passes}</td>
                      <td className="p-3 text-center text-grid-degraded font-bold">{p.degraded}</td>
                      <td className="p-3 text-center text-grid-fail font-bold">{p.fails}</td>
                      <td className="p-3 text-center text-grid-fail">{p.timeouts}</td>
                      <td className="p-3 text-right font-mono">{rate == null ? "—" : `${rate.toFixed(0)}%`}</td>
                      <td className="p-3 text-right font-mono text-gray-300">{fmtNum(p.hoursDelivered, 0)} h</td>
                      <td className={`p-3 text-right font-mono ${p.slashed > 0 ? "text-grid-fail" : "text-gray-500"}`}>{fmtNum(p.slashed)} gUSD</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
