"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { txUrl } from "./config";

type Toast = { id: number; kind: "pending" | "success" | "error" | "info"; text: string; hash?: string };

type ToastApi = {
  push: (t: Omit<Toast, "id">) => number;
  update: (id: number, t: Partial<Omit<Toast, "id">>) => void;
  dismiss: (id: number) => void;
};

const Ctx = createContext<ToastApi | null>(null);
let seq = 0;

const tone: Record<Toast["kind"], string> = {
  pending: "border-grid-monad/50 text-grid-monad",
  success: "border-grid-pass/50 text-grid-pass",
  error: "border-grid-fail/50 text-grid-fail",
  info: "border-grid-600 text-gray-200",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const autoDismiss = useCallback(
    (id: number, kind: Toast["kind"]) => {
      if (kind !== "pending") setTimeout(() => dismiss(id), kind === "error" ? 12000 : 7000);
    },
    [dismiss],
  );
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq;
      setToasts((ts) => [...ts.slice(-4), { ...t, id }]);
      autoDismiss(id, t.kind);
      return id;
    },
    [autoDismiss],
  );
  const update = useCallback(
    (id: number, patch: Partial<Omit<Toast, "id">>) => {
      setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      if (patch.kind) autoDismiss(id, patch.kind);
    },
    [autoDismiss],
  );

  return (
    <Ctx.Provider value={{ push, update, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:w-96" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg border bg-grid-800/95 backdrop-blur px-4 py-3 text-sm shadow-xl ${tone[t.kind]}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="break-words min-w-0">
                {t.kind === "pending" && <span className="inline-block w-3 h-3 mr-2 rounded-full border-2 border-current border-t-transparent animate-spin align-[-2px]" />}
                {t.text}
              </span>
              <button onClick={() => dismiss(t.id)} className="text-gray-500 hover:text-white shrink-0" aria-label="Dismiss">
                ×
              </button>
            </div>
            {t.hash && (
              <a href={txUrl(t.hash)} target="_blank" rel="noreferrer" className="mt-1 block text-xs underline text-gray-400 hover:text-white font-mono">
                {t.hash.slice(0, 10)}…{t.hash.slice(-8)} on explorer ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast outside ToastProvider");
  return v;
}
