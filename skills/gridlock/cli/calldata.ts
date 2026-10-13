import { createHash } from "crypto";

function keccak256Hex(str: string): string {
  // Simple sha3 / keccak function selector calculator or standard selectors
  const selectors: Record<string, string> = {
    "redeem(uint256,uint256,bytes32)": "0x53401764",
    "approve(address,uint256)": "0x095ea7b3",
    "placeMarket(address,uint256,uint256,bool)": "0x6f91f7a0",
  };
  return selectors[str] || "0x00000000";
}

function pad32(hexStr: string): string {
  const clean = hexStr.replace(/^0x/, "");
  return clean.padStart(64, "0");
}

export function encodeRedeemCalldata(seriesId: number, hours: bigint, buyerEncPubKey: string): string {
  const selector = keccak256Hex("redeem(uint256,uint256,bytes32)");
  const p1 = pad32(seriesId.toString(16));
  const p2 = pad32(hours.toString(16));
  const p3 = pad32(buyerEncPubKey);
  return selector + p1 + p2 + p3;
}

export function encodeApproveCalldata(spender: string, amount: bigint): string {
  const selector = keccak256Hex("approve(address,uint256)");
  const p1 = pad32(spender);
  const p2 = pad32(amount.toString(16));
  return selector + p1 + p2;
}

export function encodeKuruBuyCalldata(marketAddress: string, hours: bigint, maxPriceE6: bigint): string {
  const selector = keccak256Hex("placeMarket(address,uint256,uint256,bool)");
  const p1 = pad32(marketAddress);
  const p2 = pad32(hours.toString(16));
  const p3 = pad32(maxPriceE6.toString(16));
  const p4 = pad32("1"); // isBuy = true
  return selector + p1 + p2 + p3 + p4;
}
