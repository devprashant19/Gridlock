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
  { href: "/", label: "Curve" },
  { href: "/market/gT4-NOW", match: "/market", label: "Trade" },
  { href: "/hours", label: "My Hours" },
  { href: "/provider", label: "Provide" },
  { href: "/providers", label: "Leaderboard" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="border-b border-grid-700 bg-grid-800/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight shrink-0">
            <Image src="/logo.svg" alt="" width={32} height={32} className="rounded-lg" priority />
            <span className="hidden sm:inline">GRIDLOCK</span>
          </Link>
          <nav className="hidden md:flex gap-5 text-sm text-gray-300">
            {NAV.map((n) => {
              const active = isActive(path, n);
              return (
                <Link key={n.href} href={n.href} className={active ? "text-white font-semibold" : "hover:text-white transition"}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden lg:inline text-xs px-2.5 py-1 rounded-full bg-grid-monad/15 text-grid-monad border border-grid-monad/30">
            Monad Testnet ({CHAIN_ID})
          </span>
          <AuthButton />
        </div>
      </div>
      <nav className="md:hidden flex gap-1 overflow-x-auto px-3 pb-2 text-sm no-scrollbar">
        {NAV.map((n) => {
          const active = isActive(path, n);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1.5 rounded-full whitespace-nowrap ${active ? "bg-grid-monad text-black font-semibold" : "text-gray-300 bg-grid-700/60"}`}
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

  return (
    <div className="relative" ref={ref}>
      {session ? (
        <div className="flex items-center gap-2">
          <span
            title="This passkey session can only sign Gridlock + Kuru transactions"
            className="hidden sm:inline text-[11px] px-2 py-1 rounded-full border border-grid-pass/30 bg-grid-pass/10 text-grid-pass whitespace-nowrap"
          >
            Session: trading only, ≤ {SESSION_CAP_GUSD} gUSD
          </span>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-grid-700 border border-grid-600 hover:bg-grid-600"
          >
            <span className="w-2 h-2 rounded-full bg-grid-pass" />
            <span className="font-mono">{shortAddr(session.address)}</span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => (storedPasskey ? signIn() : setOpen((o) => !o))}
          disabled={busy}
          className="px-3 sm:px-4 py-2 text-sm font-semibold rounded-lg bg-grid-monad text-black hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Waiting for passkey…" : storedPasskey ? "Passkey sign in" : "Sign in"}
        </button>
      )}

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-grid-600 bg-grid-800 shadow-2xl p-4 space-y-3 text-sm z-50">
          {session ? (
            <>
              <div>
                <div className="text-xs text-gray-400 mb-1">Passkey wallet</div>
                <div className="flex items-center gap-2">
                  <a
                    href={addressUrl(session.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs break-all hover:underline"
                  >
                    {session.address}
                  </a>
                  <CopyButton text={session.address} />
                </div>
              </div>
              <div className="rounded-lg bg-grid-900 border border-grid-700 p-3 space-y-1">
                <div className="text-xs font-semibold text-grid-monad">Session: trading only, ≤ {SESSION_CAP_GUSD} gUSD</div>
                <div className="text-xs text-gray-400">
                  Signs only Gridlock + Kuru contracts, no native MON transfers, no raw/typed-data signing. Spent {spentGusd.toFixed(2)} /{" "}
                  {SESSION_CAP_GUSD} gUSD.
                </div>
              </div>
              <button
                onClick={() => {
                  signOut();
                  setOpen(false);
                }}
                className="w-full py-2 rounded-lg bg-grid-700 hover:bg-grid-600 border border-grid-600"
              >
                Sign out (wipe session key)
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-300">Gridlock wallets come from a passkey. No seed phrase or extension, and one prompt per visit.</p>
              <button
                onClick={() => signIn()}
                disabled={busy}
                className="w-full py-2.5 rounded-lg bg-grid-monad text-black font-semibold disabled:opacity-50"
              >
                Sign in with existing passkey
              </button>
              <div className="border-t border-grid-700 pt-3 space-y-2">
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Passkey name (e.g. alice@laptop)"
                  className="w-full bg-grid-900 border border-grid-700 rounded-lg p-2 text-white text-sm"
                />
                <button
                  onClick={() => signUp(label)}
                  disabled={busy}
                  className="w-full py-2.5 rounded-lg bg-grid-700 border border-grid-600 hover:bg-grid-600 font-semibold disabled:opacity-50"
                >
                  Create new passkey wallet
                </button>
              </div>
              {storedPasskey && (
                <button onClick={() => signIn({ anyPasskey: true })} className="text-xs text-gray-400 underline">
                  Use a different passkey
                </button>
              )}
              {error && <div className="text-xs text-grid-fail break-words">{error}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
