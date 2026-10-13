"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Abi, ContractFunctionArgs, ContractFunctionName, Hash } from "viem";
import { publicClient, monadTestnet } from "./chain";
import { IS_MOCK } from "./config";
import { useToast } from "./toast";
import { useWallet } from "./wallet/WalletProvider";

/** Fetch + re-fetch every `intervalMs` (0 = once) and whenever deps or a confirmed tx change. */
export function usePoll<T>(fn: () => Promise<T>, deps: unknown[], intervalMs = 0) {
  const { txNonce } = useWallet();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const refresh = useCallback(async () => {
    try {
      const v = await fnRef.current();
      setData(v);
      setError(null);
    } catch (e) {
      setError(shortError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const tick = () => alive && refresh();
    tick();
    if (!intervalMs) return () => void (alive = false);
    const t = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, txNonce, intervalMs, refresh]);

  return { data, error, loading, refresh };
}

export function shortError(e: unknown): string {
  const err = e as { shortMessage?: string; reason?: string; message?: string; name?: string };
  if (err?.name === "ScopeError") return err.message!;
  const msg = err?.shortMessage ?? err?.reason ?? err?.message ?? String(e);
  return msg.split("\n")[0].slice(0, 220);
}

type WriteReq<TAbi extends Abi, F extends ContractFunctionName<TAbi, "nonpayable" | "payable">> = {
  address: `0x${string}`;
  abi: TAbi;
  functionName: F;
  args?: ContractFunctionArgs<TAbi, "nonpayable" | "payable", F>;
};

/** Sends txs through the scoped Mera session with explorer-link toasts. */
export function useTx() {
  const { session, bumpTx } = useWallet();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const guard = useCallback(() => {
    if (IS_MOCK) throw new Error("Contracts aren't deployed yet (deployments/testnet.json has placeholders).");
    if (!session) throw new Error("Sign in with your passkey first.");
    return session;
  }, [session]);

  /** Write via viem; resolves with the receipt. */
  const write = useCallback(
    async <TAbi extends Abi, F extends ContractFunctionName<TAbi, "nonpayable" | "payable">>(label: string, req: WriteReq<TAbi, F>) => {
      const id = toast.push({ kind: "pending", text: `${label}…` });
      setPending(true);
      try {
        const s = guard();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hash: Hash = await s.walletClient.writeContract({ ...(req as any), account: s.account, chain: monadTestnet });
        toast.update(id, { text: `${label}: confirming…`, hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(`${label} reverted`);
        toast.update(id, { kind: "success", text: `${label} confirmed` });
        bumpTx();
        return receipt;
      } catch (e) {
        toast.update(id, { kind: "error", text: `${label} failed: ${shortError(e)}` });
        throw e;
      } finally {
        setPending(false);
      }
    },
    [guard, toast, bumpTx],
  );

  /** Run an ethers/Kuru-SDK flow that returns an ethers receipt. */
  const run = useCallback(
    async <R extends { transactionHash?: string } | void>(label: string, fn: (s: NonNullable<typeof session>) => Promise<R>) => {
      const id = toast.push({ kind: "pending", text: `${label}…` });
      setPending(true);
      try {
        const r = await fn(guard());
        toast.update(id, { kind: "success", text: `${label} confirmed`, hash: r ? r.transactionHash : undefined });
        bumpTx();
        return r;
      } catch (e) {
        toast.update(id, { kind: "error", text: `${label} failed: ${shortError(e)}` });
        throw e;
      } finally {
        setPending(false);
      }
    },
    [guard, toast, bumpTx],
  );

  return { write, run, pending };
}

/** Ticks every second; for countdowns. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
