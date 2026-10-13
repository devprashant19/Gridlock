// ethers v5 Signer over the scoped Mera viem account, for the Kuru SDK.
// No private key ever reaches ethers; every tx still goes through enforceScope.
import { ethers } from "ethers";
import type { Address, Hex, LocalAccount, TransactionSerializable } from "viem";

const big = (v: ethers.BigNumberish | undefined | null) => (v == null ? undefined : BigInt(ethers.BigNumber.from(v).toString()));

export class MeraEthersSigner extends ethers.Signer {
  constructor(
    private readonly account: LocalAccount,
    readonly chainId: number,
    provider?: ethers.providers.Provider,
  ) {
    super();
    ethers.utils.defineReadOnly(this, "provider", provider);
  }

  async getAddress() {
    return this.account.address;
  }

  async signMessage(message: ethers.Bytes | string) {
    return this.account.signMessage({
      message: typeof message === "string" ? message : { raw: ethers.utils.hexlify(message) as Hex },
    });
  }

  async signTransaction(req: ethers.providers.TransactionRequest) {
    const tx = await ethers.utils.resolveProperties(req);
    const base = {
      chainId: this.chainId,
      to: tx.to as Address | undefined,
      data: (tx.data ? ethers.utils.hexlify(tx.data) : undefined) as Hex | undefined,
      value: big(tx.value),
      nonce: tx.nonce == null ? undefined : ethers.BigNumber.from(tx.nonce).toNumber(),
      gas: big(tx.gasLimit),
    };
    const viemTx: TransactionSerializable =
      tx.type === 2 || tx.maxFeePerGas != null
        ? { ...base, type: "eip1559", maxFeePerGas: big(tx.maxFeePerGas), maxPriorityFeePerGas: big(tx.maxPriorityFeePerGas) }
        : { ...base, type: "legacy", gasPrice: big(tx.gasPrice) };
    return this.account.signTransaction(viemTx);
  }

  connect(provider: ethers.providers.Provider) {
    return new MeraEthersSigner(this.account, this.chainId, provider);
  }
}
