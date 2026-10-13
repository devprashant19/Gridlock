"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  ComposedChart,
} from "recharts";
import type { CurveRow } from "@/lib/data";

const tenor = (symbol: string) => symbol.split("-").slice(1).join("-") || symbol;

export function ForwardCurve({ rows }: { rows: CurveRow[] }) {
  const [viewMode, setViewMode] = useState<"usd" | "basis">("usd");
  const byClass = new Map<string, CurveRow[]>();
  for (const r of rows) byClass.set(r.series.className, [...(byClass.get(r.series.className) ?? []), r]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs font-mono">
        <div className="flex items-center gap-2 text-gray-400">
          <span className="w-2 h-2 rounded-full bg-grid-monad animate-pulse" />
          <span>FORWARD TERM STRUCTURE BY ACCELERATOR CLASS</span>
        </div>
        <div className="flex rounded-lg bg-surface border border-white/10 p-0.5">
          <button
            onClick={() => setViewMode("usd")}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
              viewMode === "usd" ? "bg-grid-monad text-black font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            PRICE ($/hr)
          </button>
          <button
            onClick={() => setViewMode("basis")}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
              viewMode === "basis" ? "bg-grid-monad text-black font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            SPREAD (BASIS %)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...byClass.entries()].map(([cls, rs]) => {
          const data = rs.map((r) => {
            const basis = r.lastUsd != null && r.spotUsd ? ((r.lastUsd - r.spotUsd) / r.spotUsd) * 100 : 0;
            return {
              symbol: r.series.symbol,
              tenor: tenor(r.series.symbol),
              kuru: r.lastUsd ?? undefined,
              spot: r.spotUsd ?? undefined,
              basisPct: Number(basis.toFixed(2)),
            };
          });

          const latestBasis = data[0]?.basisPct ?? 0;
          const isDiscount = latestBasis <= 0;
          const vals = data.flatMap((d) => [d.kuru, d.spot]).filter((v): v is number => v != null);
          const lo = vals.length ? Math.min(...vals) : 0;
          const hi = vals.length ? Math.max(...vals) : 1;
          const pad = Math.max((hi - lo) * 0.25, hi * 0.05, 0.01);

          return (
            <div
              key={cls}
              className="hud-box rounded-xl p-4 sm:p-5 relative overflow-hidden transition-all duration-300 hover:border-grid-monad/40"
            >
              <div className="flex items-start justify-between mb-3 border-b border-white/[0.06] pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base tracking-tight">{cls}</h3>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        isDiscount ? "text-grid-pass bg-grid-pass/10 border border-grid-pass/30" : "text-grid-fail bg-grid-fail/10 border border-grid-fail/30"
                      }`}
                    >
                      {latestBasis > 0 ? `+${latestBasis}% PREM` : `${latestBasis}% DISCOUNT`}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                    Ornn Spot Benchmark: ${data[0]?.spot ? data[0].spot.toFixed(2) : "—"} / hr
                  </div>
                </div>

                <Link
                  href={`/market/${data[0]?.symbol ?? "gT4-NOW"}`}
                  className="px-2.5 py-1 rounded bg-surface hover:bg-grid-700/80 border border-white/10 hover:border-grid-monad/50 text-[11px] font-mono font-bold text-grid-cyan transition-colors"
                >
                  Trade →
                </Link>
              </div>

              <div className="h-44 sm:h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -14 }}>
                    <defs>
                      <linearGradient id={`grad-${cls.replace(/\s+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#836ef9" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#836ef9" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis dataKey="tenor" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#6b7280"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      domain={viewMode === "usd" ? [Math.max(0, lo - pad), hi + pad] : ["auto", "auto"]}
                      tickFormatter={(v: number) => (viewMode === "usd" ? `$${v.toFixed(2)}` : `${v > 0 ? "+" : ""}${v}%`)}
                      width={52}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-obsidian/95 border border-white/15 p-2.5 rounded-lg text-xs font-mono shadow-xl space-y-1">
                              <div className="font-bold text-white text-[11px] border-b border-white/10 pb-1">
                                {item.symbol} ({item.tenor})
                              </div>
                              <div className="flex justify-between gap-4 text-gray-300">
                                <span>Kuru Forward:</span>
                                <span className="font-bold text-grid-monad">${item.kuru?.toFixed(4) ?? "—"} / hr</span>
                              </div>
                              <div className="flex justify-between gap-4 text-gray-400">
                                <span>Spot Index:</span>
                                <span>${item.spot?.toFixed(4) ?? "—"} / hr</span>
                              </div>
                              <div className="flex justify-between gap-4 pt-1 border-t border-white/10 font-bold">
                                <span>Basis Spread:</span>
                                <span className={item.basisPct <= 0 ? "text-grid-pass" : "text-grid-fail"}>
                                  {item.basisPct > 0 ? `+${item.basisPct}%` : `${item.basisPct}%`}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace" }} />
                    <Area
                      type="monotone"
                      dataKey={viewMode === "usd" ? "kuru" : "basisPct"}
                      fill={`url(#grad-${cls.replace(/\s+/g, "")})`}
                      stroke="none"
                    />
                    <Line
                      type="monotone"
                      dataKey={viewMode === "usd" ? "spot" : undefined}
                      name="Ornn Spot"
                      stroke="#6b7280"
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: "#6b7280" }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey={viewMode === "usd" ? "kuru" : "basisPct"}
                      name="Kuru Forward"
                      stroke="#836ef9"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#00f5d4", stroke: "#836ef9", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "#00f5d4", stroke: "#fff", strokeWidth: 2 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
