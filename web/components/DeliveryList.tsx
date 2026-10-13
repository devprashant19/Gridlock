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
  return d.status === 2 ? "monad" : "neutral";
}

export function statusLabel(d: Pick<DeliveryView, "status" | "verdict">) {
  return d.status === 3 ? VERDICT[d.verdict] : STATUS[d.status];
}

export function DeliveryList({ items, empty, action }: { items: DeliveryView[]; empty: string; action?: (d: DeliveryView) => React.ReactNode }) {
  const now = useNow();
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-grid-700">
      {items.map((d) => {
        const left = d.deadline * 1000 - now;
        return (
          <li key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
            <Link href={`/delivery/${d.id}`} className="min-w-0 group">
              <div className="font-semibold group-hover:underline">
                Delivery #{d.id} · {seriesById(d.seriesId)?.symbol ?? `series ${d.seriesId}`}
              </div>
              <div className="text-xs text-gray-400">
                {d.hours.toString()} h
                {d.status === 1 && (left > 0 ? ` · provision due in ${fmtDuration(left)}` : " · provision deadline passed")}
                {d.status === 3 && d.tflopsE2 > 0 && ` · ${(d.tflopsE2 / 100).toFixed(2)} TFLOPS`}
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Badge tone={statusTone(d)}>{statusLabel(d)}</Badge>
              {action?.(d)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
