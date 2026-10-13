"use client";

import Link from "next/link";
import { seriesById } from "@/lib/config";
import { STATUS, VERDICT, type DeliveryView } from "@/lib/data";
import { fmtDuration } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { Badge, Empty } from "./ui";

export function statusTone(d: Pick<DeliveryView, "status" | "verdict">) {
  if (d.status === 3) return d.verdict === 1 ? "pass" : d.verdict === 2 ? "degraded" : "fail";
  if (d.status === 4) return "fail";
  return d.status === 2 ? "cyan" : "neutral";
}

export function statusLabel(d: Pick<DeliveryView, "status" | "verdict">) {
  return d.status === 3 ? VERDICT[d.verdict] : STATUS[d.status];
}

export function DeliveryList({
  items,
  empty,
  action,
}: {
  items: DeliveryView[];
  empty: string;
  action?: (d: DeliveryView) => React.ReactNode;
}) {
  const now = useNow();
  if (!items.length) return <Empty>{empty}</Empty>;

  return (
    <ul className="divide-y divide-white/[0.06] font-tabular">
      {items.map((d) => {
        const left = d.deadline * 1000 - now;
        const s = seriesById(d.seriesId);
        return (
          <li
            key={d.id}
            className="py-3.5 px-3 -mx-3 rounded-xl transition-all duration-150 hover:bg-white/[0.03] flex flex-wrap items-center justify-between gap-3 group"
          >
            <Link href={`/delivery/${d.id}`} className="min-w-0 flex-1 space-y-0.5">
              <div className="font-bold text-white text-sm font-mono flex items-center gap-2 group-hover:text-grid-monad transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-grid-monad" />
                <span>
                  Delivery #{d.id} · {s?.symbol ?? `series ${d.seriesId}`}
                </span>
                <span className="text-gray-500 font-normal text-xs">({s?.className ?? "GPU"})</span>
              </div>
              <div className="text-xs text-gray-400 font-mono flex flex-wrap items-center gap-2">
                <span className="text-white font-semibold">{d.hours.toString()} GPU-Hours</span>
                <span className="text-gray-600">·</span>
                {d.status === 1 && (
                  <span className={left > 0 ? "text-grid-degraded" : "text-grid-fail"}>
                    {left > 0 ? `Provision deadline: ${fmtDuration(left)} left` : "Provision deadline expired"}
                  </span>
                )}
                {d.status === 2 && (
                  <span className="text-grid-cyan flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-grid-cyan animate-pulse" />
                    In-pod verifier executing challenge
                  </span>
                )}
                {d.status === 3 && d.tflopsE2 > 0 && (
                  <span className="text-gray-300">Measured: {(d.tflopsE2 / 100).toFixed(2)} TFLOPS</span>
                )}
              </div>
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              <Badge tone={statusTone(d)} pulse={d.status === 2}>
                {statusLabel(d)}
              </Badge>
              {action?.(d)}
              <Link
                href={`/delivery/${d.id}`}
                className="text-gray-500 group-hover:text-white transition-colors text-sm font-mono pl-1"
              >
                →
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
