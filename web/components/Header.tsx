"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CHAIN_ID, SESSION_CAP_GUSD, addressUrl } from "@/lib/config";
import { shortAddr } from "@/lib/format";
import { useWallet } from "@/lib/wallet/WalletProvider";
import { CopyButton } from "./ui";

const isActive = (path: string, n: { href: string; match?: string }) => {
  const base = n.match ?? n.href;
  return base === "/" ? path === "/" : path === base || path.startsWith(`${base}/`);
};

const NAV = [
  { href: "/", label: "FORWARD CURVE", icon: "📈" },
  { href: "/market/gT4-NOW", match: "/market", label: "TRADE (KURU)", icon: "⚡" },
  { href: "/hours", label: "MY DELIVERIES", icon: "📦" },
  { href: "/provider", label: "PROVIDE & MINT", icon: "🖥️" },
  { href: "/providers", label: "REPUTATION WALL", icon: "🏆" },
];

export function Header() {
  const path = usePathname();
  const [blockHeight, setBlockHeight] = useState(1249820);

  // Simulated Monad sub-second block ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setBlockHeight((h) => h + 1);
    }, 400);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="border-b border-white/[0.08] bg-obsidian/90 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 font-black text-lg tracking-wider text-white shrink-0 group">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-grid-monad/40 group-hover:border-grid-monad transition-colors duration-200">
              <Image src="/logo.svg" alt="" width={32} height={32} className="object-cover" priority />
              <div className="absolute inset-0 bg-grid-monad/10 pointer-events-none" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold tracking-tight text-white leading-none">GRIDLOCK</span>
              <span className="text-[9px] font-mono tracking-widest text-grid-cyan uppercase mt-0.5">COMPUTE FORWARDS</span>
            </div>
          </Link>

          <nav className="hidden lg:flex gap-1 text-xs font-mono">
            {NAV.map((n) => {
              const active = isActive(path, n);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`relative px-3 py-1.5 rounded-lg tracking-wider transition-all duration-150 flex items-center gap-1.5 ${
                    active
                      ? "text-white font-bold bg-white/[0.08] border border-grid-monad/50 shadow-sm shadow-grid-monad/20"
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="text-xs">{n.icon}</span>
                  {n.label}
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-grid-monad to-grid-cyan rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Monad Block Pulse Beacon */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface/80 border border-white/[0.06] text-[11px] font-mono text-gray-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-grid-cyan opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-grid-cyan" />
            </span>
            <span>MONAD #{blockHeight.toLocaleString()}</span>
            <span className="text-gray-600">·</span>
            <span className="text-grid-cyan">400ms</span>
          </div>

          <AuthButton />
        </div>
      </div>

      {/* Mobile Navigation Scrollbar */}
      <nav className="lg:hidden flex gap-1.5 overflow-x-auto px-3 pb-2 pt-1 text-xs font-mono sleek-scroll border-t border-white/[0.04]">
        {NAV.map((n) => {
          const active = isActive(path, n);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                active ? "bg-grid-monad text-black font-bold" : "text-gray-300 bg-surface border border-white/[0.06]"
              }`}
            >
              <span>{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function AuthButton() {
  const { session, busy, error, storedPasskey, signIn, signUp, signOut, spentGusd } = useWallet();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => {
    if (error) setOpen(true);
  }, [error]);
  useEffect(() => {
    if (session) setOpen(false);
  }, [session]);

  const spendPct = Math.min(100, (spentGusd / SESSION_CAP_GUSD) * 100);

  return (
    <div className="relative" ref={ref}>
      {session ? (
        <div className="flex items-center gap-2">
          {/* Radial Spend Capsule */}
          <div
            title="Scoped session allowance: Can only sign Gridlock + Kuru transactions"
            className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg border border-grid-pass/30 bg-grid-pass/10 text-grid-pass text-[11px] font-mono"
          >
            <div className="w-2 h-2 rounded-full bg-grid-pass animate-pulse" />
            <span>SESSION: ${spentGusd.toFixed(1)} / ${SESSION_CAP_GUSD} gUSD</span>
            <div className="w-12 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-grid-pass transition-all duration-300" style={{ width: `${spendPct}%` }} />
            </div>
          </div>

          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded-lg bg-surface border border-white/10 hover:border-grid-monad/50 text-white transition-all active:scale-[0.98]"
          >
            <span className="w-2 h-2 rounded-full bg-grid-pass" />
            <span>{shortAddr(session.address)}</span>
            <span className="text-[10px] text-gray-500">▼</span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => (storedPasskey ? signIn() : setOpen((o) => !o))}
          disabled={busy}
          className="relative group overflow-hidden px-4 py-2 text-xs font-mono font-bold tracking-wider rounded-lg bg-gradient-to-r from-grid-monad to-purple-600 text-black hover:brightness-110 shadow-lg shadow-grid-monad/20 border border-grid-monad/50 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          {busy ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
              AUTHENTICATING…
            </span>
          ) : storedPasskey ? (
            "PASSKEY SIGN IN"
          ) : (
            "CONNECT PASSKEY"
          )}
        </button>
      )}

      {open && (
        <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-obsidian/95 backdrop-blur-2xl shadow-2xl p-4 sm:p-5 space-y-4 text-sm z-50 hud-box">
          {session ? (
            <>
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-gray-400">SCOPED PASSKEY WALLET</div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/50 border border-white/[0.08]">
                  <a
                    href={addressUrl(session.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-grid-cyan truncate hover:underline"
                  >
                    {session.address}
                  </a>
                  <CopyButton text={session.address} />
                </div>
              </div>

              <div className="rounded-xl bg-titanium/80 border border-white/[0.08] p-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-white">Session Security Bounds</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-grid-monad/20 text-grid-monad">
                    ALLOWLIST ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Signs only Gridlock Escrow + Kuru DEX contracts. Zero native MON transfer risks, zero external RPC calls.
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-gray-300">
                    <span>Allowance Spent:</span>
                    <span className="text-white">${spentGusd.toFixed(2)} / ${SESSION_CAP_GUSD} gUSD</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                    <div className="h-full bg-grid-monad transition-all duration-300" style={{ width: `${spendPct}%` }} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  signOut();
                  setOpen(false);
                }}
                className="w-full py-2.5 rounded-lg bg-surface hover:bg-grid-700/80 border border-white/10 text-xs font-mono font-semibold text-red-400 hover:text-red-300 transition-colors"
              >
                Sign out (Wipe Session Key)
              </button>
            </>
          ) : (
            <>
              {/* High-Tech Biometric Prompt Animation */}
              <div className="text-center py-2 space-y-2">
                <div className="relative w-14 h-14 mx-auto rounded-full bg-grid-monad/10 border border-grid-monad/40 flex items-center justify-center">
                  <span className="text-2xl animate-pulse">🔒</span>
                  <div className="absolute inset-0 rounded-full border border-grid-monad/30 animate-ping opacity-40 pointer-events-none" />
                </div>
                <h3 className="font-bold text-white text-base tracking-tight">Biometric Passkey Authentication</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Gridlock derives non-custodial trading keys directly from WebAuthn TouchID / FaceID. Zero seed phrases.
                </p>
              </div>

              <button
                onClick={() => signIn()}
                disabled={busy}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-grid-monad to-purple-600 text-black font-mono font-bold text-xs tracking-wider hover:brightness-110 shadow-lg shadow-grid-monad/25 transition-all disabled:opacity-50"
              >
                TOUCH ID / PASSKEY SIGN IN
              </button>

              <div className="border-t border-white/[0.08] pt-3 space-y-2">
                <div className="text-[11px] font-mono text-gray-400 uppercase">First Time? Create New Key:</div>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Passkey label (e.g. dev@macbook)"
                  className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-grid-monad"
                />
                <button
                  onClick={() => signUp(label)}
                  disabled={busy}
                  className="w-full py-2 rounded-lg bg-surface border border-white/10 hover:border-white/20 text-xs font-mono font-semibold text-white transition-all disabled:opacity-50"
                >
                  Create Passkey Wallet
                </button>
              </div>

              {storedPasskey && (
                <div className="text-center pt-1">
                  <button onClick={() => signIn({ anyPasskey: true })} className="text-[11px] text-gray-400 underline hover:text-white">
                    Use a different biometric credential
                  </button>
                </div>
              )}
              {error && <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-mono">{error}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
