import * as crypto from "node:crypto";

export interface PodCredentials {
  host: string;
  port: number;
  username: string;
  authType: "ssh-key" | "password";
  keyOrPassword: string;
  gpuCount: number;
  gpuClass: string;
}

const PKCS8_X25519_HEADER = Buffer.from("302e020100300506032b656e04220420", "hex");
const SPKI_X25519_HEADER = Buffer.from("302a300506032b656e032100", "hex");

export function rawToPrivateKey(rawPriv32: Buffer): crypto.KeyObject {
  return crypto.createPrivateKey({
    key: Buffer.concat([PKCS8_X25519_HEADER, rawPriv32]),
    format: "der",
    type: "pkcs8",
  });
}

export function rawToPublicKey(rawPub32: Buffer): crypto.KeyObject {
  return crypto.createPublicKey({
    key: Buffer.concat([SPKI_X25519_HEADER, rawPub32]),
    format: "der",
    type: "spki",
  });
}

export function publicKeyToRaw(pubKey: crypto.KeyObject): Buffer {
  const der = pubKey.export({ format: "der", type: "spki" });
  return der.subarray(12);
}

/**
 * 4.1 Key Derivation:
 * Buyer derives X25519 private key & public key from Mera passkey PRF output (32 bytes).
 */
export function deriveBuyerKeys(prfOutputHex: string): { privateKeyHex: string; buyerEncPubKeyHex: string } {
  const cleanPrf = prfOutputHex.replace(/^0x/, "");
  const ikm = Buffer.from(cleanPrf, "hex");
  if (ikm.length !== 32) {
    throw new Error(`PRF output must be 32 bytes, got ${ikm.length} bytes`);
  }

  const salt = Buffer.from("gridlock");
  const info = Buffer.from("gridlock/delivery-x25519/v1");
  const derivedPriv = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, 32));

  const privKeyObj = rawToPrivateKey(derivedPriv);
  const pubKeyObj = crypto.createPublicKey(privKeyObj);
  const rawPub = publicKeyToRaw(pubKeyObj);

  return {
    privateKeyHex: "0x" + derivedPriv.toString("hex"),
    buyerEncPubKeyHex: "0x" + rawPub.toString("hex"),
  };
}

/**
 * 4.2 Provider Encryption:
 * Provider encrypts pod credentials using ephemeral X25519 keypair and ChaCha20-Poly1305.
 * Output wire payload: ephemeralPub (32 bytes) || nonce (24 bytes) || encryptedDataWithTag (last 16 bytes = tag)
 */
export function encryptCredentials(buyerEncPubKeyHex: string, payload: PodCredentials): string {
  const cleanPub = buyerEncPubKeyHex.replace(/^0x/, "");
  const rawBuyerPub = Buffer.from(cleanPub, "hex");
  if (rawBuyerPub.length !== 32) {
    throw new Error(`Buyer public key must be 32 bytes, got ${rawBuyerPub.length} bytes`);
  }
  const buyerPubObj = rawToPublicKey(rawBuyerPub);

  // Generate ephemeral X25519 keypair
  const ephemeralRawPriv = crypto.randomBytes(32);
  const ephemeralPrivObj = rawToPrivateKey(ephemeralRawPriv);
  const ephemeralPubObj = crypto.createPublicKey(ephemeralPrivObj);
  const rawEphemeralPub = publicKeyToRaw(ephemeralPubObj);

  // Derive shared secret
  const sharedSecret = crypto.diffieHellman({
    privateKey: ephemeralPrivObj,
    publicKey: buyerPubObj,
  });

  // Symmetric key via HKDF
  const salt = Buffer.from("gridlock-payload");
  const info = Buffer.from("gridlock/xchacha20poly1305/v1");
  const symmetricKey = Buffer.from(crypto.hkdfSync("sha256", sharedSecret, salt, info, 32));

  // 12-byte random IV for ChaCha20-Poly1305, zero-padded to 24-byte header for wire format
  const iv12 = crypto.randomBytes(12);
  const wireNonce24 = Buffer.concat([iv12, Buffer.alloc(12, 0)]);

  const plaintext = Buffer.from(JSON.stringify(payload), "utf-8");
  const cipher = crypto.createCipheriv("chacha20-poly1305", symmetricKey, iv12, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const wire = Buffer.concat([rawEphemeralPub, wireNonce24, encrypted, authTag]);
  return "0x" + wire.toString("hex");
}

/**
 * 4.3 Buyer Decryption:
 * Buyer extracts ephemeralPub, nonce, and ciphertext, re-derives shared secret, and decrypts credentials.
 */
export function decryptCredentials(buyerPrivKeyHex: string, ciphertextHex: string): PodCredentials {
  const cleanPriv = buyerPrivKeyHex.replace(/^0x/, "");
  const rawBuyerPriv = Buffer.from(cleanPriv, "hex");
  const buyerPrivObj = rawToPrivateKey(rawBuyerPriv);

  const cleanCipher = ciphertextHex.replace(/^0x/, "");
  const wire = Buffer.from(cleanCipher, "hex");

  if (wire.length < 32 + 24 + 16) {
    throw new Error("Ciphertext too short to contain valid Mera payload");
  }

  const rawEphemeralPub = wire.subarray(0, 32);
  const wireNonce24 = wire.subarray(32, 56);
  const iv12 = wireNonce24.subarray(0, 12);
  const encryptedWithTag = wire.subarray(56);

  const authTag = encryptedWithTag.subarray(encryptedWithTag.length - 16);
  const encryptedData = encryptedWithTag.subarray(0, encryptedWithTag.length - 16);

  const ephemeralPubObj = rawToPublicKey(rawEphemeralPub);
  const sharedSecret = crypto.diffieHellman({
    privateKey: buyerPrivObj,
    publicKey: ephemeralPubObj,
  });

  const salt = Buffer.from("gridlock-payload");
  const info = Buffer.from("gridlock/xchacha20poly1305/v1");
  const symmetricKey = Buffer.from(crypto.hkdfSync("sha256", sharedSecret, salt, info, 32));

  const decipher = crypto.createDecipheriv("chacha20-poly1305", symmetricKey, iv12, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

  return JSON.parse(decrypted.toString("utf-8")) as PodCredentials;
}

// CLI Execution Handler
async function main() {
  const args = process.argv.slice(2);
  const isDemo = args.includes("--demo") || args.length === 0;

  if (isDemo) {
    console.log("=============================================================");
    console.log("GRIDLOCK MERA PASSKEY PRF ENCRYPTION / DECRYPTION ENGINE");
    console.log("=============================================================");

    // 1. Simulate Buyer Passkey PRF Output
    const mockPrfOutput = "0x" + crypto.randomBytes(32).toString("hex");
    console.log(`[1] Buyer Mera Passkey PRF Output (32 bytes):`);
    console.log(`    ${mockPrfOutput}`);

    // 2. Derive Buyer X25519 Keypair
    const keys = deriveBuyerKeys(mockPrfOutput);
    console.log(`\n[2] Derived Buyer X25519 Keys (HKDF-SHA256):`);
    console.log(`    Buyer Public Key  (bytes32 onchain): ${keys.buyerEncPubKeyHex}`);
    console.log(`    Buyer Private Key (local passkey):   ${keys.privateKeyHex.slice(0, 18)}...`);

    // 3. Provider Provisions and Encrypts Credentials
    const sampleCredentials: PodCredentials = {
      host: "198.51.100.42",
      port: 22,
      username: "gridlock",
      authType: "ssh-key",
      keyOrPassword: "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA...\n-----END OPENSSH PRIVATE KEY-----",
      gpuCount: 1,
      gpuClass: "T4",
    };

    console.log(`\n[3] Provider Encrypting Pod Credentials:`);
    console.log(`    Host: ${sampleCredentials.host}:${sampleCredentials.port}`);
    console.log(`    GPU:  ${sampleCredentials.gpuCount}x ${sampleCredentials.gpuClass}`);

    const ciphertext = encryptCredentials(keys.buyerEncPubKeyHex, sampleCredentials);
    console.log(`\n[4] Encrypted Wire Ciphertext (for DeliveryEscrow.provision):`);
    console.log(`    Size: ${Buffer.from(ciphertext.slice(2), "hex").length} bytes`);
    console.log(`    Data: ${ciphertext.slice(0, 66)}...`);

    // 4. Buyer Decrypts Credentials
    const decrypted = decryptCredentials(keys.privateKeyHex, ciphertext);
    console.log(`\n[5] Buyer In-Memory Decryption Verification: [SUCCESS]`);
    console.log(`    Decrypted Host: ${decrypted.host}:${decrypted.port}`);
    console.log(`    Decrypted User: ${decrypted.username}`);
    console.log(`    Decrypted Class: ${decrypted.gpuClass}`);
    console.log(`    Decrypted SSH Connect: ssh ${decrypted.username}@${decrypted.host} -p ${decrypted.port}`);
    console.log("=============================================================");
    return;
  }

  if (args.includes("--derive")) {
    const prfIdx = args.indexOf("--prf");
    const prfHex = prfIdx !== -1 && args[prfIdx + 1] ? args[prfIdx + 1] : "0x" + crypto.randomBytes(32).toString("hex");
    const keys = deriveBuyerKeys(prfHex);
    console.log(JSON.stringify(keys, null, 2));
    return;
  }

  if (args.includes("--decrypt")) {
    const privIdx = args.indexOf("--priv");
    const cipherIdx = args.indexOf("--ciphertext");
    if (privIdx === -1 || cipherIdx === -1) {
      console.error("Usage: node cli/prf.ts --decrypt --priv <hex> --ciphertext <hex>");
      process.exit(1);
    }
    const creds = decryptCredentials(args[privIdx + 1], args[cipherIdx + 1]);
    console.log(JSON.stringify(creds, null, 2));
    return;
  }
}

if (process.argv[1]?.endsWith("prf.ts") || process.argv[1]?.endsWith("prf.js")) {
  main().catch((err) => {
    console.error("Error in Mera PRF execution:", err);
    process.exit(1);
  });
}
