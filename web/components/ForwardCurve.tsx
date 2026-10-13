"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurveRow } from "@/lib/data";

const tenor = (symbol: string) => symbol.split("-").slice(1).join("-") || symbol;

/** One small curve per GPU class: Kuru price per delivery week vs the spot index. */
export function ForwardCurve({ rows }: { rows: CurveRow[] }) {
  const byClass = new Map<string, CurveRow[]>();
  for (const r of rows) byClass.set(r.series.className, [...(byClass.get(r.series.className) ?? []), r]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[...byClass.entries()].map(([cls, rs]) => {
        const data = rs.map((r) => ({ tenor: tenor(r.series.symbol), kuru: r.lastUsd ?? undefined, spot: r.spotUsd ?? undefined }));
        const vals = data.flatMap((d) => [d.kuru, d.spot]).filter((v): v is number => v != null);
        const lo = vals.length ? Math.min(...vals) : 0;
        const hi = vals.length ? Math.max(...vals) : 1;
        const pad = Math.max((hi - lo) * 0.25, hi * 0.05, 0.01);
        return (
          <div key={cls} className="bg-grid-800 border border-grid-700 rounded-xl p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-semibold">{cls}</h3>
              <span className="text-xs text-gray-500">$/GPU-hour</span>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="#1e2436" vertical={false} />
                  <XAxis dataKey="tenor" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={[Math.max(0, lo - pad), hi + pad]}
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                    width={56}
                  />
                  <Tooltip
                    contentStyle={{ background: "#141824", border: "1px solid #2b3248", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => `$${v.toFixed(4)}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="spot" name="Spot index" stroke="#6b7280" strokeDasharray="4 4" dot={{ r: 3 }} isAnimationActive={false} connectNulls />
                  <Line type="monotone" dataKey="kuru" name="Kuru price" stroke="#836ef9" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
