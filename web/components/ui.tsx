"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { IS_MOCK, MON_FAUCET } from "@/lib/config";
import { useWallet } from "@/lib/wallet/WalletProvider";

export function Card({ title, right, children, className = "" }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-grid-800 border border-grid-700 rounded-xl p-4 sm:p-5 space-y-4 min-w-0 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; loading?: boolean };
export function Button({ variant = "primary", loading, className = "", children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: "bg-grid-monad text-black hover:opacity-90",
    ghost: "bg-grid-700 text-white border border-grid-600 hover:bg-grid-600",
    danger: "bg-grid-fail text-white hover:opacity-90",
  }[variant];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${v} ${className}`}
    >
      {loading && <span className="inline-block w-3.5 h-3.5 mr-2 rounded-full border-2 border-current border-t-transparent animate-spin align-[-2px]" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-400 block mb-1">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-500 block mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full bg-grid-900 border border-grid-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-grid-monad";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
      <span className="w-4 h-4 rounded-full border-2 border-grid-monad border-t-transparent animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="p-3 rounded-lg bg-grid-fail/10 border border-grid-fail/30 text-grid-fail text-sm break-words">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-sm text-gray-500">{children}</div>;
}

export function Badge({ tone = "neutral", children }: { tone?: "pass" | "degraded" | "fail" | "monad" | "neutral"; children: ReactNode }) {
  const t = {
    pass: "bg-grid-pass/15 text-grid-pass border-grid-pass/30",
    degraded: "bg-grid-degraded/15 text-grid-degraded border-grid-degraded/30",
    fail: "bg-grid-fail/15 text-grid-fail border-grid-fail/30",
    monad: "bg-grid-monad/15 text-grid-monad border-grid-monad/30",
    neutral: "bg-grid-700 text-gray-300 border-grid-600",
  }[tone];
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${t}`}>{children}</span>;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="shrink-0 text-xs px-2 py-1 rounded bg-grid-700 hover:bg-grid-600 border border-grid-600 text-gray-200"
    >
      {done ? "Copied" : label}
    </button>
  );
}

export function PageTitle({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold break-words">{title}</h1>
        {sub && <p className="text-gray-400 text-sm mt-1">{sub}</p>}
      </div>
      {right && <div className="self-start sm:self-auto max-w-full">{right}</div>}
    </div>
  );
}

/** Wraps an action area: prompts sign-in when there's no session. */
export function SignInGate({ children, what = "do this" }: { children: ReactNode; what?: string }) {
  const { session, signIn, busy } = useWallet();
  if (session) return <>{children}</>;
  return (
    <div className="p-4 rounded-lg bg-grid-900 border border-dashed border-grid-600 text-sm text-gray-300 space-y-3">
      <p>Sign in with your passkey to {what}. One prompt unlocks a trading-only session.</p>
      <Button onClick={() => signIn()} loading={busy}>
        Passkey sign in
      </Button>
    </div>
  );
}

export function MockBanner() {
  if (!IS_MOCK) return null;
  return (
    <div className="p-3 rounded-lg bg-grid-degraded/10 border border-grid-degraded/30 text-grid-degraded text-xs sm:text-sm">
      <strong>Preview data.</strong> <code>deployments/testnet.json</code> still has placeholder addresses, so this page shows demo
      numbers and transactions are disabled. Real data appears once the contracts deploy.
    </div>
  );
}

export function GasWarning({ mon }: { mon?: bigint }) {
  const { session } = useWallet();
  if (!session || IS_MOCK || mon === undefined || mon > 0n) return null;
  return (
    <div className="p-3 rounded-lg bg-grid-monad/10 border border-grid-monad/30 text-sm text-gray-200 space-y-2">
      <p>
        Your passkey wallet has no MON for gas. Grab testnet MON from the{" "}
        <a href={MON_FAUCET} target="_blank" rel="noreferrer" className="underline text-grid-monad">
          Monad faucet
        </a>{" "}
        for this address:
      </p>
      <div className="flex items-center gap-2">
        <code className="text-xs break-all text-grid-monad">{session.address}</code>
        <CopyButton text={session.address} />
      </div>
    </div>
  );
}
