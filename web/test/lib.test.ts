import { describe, expect, it } from "vitest";
import { encodeFunctionData, keccak256, parseTransaction, recoverTransactionAddress, toBytes, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ethers } from "ethers";
import { createSecp256k1SigningSession } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { decryptCredentials, deriveDeliveryKeypair, encryptCredentials, type CredentialPayload } from "../lib/crypto/delivery";
import { deriveEvmPrivateKey } from "../lib/wallet/derive";
import { enforceScope, scopeAccount, ScopeError, type SessionScope } from "../lib/wallet/scope";
import { MeraEthersSigner } from "../lib/wallet/ethersSigner";
import { gridUsdAbi } from "../lib/abis";
import { classNameFromHash, IS_MOCK, SERIES } from "../lib/config";

const prf = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const payload: CredentialPayload = {
  host: "192.0.2.1", port: 22, username: "root", authType: "ssh-key",
  keyOrPassword: "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n", gpuCount: 1, gpuClass: "T4",
};
const toHex32 = (b: Uint8Array) => `0x${Buffer.from(b).toString("hex")}` as const;

describe("credential delivery (INTERFACES §4)", () => {
  it("round-trips provider → buyer", () => {
    const kp = deriveDeliveryKeypair(prf);
    const wire = encryptCredentials(toHex32(kp.publicKey), payload);
    // 32 eph pub + 24 nonce + plaintext + 16 tag
    expect((wire.length - 2) / 2).toBe(32 + 24 + JSON.stringify(payload).length + 16);
    expect(decryptCredentials(kp.privateKey, wire)).toEqual(payload);
  });

  it("is deterministic per PRF output and unrelated to the wallet key", () => {
    const a = deriveDeliveryKeypair(prf);
    const b = deriveDeliveryKeypair(Uint8Array.from(prf));
    expect(toHex32(a.publicKey)).toBe(toHex32(b.publicKey));
    expect(toHex32(a.privateKey)).not.toBe(toHex32(deriveEvmPrivateKey(prf)));
  });

  it("rejects the wrong buyer and tampering", () => {
    const kp = deriveDeliveryKeypair(prf);
    const other = deriveDeliveryKeypair(new Uint8Array(32).fill(9));
    const wire = encryptCredentials(toHex32(kp.publicKey), payload);
    expect(() => decryptCredentials(other.privateKey, wire)).toThrow();
    const tampered = (wire.slice(0, -2) + (wire.endsWith("00") ? "01" : "00")) as `0x${string}`;
    expect(() => decryptCredentials(kp.privateKey, tampered)).toThrow();
  });

  it("refuses an empty buyer key", () => {
    expect(() => encryptCredentials(`0x${"00".repeat(32)}`, payload)).toThrow(/encryption key/);
  });
});

describe("wallet derivation", () => {
  it("matches an independent BIP-39/44 derivation", () => {
    const pk = deriveEvmPrivateKey(prf);
    const mnemonic = ethers.utils.entropyToMnemonic(prf);
    const ref = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0");
    expect(privateKeyToAccount(toHex32(pk)).address).toBe(ref.address);
  });
});

const GUSD = "0x1111111111111111111111111111111111111111" as Address;
const ESCROW = "0x4444444444444444444444444444444444444444" as Address;
const OUTSIDER = "0x9999999999999999999999999999999999999990" as Address;
const newScope = (): SessionScope => ({ allowlist: [GUSD, ESCROW], gridUSD: GUSD, capRaw: 200_000_000n, spentRaw: 0n });
const approve = (amt: bigint) => encodeFunctionData({ abi: gridUsdAbi, functionName: "approve", args: [ESCROW, amt] });

describe("session scope", () => {
  it("allows allowlisted calls and books gUSD spend", () => {
    const s = newScope();
    enforceScope(s, { to: GUSD, data: approve(150_000_000n) });
    enforceScope(s, { to: GUSD, data: encodeFunctionData({ abi: gridUsdAbi, functionName: "faucet" }) });
    expect(s.spentRaw).toBe(150_000_000n);
    expect(() => enforceScope(s, { to: GUSD, data: approve(60_000_000n) })).toThrow(/cap/);
    expect(s.spentRaw).toBe(150_000_000n);
  });

  it("refuses foreign contracts, native value, deployments", () => {
    const s = newScope();
    expect(() => enforceScope(s, { to: OUTSIDER, data: "0x" })).toThrow(ScopeError);
    expect(() => enforceScope(s, { to: ESCROW, value: 1n })).toThrow(/native/);
    expect(() => enforceScope(s, { to: undefined })).toThrow(/deploy/);
  });

  it("wraps a real Mera session; ethers adapter signs only in-scope txs", async () => {
    const pk = deriveEvmPrivateKey(prf);
    const session = createSecp256k1SigningSession({ privateKey: pk });
    pk.fill(0);
    const scoped = scopeAccount(toViemAccount(session), newScope());
    await expect(scoped.signTypedData({ domain: {}, types: {}, primaryType: "x", message: {} } as never)).rejects.toThrow(ScopeError);
    await expect(scoped.signAuthorization!({ address: OUTSIDER, chainId: 1, nonce: 0 } as never)).rejects.toThrow(ScopeError);

    const signer = new MeraEthersSigner(scoped, 10143);
    const raw = await signer.signTransaction({
      to: ESCROW, data: "0x12345678", nonce: 3, gasLimit: 100000, maxFeePerGas: 10n ** 9n, maxPriorityFeePerGas: 1n, type: 2, chainId: 10143,
    });
    const parsed = parseTransaction(raw as `0x${string}`);
    expect(parsed.to?.toLowerCase()).toBe(ESCROW);
    expect(parsed.chainId).toBe(10143);
    expect(await recoverTransactionAddress({ serializedTransaction: raw as never })).toBe(scoped.address);

    await expect(signer.signTransaction({ to: OUTSIDER, nonce: 0, gasLimit: 21000, gasPrice: 1 })).rejects.toThrow(ScopeError);
    session.end();
    await expect(signer.signTransaction({ to: ESCROW, nonce: 0, gasLimit: 21000, gasPrice: 1 })).rejects.toThrow();
  });
});

describe("config", () => {
  it("resolves class names from series gpuClass hashes", () => {
    expect(classNameFromHash(keccak256(toBytes("T4")))).toBe("T4");
    expect(SERIES.find((s) => s.symbol === "gT4-NOW")?.className).toBe("T4");
  });
  it("detects placeholder deployments", () => {
    expect(typeof IS_MOCK).toBe("boolean");
  });
});
