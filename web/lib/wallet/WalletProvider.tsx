"use client";

// Mera passkey wallet. One passkey prompt per visit:
//   prfOutput ─┬─ BIP-39/44 → secp256k1 signing session (wallet, zeroed on sign-out)
//              └─ HKDF → X25519 delivery key (credential decryption only, not a wallet key)
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createWalletClient, http, type Address, type LocalAccount, type WalletClient } from "viem";
import { ethers } from "ethers";
import { CHAIN_ID, CONTRACTS, RPC_URL, SESSION_ALLOWLIST, SESSION_CAP_GUSD } from "../config";
import { getEthersProvider, monadTestnet } from "../chain";
import { deriveDeliveryKeypair, type DeliveryKeypair } from "../crypto/delivery";
import { deriveEvmPrivateKey } from "./derive";
import { scopeAccount, type SessionScope } from "./scope";
import { MeraEthersSigner } from "./ethersSigner";

const STORAGE_KEY = "gridlock.passkey.v1";

type StoredPasskey = { credentialId: string; transports?: string[]; label?: string };

export type WalletSession = {
  address: Address;
  account: LocalAccount;
  walletClient: WalletClient;
  ethersSigner: ethers.Signer;
  deliveryKey: DeliveryKeypair;
  scope: SessionScope;
  credentialId: string;
  startedAt: number;
};

type WalletState = {
  session: WalletSession | null;
  busy: boolean;
  error: string | null;
  storedPasskey: StoredPasskey | null;
  /** bumps after every confirmed tx so views can refetch */
  txNonce: number;
  signUp: (label: string) => Promise<void>;
  signIn: (opts?: { anyPasskey?: boolean }) => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => void;
  bumpTx: () => void;
  spentGusd: number;
};

const Ctx = createContext<WalletState | null>(null);

function readStored(): StoredPasskey | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPasskey) : null;
  } catch {
    return null;
  }
}

function writeStored(p: StoredPasskey) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // private mode: sign-in still works via discoverable passkeys
  }
}

function friendlyError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  switch (err?.code) {
    case "PRF_UNAVAILABLE":
      return "This passkey/authenticator doesn't support the WebAuthn PRF extension. Try Chrome with Google Password Manager, iCloud Keychain, or a recent Android phone.";
    case "PASSKEY_OPERATION_FAILED":
      return "Passkey prompt was cancelled or failed.";
    case "CRYPTO_UNAVAILABLE":
      return "WebCrypto is unavailable. Passkeys need HTTPS (or localhost).";
    default:
      return err?.message ?? String(e);
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WalletSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storedPasskey, setStoredPasskey] = useState<StoredPasskey | null>(null);
  const [txNonce, setTxNonce] = useState(0);
  const endRef = useRef<() => void>(() => {});

  useEffect(() => setStoredPasskey(readStored()), []);
  useEffect(() => () => endRef.current(), []);

  const start = useCallback(async (prfOutput: Uint8Array, credentialId: string) => {
    const { createSecp256k1SigningSession } = await import("@category-labs/mera");
    const { toViemAccount } = await import("@category-labs/mera/viem");

    const privateKey = deriveEvmPrivateKey(prfOutput);
    const signing = createSecp256k1SigningSession({ privateKey });
    privateKey.fill(0);
    const deliveryKey = deriveDeliveryKeypair(prfOutput);
    prfOutput.fill(0);

    const scope: SessionScope = {
      allowlist: SESSION_ALLOWLIST,
      gridUSD: CONTRACTS.gridUSD,
      capRaw: BigInt(Math.round(SESSION_CAP_GUSD * 1e6)),
      spentRaw: 0n,
    };
    const account = scopeAccount(toViemAccount(signing), scope);
    const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http(RPC_URL) });
    const ethersSigner = new MeraEthersSigner(account, CHAIN_ID, getEthersProvider());

    endRef.current = () => {
      signing.end();
      deliveryKey.privateKey.fill(0);
    };
    setSession({
      address: account.address,
      account,
      walletClient,
      ethersSigner,
      deliveryKey,
      scope,
      credentialId,
      startedAt: Date.now(),
    });
  }, []);

  const signUp = useCallback(
    async (label: string) => {
      setBusy(true);
      setError(null);
      try {
        const { createPasskeyWithPrfOutput } = await import("@category-labs/mera");
        const name = label.trim() || `gridlock-${new Date().toISOString().slice(0, 10)}`;
        const res = await createPasskeyWithPrfOutput({
          rp: { id: location.hostname, name: "Gridlock" },
          user: { name, displayName: name },
        });
        const stored = { credentialId: res.credentialId, transports: res.transports ? [...res.transports] : undefined, label: name };
        writeStored(stored);
        setStoredPasskey(stored);
        await start(Uint8Array.from(res.prfOutput), res.credentialId);
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setBusy(false);
      }
    },
    [start],
  );

  const signIn = useCallback(
    async (opts?: { anyPasskey?: boolean }) => {
      setBusy(true);
      setError(null);
      try {
        const { getPasskeyPrfOutput } = await import("@category-labs/mera");
        const stored = opts?.anyPasskey ? null : readStored();
        // No stored credential → discoverable flow: works on a fresh browser / synced phone.
        const res = await getPasskeyPrfOutput({
          rpId: location.hostname,
          credential: stored ? { credentialId: stored.credentialId, transports: stored.transports } : undefined,
        });
        if (!stored || stored.credentialId !== res.credentialId) {
          const next = { credentialId: res.credentialId, label: stored?.label };
          writeStored(next);
          setStoredPasskey(next);
        }
        await start(Uint8Array.from(res.prfOutput), res.credentialId);
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setBusy(false);
      }
    },
    [start],
  );

  const signInDemo = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const demoSeed = new Uint8Array(32);
      for (let i = 0; i < 32; i++) demoSeed[i] = (i * 11 + 42) % 256;
      await start(demoSeed, "demo-passkey-prf-0x1");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }, [start]);

  const signOut = useCallback(() => {
    endRef.current();
    endRef.current = () => {};
    setSession(null);
  }, []);

  const bumpTx = useCallback(() => setTxNonce((n) => n + 1), []);

  const value = useMemo<WalletState>(
    () => ({
      session,
      busy,
      error,
      storedPasskey,
      txNonce,
      signUp,
      signIn,
      signInDemo,
      signOut,
      bumpTx,
      spentGusd: session ? Number(session.scope.spentRaw) / 1e6 : 0,
    }),
    [session, busy, error, storedPasskey, txNonce, signUp, signIn, signInDemo, signOut, bumpTx],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}
