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
    <ul className="divide-y-2 divide-black font-tabular">
      {items.map((d) => {
        const left = d.deadline * 1000 - now;
        const s = seriesById(d.seriesId);
        return (
          <li
            key={d.id}
            className="py-4 px-3 -mx-3 hover:bg-neutral-50 transition-colors flex flex-wrap items-center justify-between gap-3 group"
          >
            <Link href={`/delivery/${d.id}`} className="min-w-0 flex-1 space-y-1">
              <div className="font-black text-black text-sm font-mono flex items-center gap-2 group-hover:underline">
                <span className="w-2 h-2 bg-black" />
                <span>
                  Delivery #{d.id} · {s?.symbol ?? `series ${d.seriesId}`}
                </span>
                <span className="text-gray-600 font-bold text-xs">({s?.className ?? "GPU"})</span>
              </div>
              <div className="text-xs text-gray-700 font-mono flex flex-wrap items-center gap-2">
                <span className="text-black font-bold">{d.hours.toString()} GPU-Hours</span>
                <span>·</span>
                {d.status === 1 && (
                  <span className={left > 0 ? "text-amber-700 font-bold" : "text-rose-700 font-bold"}>
                    {left > 0 ? `Provision deadline: ${fmtDuration(left)} left` : "Provision deadline expired"}
                  </span>
                )}
                {d.status === 2 && (
                  <span className="text-black font-bold bg-neo-blue px-1 border border-black">
                    In-pod verifier executing challenge
                  </span>
                )}
                {d.status === 3 && d.tflopsE2 > 0 && (
                  <span className="text-black font-bold">Measured: {(d.tflopsE2 / 100).toFixed(2)} TFLOPS</span>
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
                className="w-7 h-7 bg-white border-2 border-black shadow-neo-sm flex items-center justify-center text-black font-bold text-xs hover:bg-neo-yellow transition-colors"
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
