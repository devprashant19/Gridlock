import { createPublicClient, defineChain, http } from "viem";
import { monadTestnet as viemMonadTestnet } from "viem/chains";
import { ethers } from "ethers";
import { CHAIN_ID, RPC_URL } from "./config";

export const monadTestnet = defineChain({
  ...viemMonadTestnet,
  id: CHAIN_ID,
  rpcUrls: { default: { http: [RPC_URL] } },
});

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(RPC_URL, { batch: true }),
});

let ethersProvider: ethers.providers.JsonRpcProvider | undefined;
/** ethers v5 provider for the Kuru SDK (it only speaks ethers v5). */
export function getEthersProvider() {
  ethersProvider ??= new ethers.providers.StaticJsonRpcProvider(RPC_URL, {
    chainId: CHAIN_ID,
    name: "monad-testnet",
  });
  return ethersProvider;
}
