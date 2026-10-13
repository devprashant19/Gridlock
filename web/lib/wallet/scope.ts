// Scoped trading session: the Mera account can only sign transactions to Gridlock/Kuru
// contracts, never sends native value, and has a per-session GridUSD spend cap.
// Raw-hash signing, EIP-712 and EIP-7702 authorizations are refused outright.
import {
  decodeFunctionData,
  isAddressEqual,
  type Address,
  type LocalAccount,
  type TransactionSerializable,
} from "viem";
import { toAccount } from "viem/accounts";
import { gridUsdAbi } from "../abis";

export class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopeError";
  }
}

export type SessionScope = {
  allowlist: readonly Address[];
  gridUSD: Address;
  capRaw: bigint; // 6 decimals
  spentRaw: bigint;
};

/** GridUSD this tx can move out of the wallet (approve or transfer amount). */
export function gusdOutflow(scope: Pick<SessionScope, "gridUSD">, to: Address, data?: `0x${string}`): bigint {
  if (!data || !isAddressEqual(to, scope.gridUSD)) return 0n;
  try {
    const call = decodeFunctionData({ abi: gridUsdAbi, data });
    if (call.functionName === "approve" || call.functionName === "transfer") return call.args[1] as bigint;
  } catch {
    // unknown selector on GridUSD (faucet etc.) moves nothing out
  }
  return 0n;
}

/** Throws ScopeError if the tx is outside the session scope; otherwise books its gUSD spend. */
export function enforceScope(scope: SessionScope, tx: Pick<TransactionSerializable, "to" | "data" | "value">) {
  const to = tx.to;
  if (!to) throw new ScopeError("Session refuses contract deployments");
  if (!scope.allowlist.some((a) => isAddressEqual(a, to))) {
    throw new ScopeError(`Session is trading-only: ${to} is not a Gridlock or Kuru contract`);
  }
  if (tx.value && tx.value > 0n) throw new ScopeError("Session refuses to send native MON");
  const out = gusdOutflow(scope, to, tx.data);
  if (scope.spentRaw + out > scope.capRaw) {
    const left = Number(scope.capRaw - scope.spentRaw) / 1e6;
    throw new ScopeError(`Session cap reached: only ${left.toFixed(2)} gUSD left. Sign out and in again for a new session.`);
  }
  scope.spentRaw += out;
}

export function scopeAccount(inner: LocalAccount, scope: SessionScope): LocalAccount {
  const refuse = (what: string) => async (): Promise<never> => {
    throw new ScopeError(`Session refuses ${what}`);
  };
  const account = toAccount({
    address: inner.address,
    signMessage: (args) => inner.signMessage(args),
    signTypedData: refuse("EIP-712 signatures") as LocalAccount["signTypedData"],
    signTransaction: async (tx, opts) => {
      enforceScope(scope, tx);
      return inner.signTransaction(tx, opts);
    },
  });
  return { ...account, sign: refuse("raw hash signing"), signAuthorization: refuse("EIP-7702 authorizations") };
}
