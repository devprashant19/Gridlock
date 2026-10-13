import { ethers } from "ethers";
import { profileCalldataGas, formatGasProfileReceipt } from "./gas_profiler.ts";
import { Logger } from "../common/logger.ts";

const logger = new Logger("broadcaster");

export interface BroadcastOptions {
  rpcUrl?: string;
  privateKey?: string;
  dryRun?: boolean;
}

export const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";
export const MONAD_CHAIN_ID = 10143;

/**
 * Broadcasts or simulates a CRE onReport call to Monad Testnet
 */
export async function broadcastOnReport(
  operation: "INDEX_ORACLE_REPORT" | "DELIVERY_ESCROW_SETTLEMENT",
  targetContract: string,
  reportBytesHex: string,
  options: BroadcastOptions = {}
): Promise<{ success: boolean; txHash?: string; receipt?: any; gasProfile: any }> {
  const rpcUrl = options.rpcUrl || MONAD_TESTNET_RPC;
  const iface = new ethers.Interface([
    "function onReport(bytes calldata report) external",
  ]);

  const calldata = iface.encodeFunctionData("onReport", [reportBytesHex]);
  const gasProfile = profileCalldataGas(operation, targetContract, calldata);

  console.log(formatGasProfileReceipt(gasProfile));

  // If dry-run or no private key configured, simulate safely
  if (options.dryRun || !options.privateKey) {
    logger.info("Executing dry-run simulation (no testnet funds spent)", {
      targetContract,
      calldataSize: gasProfile.calldataBytes,
      estimatedGas: gasProfile.totalEstimatedGas,
    });
    return {
      success: true,
      txHash: "0x" + "mock".padEnd(64, "0"),
      gasProfile,
    };
  }

  // Live broadcast mode
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, MONAD_CHAIN_ID);
    const wallet = new ethers.Wallet(options.privateKey, provider);

    logger.info(`Broadcasting onReport transaction via forwarder ${wallet.address}...`);
    const tx = await wallet.sendTransaction({
      to: targetContract,
      data: calldata,
      gasLimit: BigInt(Math.round(gasProfile.totalEstimatedGas * 1.2)),
    });

    logger.info(`Transaction submitted to Monad mempool: ${tx.hash}`);
    const receipt = await tx.wait(1);
    logger.info(`Transaction confirmed in Monad block #${receipt?.blockNumber}! Gas used: ${receipt?.gasUsed.toString()}`);

    return {
      success: true,
      txHash: tx.hash,
      receipt,
      gasProfile,
    };
  } catch (err: any) {
    logger.error(`On-chain write failed: ${err.message}`);
    throw err;
  }
}
