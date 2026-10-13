"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
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
  for (const r of rows)
    byClass.set(r.series.className, [...(byClass.get(r.series.className) ?? []), r]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono font-bold">
        <div className="flex items-center gap-2 text-black uppercase">
          <span className="w-2.5 h-2.5 bg-black" />
          <span>FORWARD TERM STRUCTURE BY ACCELERATOR CLASS</span>
        </div>
        <div className="flex border-2 border-black shadow-neo-sm bg-white p-0.5">
          <button
            onClick={() => setViewMode("usd")}
            className={`px-3 py-1 text-xs font-bold font-mono uppercase transition-colors ${
              viewMode === "usd"
                ? "bg-neo-yellow text-black border-r-2 border-black font-black"
                : "text-gray-700 hover:text-black border-r-2 border-black"
            }`}
          >
            PRICE ($/hr)
          </button>
          <button
            onClick={() => setViewMode("basis")}
            className={`px-3 py-1 text-xs font-bold font-mono uppercase transition-colors ${
              viewMode === "basis"
                ? "bg-neo-yellow text-black font-black"
                : "text-gray-700 hover:text-black"
            }`}
          >
            SPREAD (BASIS %)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...byClass.entries()].map(([cls, rs]) => {
          const data = rs.map((r) => {
            const basis =
              r.lastUsd != null && r.spotUsd ? ((r.lastUsd - r.spotUsd) / r.spotUsd) * 100 : 0;
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
              className="bg-white border-2 border-black shadow-neo p-5 relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4 border-b-2 border-black pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-black text-lg uppercase tracking-tight">{cls}</h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 border border-black font-bold uppercase shadow-neo-sm ${
                        isDiscount ? "bg-neo-green text-black" : "bg-neo-pink text-black"
                      }`}
                    >
                      {latestBasis > 0 ? `+${latestBasis}% PREM` : `${latestBasis}% DISCOUNT`}
                    </span>
                  </div>
                  <div className="text-xs text-gray-700 font-mono font-bold mt-1">
                    Ornn Spot: ${data[0]?.spot ? data[0].spot.toFixed(2) : "—"} / hr
                  </div>
                </div>

                <Link
                  href={`/market/${data[0]?.symbol ?? "gT4-NOW"}`}
                  className="px-3 py-1 bg-neo-yellow hover:bg-neo-yellowDark border-2 border-black text-xs font-mono font-black uppercase text-black shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px]"
                >
                  Trade →
                </Link>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -14 }}>
                    <defs>
                      <linearGradient id={`grad-${cls.replace(/\s+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FEF08A" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#FEF08A" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="tenor" stroke="#000000" fontSize={11} tickLine={true} axisLine={true} />
                    <YAxis
                      stroke="#000000"
                      fontSize={11}
                      tickLine={true}
                      axisLine={true}
                      domain={viewMode === "usd" ? [Math.max(0, lo - pad), hi + pad] : ["auto", "auto"]}
                      tickFormatter={(v: number) =>
                        viewMode === "usd" ? `$${v.toFixed(2)}` : `${v > 0 ? "+" : ""}${v}%`
                      }
                      width={52}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-white border-2 border-black p-3 text-xs font-mono shadow-neo space-y-1">
                              <div className="font-black text-black text-xs border-b-2 border-black pb-1 uppercase">
                                {item.symbol} ({item.tenor})
                              </div>
                              <div className="flex justify-between gap-4 text-black font-bold">
                                <span>Kuru Forward:</span>
                                <span>${item.kuru?.toFixed(4) ?? "—"} / hr</span>
                              </div>
                              <div className="flex justify-between gap-4 text-gray-700">
                                <span>Spot Index:</span>
                                <span>${item.spot?.toFixed(4) ?? "—"} / hr</span>
                              </div>
                              <div className="flex justify-between gap-4 pt-1 border-t border-black font-black">
                                <span>Basis Spread:</span>
                                <span className={item.basisPct <= 0 ? "text-green-700" : "text-rose-700"}>
                                  {item.basisPct > 0 ? `+${item.basisPct}%` : `${item.basisPct}%`}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", color: "#000" }} />
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
                      stroke="#000000"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      dot={{ r: 3, fill: "#000000" }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey={viewMode === "usd" ? "kuru" : "basisPct"}
                      name="Kuru Forward"
                      stroke="#000000"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#FEF08A", stroke: "#000000", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "#FEF08A", stroke: "#000000", strokeWidth: 2 }}
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
