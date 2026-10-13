import { x25519 } from "@noble/curves/ed25519";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { CredentialPayload } from "../../shared/types";

// Derives X25519 keypair from Mera passkey PRF output
export function deriveBuyerKeypair(prfOutput: Uint8Array): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const salt = new TextEncoder().encode("gridlock");
  const info = new TextEncoder().encode("gridlock/delivery-x25519/v1");
  const privateKey = hkdf(sha256, prfOutput, salt, info, 32);
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

// Provider encrypts credentials for buyer
export function encryptCredentials(
  buyerEncPubKey: Uint8Array,
  payload: CredentialPayload
): Uint8Array {
  const ephemeralPriv = x25519.utils.randomPrivateKey();
  const ephemeralPub = x25519.getPublicKey(ephemeralPriv);
  const sharedSecret = x25519.getSharedKey(ephemeralPriv, buyerEncPubKey);

  const salt = new TextEncoder().encode("gridlock-payload");
  const info = new TextEncoder().encode("gridlock/xchacha20poly1305/v1");
  const symmetricKey = hkdf(sha256, sharedSecret, salt, info, 32);

  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = xchacha20poly1305(symmetricKey, nonce);
  const ciphertext = cipher.encrypt(plaintext);

  // Wire format: ephemeralPub (32) || nonce (24) || ciphertext
  const result = new Uint8Array(32 + 24 + ciphertext.length);
  result.set(ephemeralPub, 0);
  result.set(nonce, 32);
  result.set(ciphertext, 56);
  return result;
}

// Buyer decrypts credentials with PRF-derived X25519 private key
export function decryptCredentials(
  buyerPrivKey: Uint8Array,
  wirePayload: Uint8Array
): CredentialPayload {
  const ephemeralPub = wirePayload.slice(0, 32);
  const nonce = wirePayload.slice(32, 56);
  const ciphertext = wirePayload.slice(56);

  const sharedSecret = x25519.getSharedKey(buyerPrivKey, ephemeralPub);
  const salt = new TextEncoder().encode("gridlock-payload");
  const info = new TextEncoder().encode("gridlock/xchacha20poly1305/v1");
  const symmetricKey = hkdf(sha256, sharedSecret, salt, info, 32);

  const cipher = xchacha20poly1305(symmetricKey, nonce);
  const decryptedBytes = cipher.decrypt(ciphertext);
  const jsonStr = new TextDecoder().decode(decryptedBytes);
  return JSON.parse(jsonStr) as CredentialPayload;
}
