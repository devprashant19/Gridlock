import { ethers } from "ethers";

export const DEFAULT_VERIFIER_SIGNER_ADDRESS =
  "0x5BdB81d7ac3d9296ff161037316B1CB91EAabf3F";

export const EIP712_VERDICT_TYPES = {
  Verdict: [
    { name: "deliveryId", type: "uint256" },
    { name: "verdict", type: "uint8" },
    { name: "tflopsE2", type: "uint32" },
    { name: "resultRoot", type: "bytes32" },
  ],
};

/**
 * Builds the canonical EIP-712 domain for Gridlock Verifier
 */
export function buildVerifierDomain(
  verifyingContract: string,
  chainId: number = 10143
) {
  return {
    name: "Gridlock Verifier",
    version: "1",
    chainId: chainId,
    verifyingContract: ethers.getAddress(verifyingContract),
  };
}

/**
 * Recovers and cryptographically verifies the EIP-712 signer of a hardware verdict
 */
export function verifyEip712VerdictSignature(
  deliveryId: bigint | number,
  verdict: number,
  tflopsE2: number,
  resultRoot: string,
  signature: string,
  verifyingContract: string = "0x4444444444444444444444444444444444444444",
  expectedSignerAddress: string = DEFAULT_VERIFIER_SIGNER_ADDRESS,
  chainId: number = 10143
): { valid: boolean; recoveredAddress: string } {
  if (!signature || signature.length < 130) {
    throw new Error(`Invalid signature length: ${signature}`);
  }

  const domain = buildVerifierDomain(verifyingContract, chainId);
  const value = {
    deliveryId: BigInt(deliveryId),
    verdict: Number(verdict),
    tflopsE2: Number(tflopsE2),
    resultRoot: resultRoot,
  };

  const recoveredAddress = ethers.verifyTypedData(
    domain,
    EIP712_VERDICT_TYPES,
    value,
    signature
  );

  const isValid =
    recoveredAddress.toLowerCase() === expectedSignerAddress.toLowerCase();

  if (!isValid) {
    throw new Error(
      `EIP-712 Signer Mismatch: Expected ${expectedSignerAddress}, recovered ${recoveredAddress}`
    );
  }

  return { valid: true, recoveredAddress };
}
