// prfOutput → BIP-39 mnemonic → seed → m/44'/60'/0'/0/0 (docs/phases/03-web-app.md §A).
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";

export const EVM_PATH = "m/44'/60'/0'/0/0";

/** Returns a fresh copy of the account private key. Caller must zero it. */
export function deriveEvmPrivateKey(prfOutput: Uint8Array): Uint8Array {
  if (prfOutput.length !== 32) throw new Error("PRF output must be 32 bytes");
  const mnemonic = entropyToMnemonic(prfOutput, wordlist);
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(EVM_PATH);
  if (!child.privateKey) throw new Error("HD derivation failed");
  const pk = Uint8Array.from(child.privateKey);
  seed.fill(0);
  root.wipePrivateData();
  child.wipePrivateData();
  return pk;
}
