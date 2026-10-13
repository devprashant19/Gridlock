import { ethers } from "ethers";

export interface GasProfileReceipt {
  operation: "INDEX_ORACLE_REPORT" | "DELIVERY_ESCROW_SETTLEMENT";
  targetContract: string;
  calldataHex: string;
  calldataBytes: number;
  zeroBytes: number;
  nonZeroBytes: number;
  intrinsicCalldataGas: number;
  estimatedExecutionGas: number;
  totalEstimatedGas: number;
  monadFinalityBlocks: number;
  estimatedLatencyMs: number;
}

/**
 * Accurately calculates EVM intrinsic calldata gas and estimates total execution gas on Monad
 */
export function profileCalldataGas(
  operation: "INDEX_ORACLE_REPORT" | "DELIVERY_ESCROW_SETTLEMENT",
  targetContract: string,
  calldataHex: string
): GasProfileReceipt {
  const bytes = ethers.getBytes(calldataHex);
  let zeroBytes = 0;
  let nonZeroBytes = 0;

  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      zeroBytes++;
    } else {
      nonZeroBytes++;
    }
  }

  // EIP-2028: 4 gas per zero byte, 16 gas per non-zero byte
  const intrinsicCalldataGas = 21000 + zeroBytes * 4 + nonZeroBytes * 16;

  // Approximate execution gas based on contract operations
  let estimatedExecutionGas = 0;
  if (operation === "INDEX_ORACLE_REPORT") {
    // SSTORE update on PricePrint struct (20k gas) + PrintPublished event log (~2k gas)
    estimatedExecutionGas = 24500;
  } else {
    // Delivery state read, status update (5k gas), ERC20 transfer (gUSD) (~26k gas), Settled event (~2.5k gas)
    estimatedExecutionGas = 38500;
  }

  const totalEstimatedGas = intrinsicCalldataGas + estimatedExecutionGas;

  return {
    operation,
    targetContract,
    calldataHex,
    calldataBytes: bytes.length,
    zeroBytes,
    nonZeroBytes,
    intrinsicCalldataGas,
    estimatedExecutionGas,
    totalEstimatedGas,
    monadFinalityBlocks: 1,
    estimatedLatencyMs: 400, // 400ms block time on Monad
  };
}

/**
 * Formats a clean ASCII summary receipt of gas consumption
 */
export function formatGasProfileReceipt(receipt: GasProfileReceipt): string {
  const lines = [
    `+------------------- Monad Testnet Gas & Execution Profile -------------------+`,
    `| Operation:            ${receipt.operation.padEnd(46)}|`,
    `| Target Contract:      ${receipt.targetContract.padEnd(46)}|`,
    `| Calldata Size:        ${`${receipt.calldataBytes} bytes (${receipt.nonZeroBytes} non-zero, ${receipt.zeroBytes} zero)`.padEnd(46)}|`,
    `| Intrinsic Gas:        ${`${receipt.intrinsicCalldataGas.toLocaleString()} gas`.padEnd(46)}|`,
    `| Execution Gas:        ${`${receipt.estimatedExecutionGas.toLocaleString()} gas`.padEnd(46)}|`,
    `| Total Gas Cost:       ${`${receipt.totalEstimatedGas.toLocaleString()} gas`.padEnd(46)}|`,
    `| Monad Block Finality: ${`1 block (~${receipt.estimatedLatencyMs}ms)`.padEnd(46)}|`,
    `+-----------------------------------------------------------------------------+`,
  ];
  return lines.join("\n");
}
