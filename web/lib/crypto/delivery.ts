// Credential delivery encryption — shared/INTERFACES.md §4.
// Buyer key comes from the passkey PRF via HKDF; it is NOT the wallet key.
import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/hashes/utils";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { bytesToHex, hexToBytes, type Hex } from "viem";

export type CredentialPayload = {
  host: string;
  port: number;
  username: string;
  authType: "ssh-key" | "password";
  keyOrPassword: string;
  gpuCount: number;
  gpuClass: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

const KEY_SALT = enc.encode("gridlock");
const KEY_INFO = enc.encode("gridlock/delivery-x25519/v1");
const SYM_SALT = enc.encode("gridlock-payload");
const SYM_INFO = enc.encode("gridlock/xchacha20poly1305/v1");

export type DeliveryKeypair = { privateKey: Uint8Array; publicKey: Uint8Array };

/** HKDF-SHA256(prfOutput, "gridlock", "gridlock/delivery-x25519/v1") → X25519 keypair. */
export function deriveDeliveryKeypair(prfOutput: Uint8Array): DeliveryKeypair {
  if (prfOutput.length !== 32) throw new Error("PRF output must be 32 bytes");
  const privateKey = hkdf(sha256, prfOutput, KEY_SALT, KEY_INFO, 32);
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

const symmetricKey = (shared: Uint8Array) => hkdf(sha256, shared, SYM_SALT, SYM_INFO, 32);

/** Provider side: wire = ephemeralPub(32) || nonce(24) || ciphertext+tag. */
export function encryptCredentials(buyerEncPubKey: Hex, payload: CredentialPayload): Hex {
  const buyerPub = hexToBytes(buyerEncPubKey);
  if (buyerPub.length !== 32) throw new Error("buyerEncPubKey must be 32 bytes");
  if (buyerPub.every((b: number) => b === 0)) throw new Error("Buyer did not register an encryption key");
  const ephPriv = x25519.utils.randomPrivateKey();
  const ephPub = x25519.getPublicKey(ephPriv);
  const key = symmetricKey(x25519.getSharedSecret(ephPriv, buyerPub));
  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(key, nonce).encrypt(enc.encode(JSON.stringify(payload)));
  ephPriv.fill(0);
  key.fill(0);
  const wire = new Uint8Array(32 + 24 + ct.length);
  wire.set(ephPub, 0);
  wire.set(nonce, 32);
  wire.set(ct, 56);
  return bytesToHex(wire);
}

/** Buyer side. Throws if the ciphertext was not addressed to this key or was tampered with. */
export function decryptCredentials(buyerPrivateKey: Uint8Array, wireHex: Hex): CredentialPayload {
  const wire = hexToBytes(wireHex);
  if (wire.length < 32 + 24 + 16) throw new Error("Ciphertext too short");
  const ephPub = wire.slice(0, 32);
  const nonce = wire.slice(32, 56);
  const key = symmetricKey(x25519.getSharedSecret(buyerPrivateKey, ephPub));
  try {
    const pt = xchacha20poly1305(key, nonce).decrypt(wire.slice(56));
    return JSON.parse(dec.decode(pt)) as CredentialPayload;
  } finally {
    key.fill(0);
  }
}
