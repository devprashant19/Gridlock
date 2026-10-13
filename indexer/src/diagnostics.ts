/**
 * Operational Diagnostics & Troubleshooting for Gridlock Envio Indexer
 */

export interface IndexerHealthCheck {
  chainId: number;
  rpcOk: boolean;
  rpcBlockNumber?: number;
  configContracts: string[];
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  diagnostics: string[];
}

export async function runIndexerHealthCheck(rpcUrl: string = "https://testnet-rpc.monad.xyz"): Promise<IndexerHealthCheck> {
  const diagnostics: string[] = [];
  let rpcOk = false;
  let rpcBlockNumber: number | undefined;

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      rpcBlockNumber = parseInt(data.result, 16);
      rpcOk = true;
      diagnostics.push(`Connected to Monad Testnet RPC at block ${rpcBlockNumber}`);
    } else {
      diagnostics.push(`Monad RPC returned status ${res.status}`);
    }
  } catch (err: any) {
    diagnostics.push(`RPC connection failure: ${err.message}`);
  }

  const contracts = [
    "DeliveryEscrow (0x4444444444444444444444444444444444444444)",
    "SeriesFactory (0x3333333333333333333333333333333333333333)",
    "IndexOracle (0x2222222222222222222222222222222222222222)",
  ];

  return {
    chainId: 10143,
    rpcOk,
    rpcBlockNumber,
    configContracts: contracts,
    status: rpcOk ? "HEALTHY" : "DEGRADED",
    diagnostics,
  };
}
