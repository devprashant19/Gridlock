"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { IS_MOCK, MON_FAUCET } from "@/lib/config";
import { useWallet } from "@/lib/wallet/WalletProvider";

export function Card({
  title,
  right,
  children,
  className = "",
  glow = false,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <section
      className={`bg-white border-2 border-black shadow-neo p-4 sm:p-5 space-y-4 min-w-0 ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-3">
          {title && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-4 bg-black inline-block" />
              <h2 className="text-base sm:text-lg font-black tracking-tight uppercase text-black">
                {title}
              </h2>
            </div>
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function HUDCard({
  title,
  badge,
  children,
  className = "",
}: {
  title: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border-2 border-black shadow-neo p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b-2 border-black pb-2.5 mb-3.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-black" />
          <span className="text-xs font-mono uppercase tracking-wider text-black font-bold">
            {title}
          </span>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

export function StatMetric({
  label,
  value,
  sub,
  delta,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  positive?: boolean;
}) {
  return (
    <div className="p-3 bg-white border-2 border-black shadow-neo-sm space-y-1">
      <div className="text-[11px] font-mono uppercase text-gray-700 font-bold tracking-wider flex justify-between items-center">
        <span>{label}</span>
        {delta && (
          <span
            className={`text-[10px] px-1.5 py-0.5 border border-black font-bold uppercase ${
              positive ? "bg-neo-green text-black" : "bg-neo-pink text-black"
            }`}
          >
            {delta}
          </span>
        )}
      </div>
      <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-black">
        {value}
      </div>
      {sub && <div className="text-[11px] text-gray-600 font-medium">{sub}</div>}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "cyan" | "green";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: BtnProps) {
  const v = {
    primary: "bg-neo-yellow hover:bg-neo-yellowDark text-black shadow-neo-sm",
    cyan: "bg-neo-blue hover:bg-sky-300 text-black shadow-neo-sm",
    green: "bg-neo-green hover:bg-emerald-300 text-black shadow-neo-sm",
    ghost: "bg-white hover:bg-neutral-100 text-black shadow-neo-sm",
    danger: "bg-neo-pink hover:bg-pink-400 text-black shadow-neo-sm",
  }[variant];

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-bold font-mono uppercase text-xs sm:text-sm px-4 py-2.5 border-2 border-black transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed ${v} ${className}`}
    >
      {loading && (
        <span className="inline-block w-3.5 h-3.5 mr-2 rounded-full border-2 border-black border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-black font-bold uppercase tracking-wider">{label}</span>
        {hint && <span className="text-[11px] text-gray-600 font-mono">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full bg-white border-2 border-black p-2.5 text-black font-mono text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black shadow-neo-sm transition-all";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-xs font-mono uppercase tracking-wider text-black font-bold py-6 justify-center">
      <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="p-3 bg-neo-pink/30 border-2 border-black shadow-neo-sm text-black text-xs sm:text-sm font-bold flex items-start gap-2">
      <span className="text-base shrink-0">⚠</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="py-8 text-center text-xs sm:text-sm text-black font-mono uppercase font-bold tracking-wider border-2 border-dashed border-black bg-white p-4">
      {children}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  pulse = false,
  children,
}: {
  tone?: "pass" | "degraded" | "fail" | "monad" | "cyan" | "neutral" | "yellow" | "pink" | "green" | "blue";
  pulse?: boolean;
  children: ReactNode;
}) {
  const t = {
    pass: "bg-neo-green text-black",
    degraded: "bg-neo-yellow text-black",
    fail: "bg-neo-pink text-black",
    monad: "bg-purple-200 text-black",
    cyan: "bg-neo-blue text-black",
    yellow: "bg-neo-yellow text-black",
    pink: "bg-neo-pink text-black",
    green: "bg-neo-green text-black",
    blue: "bg-neo-blue text-black",
    neutral: "bg-white text-black",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 border-2 border-black text-xs font-mono font-bold uppercase tracking-wider shadow-neo-sm whitespace-nowrap ${t}`}
    >
      {pulse && <span className="w-2 h-2 rounded-full bg-black animate-ping" />}
      {!pulse && <span className="w-1.5 h-1.5 bg-black" />}
      {children}
    </span>
  );
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
        } catch {}
      }}
      className="shrink-0 text-[11px] font-mono font-bold uppercase px-2 py-0.5 bg-white hover:bg-black hover:text-white border-2 border-black text-black transition-colors shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px]"
    >
      {done ? "✓ Copied" : label}
    </button>
  );
}

export function PageTitle({
  title,
  sub,
  right,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b-2 border-black pb-4 mb-4">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-black break-words flex items-center gap-2.5">
          <span className="w-3 h-6 bg-black inline-block" />
          {title}
        </h1>
        {sub && (
          <p className="text-gray-700 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
            {sub}
          </p>
        )}
      </div>
      {right && <div className="self-start sm:self-auto max-w-full shrink-0">{right}</div>}
    </div>
  );
}

/** Wraps an action area: prompts sign-in when there's no session. */
export function SignInGate({
  children,
  what = "do this",
}: {
  children: ReactNode;
  what?: string;
}) {
  const { session, signIn, signInDemo, busy } = useWallet();
  if (session) return <>{children}</>;
  return (
    <div className="p-6 bg-white border-2 border-black shadow-neo text-center space-y-3 relative overflow-hidden">
      <div className="w-12 h-12 mx-auto bg-neo-yellow border-2 border-black shadow-neo-sm flex items-center justify-center text-black text-2xl font-bold">
        ⚿
      </div>
      <div className="max-w-md mx-auto space-y-1">
        <div className="font-black uppercase text-black text-base">
          Passkey Authentication Required
        </div>
        <p className="text-xs text-gray-700 font-medium">
          Sign in with your biometric passkey to {what}. One prompt creates a scoped, trading-only session with zero extension popups.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
        <Button onClick={() => signIn()} loading={busy} className="!py-2.5 !px-6">
          Sign in with Passkey
        </Button>
        <button
          type="button"
          onClick={() => signInDemo()}
          disabled={busy}
          className="py-2.5 px-4 bg-neo-cream hover:bg-neo-yellow border-2 border-black font-mono font-black text-xs uppercase shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all"
        >
          ⚡ 1-Click Instant Demo Login
        </button>
      </div>
    </div>
  );
}

export function MockBanner() {
  if (!IS_MOCK) return null;
  return (
    <div className="p-3 bg-neo-yellow border-2 border-black shadow-neo-sm text-black text-xs sm:text-sm font-bold flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-black animate-ping shrink-0" />
      <span>
        <strong>PREVIEW DATA MODE:</strong> <code>deployments/testnet.json</code> has staging addresses. Real trades route to Monad Testnet once deployed.
      </span>
    </div>
  );
}

export function GasWarning({ mon }: { mon?: bigint }) {
  const { session } = useWallet();
  if (!session || IS_MOCK || mon === undefined || mon > 0n) return null;
  return (
    <div className="p-3.5 bg-neo-blue border-2 border-black shadow-neo-sm text-xs sm:text-sm text-black flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-bold">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚡</span>
        <span>Your passkey wallet has no MON for gas. Claim free testnet MON:</span>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <code className="text-xs font-mono text-black bg-white px-2 py-1 border border-black">
          {session.address.slice(0, 10)}…
        </code>
        <a
          href={MON_FAUCET}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-bold px-3 py-1 bg-neo-yellow text-black border border-black hover:bg-neo-yellowDark shadow-neo-sm"
        >
          Faucet →
        </a>
      </div>
    </div>
  );
}
