"use client";

import Link from "next/link";
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
  { href: "/", label: "FORWARD MARKET" },
  { href: "/market/gT4-NOW", match: "/market", label: "TRADE (KURU)" },
  { href: "/hours", label: "DELIVERY QUEUE" },
  { href: "/provider", label: "PROVIDE & MINT" },
  { href: "/providers", label: "REPUTATION WALL" },
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
    <header className="border-b-2 border-black bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-3 group">
            {/* Black square with capital white letter icon */}
            <div className="w-8 h-8 bg-black flex items-center justify-center text-white font-black text-lg border-2 border-black">
              G
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight text-black">GRIDLOCK</span>
              <span className="text-xl font-bold text-black">|</span>
            </div>
          </Link>

          <nav className="hidden lg:flex gap-4 text-xs font-mono font-bold tracking-wider">
            {NAV.map((n) => {
              const active = isActive(path, n);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`uppercase transition-colors py-1 ${
                    active
                      ? "text-black border-b-2 border-black font-black"
                      : "text-gray-700 hover:text-black"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* How It Works Button from image */}
          <Link
            href="/#how-it-works"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-mono font-bold uppercase hover:bg-neutral-100 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <span>⊙</span> HOW IT WORKS
          </Link>

          <AuthButton />
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="lg:hidden flex gap-2 overflow-x-auto px-4 py-2 text-xs font-mono font-bold sleek-scroll border-t-2 border-black bg-[#FFFDF7]">
        {NAV.map((n) => {
          const active = isActive(path, n);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1.5 whitespace-nowrap border-2 border-black uppercase text-xs ${
                active
                  ? "bg-neo-yellow text-black shadow-neo-sm font-black"
                  : "bg-white text-black hover:bg-gray-100"
              }`}
            >
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
    const onDoc = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
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
          <div
            title="Scoped session allowance"
            className="hidden md:flex items-center gap-2 px-2.5 py-1.5 border-2 border-black bg-neo-green text-black text-xs font-mono font-bold shadow-neo-sm"
          >
            <div className="w-2 h-2 bg-black animate-pulse" />
            <span>
              ${spentGusd.toFixed(0)} / ${SESSION_CAP_GUSD} gUSD
            </span>
          </div>

          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono font-bold uppercase bg-white border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-50 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <span className="w-2 h-2 bg-neo-green border border-black" />
            <span>{shortAddr(session.address)}</span>
            <span className="text-[10px]">▼</span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => (storedPasskey ? signIn() : setOpen((o) => !o))}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-neo-yellow hover:bg-neo-yellowDark text-black font-mono font-black text-xs uppercase border-2 border-black shadow-[3px_3px_0px_#000] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
        >
          {busy ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-black border-t-transparent animate-spin" />
              CONNECTING…
            </span>
          ) : storedPasskey ? (
            "SIGN IN ↗"
          ) : (
            "CONNECT WALLET ↗"
          )}
        </button>
      )}

      {open && (
        <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] border-2 border-black bg-white shadow-neo-lg p-5 space-y-4 text-sm z-50">
          {session ? (
            <>
              <div className="space-y-1.5">
                <div className="text-xs font-mono uppercase font-black text-black">
                  SCOPED PASSKEY WALLET
                </div>
                <div className="flex items-center justify-between gap-2 p-2 bg-[#FFFDF7] border-2 border-black shadow-neo-sm">
                  <a
                    href={addressUrl(session.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-black truncate hover:underline font-bold"
                  >
                    {session.address}
                  </a>
                  <CopyButton text={session.address} />
                </div>
              </div>

              <div className="bg-neo-yellow border-2 border-black p-3 space-y-2 shadow-neo-sm">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black uppercase text-black">Session Security Bounds</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-black text-white font-bold">
                    ALLOWLIST ACTIVE
                  </span>
                </div>
                <p className="text-xs text-black font-medium leading-relaxed">
                  Signs only Gridlock Escrow + Kuru DEX contracts. Zero native MON transfer risks.
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono font-bold text-black">
                    <span>Allowance Spent:</span>
                    <span>
                      ${spentGusd.toFixed(2)} / ${SESSION_CAP_GUSD} gUSD
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white border border-black overflow-hidden">
                    <div
                      className="h-full bg-black transition-all duration-300"
                      style={{ width: `${spendPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  signOut();
                  setOpen(false);
                }}
                className="w-full py-2.5 bg-neo-pink text-black border-2 border-black shadow-neo-sm font-mono font-bold text-xs uppercase hover:bg-pink-400 transition-colors"
              >
                Sign out (Wipe Session Key)
              </button>
            </>
          ) : (
            <>
              <div className="text-center py-2 space-y-2">
                <div className="w-12 h-12 mx-auto bg-neo-yellow border-2 border-black shadow-neo-sm flex items-center justify-center text-2xl font-bold">
                  🔒
                </div>
                <h3 className="font-black text-black text-base uppercase">
                  Biometric Passkey Authentication
                </h3>
                <p className="text-xs text-gray-700 font-medium max-w-xs mx-auto">
                  Gridlock derives non-custodial trading keys directly from WebAuthn TouchID / FaceID. Zero seed phrases.
                </p>
              </div>

              <button
                onClick={() => signIn()}
                disabled={busy}
                className="w-full py-2.5 bg-neo-yellow hover:bg-neo-yellowDark text-black font-mono font-black text-xs uppercase border-2 border-black shadow-neo-sm transition-all disabled:opacity-50"
              >
                TOUCH ID / PASSKEY SIGN IN
              </button>

              <div className="border-t-2 border-black pt-3 space-y-2">
                <div className="text-xs font-mono font-bold text-black uppercase">
                  First Time? Create New Key:
                </div>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Passkey label (e.g. dev@macbook)"
                  className="w-full bg-white border-2 border-black p-2 text-black font-mono text-xs focus:outline-none shadow-neo-sm"
                />
                <button
                  onClick={() => signUp(label)}
                  disabled={busy}
                  className="w-full py-2 bg-white border-2 border-black text-xs font-mono font-bold uppercase hover:bg-neutral-100 transition-all shadow-neo-sm disabled:opacity-50"
                >
                  Create Passkey Wallet
                </button>
              </div>

              {storedPasskey && (
                <div className="text-center pt-1">
                  <button
                    onClick={() => signIn({ anyPasskey: true })}
                    className="text-xs text-black underline font-bold"
                  >
                    Use a different biometric credential
                  </button>
                </div>
              )}
              {error && (
                <div className="p-2 bg-neo-pink/30 border-2 border-black text-xs text-black font-mono font-bold">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
