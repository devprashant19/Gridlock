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
      className={`hud-box rounded-xl p-4 sm:p-5 space-y-4 min-w-0 transition-all duration-300 hover:border-grid-600/60 ${
        glow ? "glow-monad border-grid-monad/40" : ""
      } ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
          {title && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-grid-monad rounded-xs inline-block animate-pulse" />
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">{title}</h2>
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
    <div className={`relative bg-titanium/90 border border-white/[0.08] rounded-xl p-4 sm:p-5 backdrop-blur-md overflow-hidden ${className}`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-grid-monad/5 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5 mb-3.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-grid-cyan animate-pulse-glow" />
          <span className="text-xs font-mono uppercase tracking-wider text-gray-300 font-semibold">{title}</span>
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
    <div className="p-3 rounded-lg bg-obsidian/70 border border-white/[0.06] space-y-1">
      <div className="text-[11px] font-mono uppercase text-gray-400 tracking-wider flex justify-between items-center">
        <span>{label}</span>
        {delta && (
          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${positive ? "text-grid-pass bg-grid-pass/10" : "text-grid-fail bg-grid-fail/10"}`}>
            {delta}
          </span>
        )}
      </div>
      <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-white">{value}</div>
      {sub && <div className="text-[11px] text-gray-500 font-sans">{sub}</div>}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "cyan";
  loading?: boolean;
};

export function Button({ variant = "primary", loading, className = "", children, disabled, ...rest }: BtnProps) {
  const v = {
    primary:
      "bg-gradient-to-r from-grid-monad to-purple-600 text-black hover:brightness-110 shadow-lg shadow-grid-monad/20 border border-grid-monad/50",
    cyan:
      "bg-gradient-to-r from-grid-cyan to-teal-400 text-black hover:brightness-110 shadow-lg shadow-grid-cyan/20 border border-grid-cyan/50",
    ghost: "bg-surface text-gray-200 border border-white/10 hover:border-grid-monad/60 hover:text-white hover:bg-grid-700/50",
    danger: "bg-gradient-to-r from-grid-fail to-rose-600 text-white hover:brightness-110 shadow-lg shadow-grid-fail/20 border border-grid-fail/50",
  }[variant];

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`relative group overflow-hidden px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${v} ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
      {loading && (
        <span className="inline-block w-3.5 h-3.5 mr-2 rounded-full border-2 border-current border-t-transparent animate-spin align-[-2px]" />
      )}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block text-sm space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-400 font-medium">{label}</span>
        {hint && <span className="text-[11px] text-gray-500 font-mono">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full bg-obsidian/90 border border-white/10 rounded-lg p-2.5 text-white font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:border-grid-monad focus:ring-1 focus:ring-grid-monad/40 transition-colors duration-150";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-xs font-mono uppercase tracking-wider text-gray-400 py-6 justify-center">
      <span className="w-4 h-4 rounded-full border-2 border-grid-monad border-t-transparent animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-grid-fail/10 border border-grid-fail/30 text-grid-fail text-xs sm:text-sm font-medium break-words flex items-start gap-2">
      <span className="text-sm shrink-0">⚠</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="py-8 text-center text-xs sm:text-sm text-gray-500 font-mono uppercase tracking-wider border border-dashed border-white/10 rounded-xl">
      {children}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  pulse = false,
  children,
}: {
  tone?: "pass" | "degraded" | "fail" | "monad" | "cyan" | "neutral";
  pulse?: boolean;
  children: ReactNode;
}) {
  const t = {
    pass: "bg-grid-pass/15 text-grid-pass border-grid-pass/30",
    degraded: "bg-grid-degraded/15 text-grid-degraded border-grid-degraded/30",
    fail: "bg-grid-fail/15 text-grid-fail border-grid-fail/30",
    monad: "bg-grid-monad/15 text-grid-monad border-grid-monad/30",
    cyan: "bg-grid-cyan/15 text-grid-cyan border-grid-cyan/30",
    neutral: "bg-surface text-gray-300 border-white/10",
  }[tone];

  const dot = {
    pass: "bg-grid-pass",
    degraded: "bg-grid-degraded",
    fail: "bg-grid-fail",
    monad: "bg-grid-monad",
    cyan: "bg-grid-cyan",
    neutral: "bg-gray-400",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${t}`}>
      {pulse && <span className={`w-1.5 h-1.5 rounded-full animate-ping ${dot}`} />}
      {!pulse && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
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
        } catch {
          /* clipboard blocked */
        }
      }}
      className="shrink-0 text-[11px] font-mono px-2 py-0.5 rounded bg-surface hover:bg-grid-700 border border-white/10 text-gray-300 hover:text-white transition-colors"
    >
      {done ? "✓ Copied" : label}
    </button>
  );
}

export function PageTitle({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/[0.06] pb-4 mb-2">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white break-words flex items-center gap-2.5">
          <span className="w-2 h-5 bg-gradient-to-b from-grid-monad to-grid-cyan rounded-xs" />
          {title}
        </h1>
        {sub && <p className="text-gray-400 text-xs sm:text-sm max-w-2xl leading-relaxed">{sub}</p>}
      </div>
      {right && <div className="self-start sm:self-auto max-w-full shrink-0">{right}</div>}
    </div>
  );
}

/** Wraps an action area: prompts sign-in when there's no session. */
export function SignInGate({ children, what = "do this" }: { children: ReactNode; what?: string }) {
  const { session, signIn, busy } = useWallet();
  if (session) return <>{children}</>;
  return (
    <div className="p-5 rounded-xl bg-obsidian/80 border border-dashed border-white/20 text-center space-y-3 relative overflow-hidden">
      <div className="w-12 h-12 mx-auto rounded-full bg-grid-monad/10 border border-grid-monad/30 flex items-center justify-center text-grid-monad text-xl">
        ⚿
      </div>
      <div className="max-w-md mx-auto space-y-1">
        <div className="font-bold text-white text-sm">Passkey Authentication Required</div>
        <p className="text-xs text-gray-400">
          Sign in with your biometric passkey to {what}. One prompt creates a scoped, trading-only session with zero extension popups.
        </p>
      </div>
      <Button onClick={() => signIn()} loading={busy} className="!py-2.5 !px-6">
        Sign in with Passkey
      </Button>
    </div>
  );
}

export function MockBanner() {
  if (!IS_MOCK) return null;
  return (
    <div className="p-3 rounded-lg bg-grid-degraded/10 border border-grid-degraded/30 text-grid-degraded text-xs sm:text-sm flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-grid-degraded animate-ping shrink-0" />
      <span>
        <strong>Preview data mode:</strong> <code>deployments/testnet.json</code> has staging addresses. Real trades route to Monad Testnet once deployed.
      </span>
    </div>
  );
}

export function GasWarning({ mon }: { mon?: bigint }) {
  const { session } = useWallet();
  if (!session || IS_MOCK || mon === undefined || mon > 0n) return null;
  return (
    <div className="p-3.5 rounded-lg bg-grid-monad/10 border border-grid-monad/30 text-xs sm:text-sm text-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-grid-monad text-base">⚡</span>
        <span>Your passkey wallet has no MON for gas. Claim free testnet MON:</span>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <code className="text-xs font-mono text-grid-monad bg-black/40 px-2 py-1 rounded">{session.address.slice(0, 10)}…</code>
        <a
          href={MON_FAUCET}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold px-2.5 py-1 rounded bg-grid-monad text-black hover:brightness-110"
        >
          Faucet →
        </a>
      </div>
    </div>
  );
}
