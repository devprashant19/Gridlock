// Typed ABIs mirroring contracts/src/*.sol. The JSON in /abis is hand-written and
// lacks view functions we need (getDelivery, providers, openHours, …), so we keep the
// human-readable signatures here; they must match shared/INTERFACES.md + the sources.
import { parseAbi } from "viem";

export const gridUsdAbi = parseAbi([
  "function faucet()",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export const erc20Abi = gridUsdAbi;

export const indexOracleAbi = parseAbi([
  "function latest(bytes32 gpuClass) view returns (uint128 priceE8, uint64 dayKey)",
  "event PrintPublished(bytes32 indexed gpuClass, uint64 indexed dayKey, uint128 priceE8)",
]);

export const seriesFactoryAbi = parseAbi([
  "function series(uint256 seriesId) view returns (bytes32 gpuClass, address token, uint64 windowStart, uint64 windowEnd, string symbol)",
  "function seriesCount() view returns (uint256)",
]);

export const deliveryEscrowAbi = parseAbi([
  "struct Delivery { uint256 seriesId; address buyer; address provider; uint256 hours_; bytes32 buyerEncPubKey; uint64 deadline; uint64 provisionedAt; uint256 bondAmount; uint8 status; bytes ciphertext; uint8 verdict; uint32 tflopsE2; bytes32 resultRoot; }",
  "function registerProvider(string name)",
  "function mint(uint256 seriesId, uint256 hours_) returns (uint256 bond)",
  "function redeem(uint256 seriesId, uint256 hours_, bytes32 buyerEncPubKey) returns (uint256 deliveryId)",
  "function provision(uint256 deliveryId, bytes ciphertext)",
  "function settleWithSig(uint256 deliveryId, uint8 verdict, uint32 tflopsE2, bytes32 resultRoot, bytes signature)",
  "function claimTimeout(uint256 deliveryId)",
  "function withdrawUnsold(uint256 seriesId, uint256 hours_)",
  "function getDelivery(uint256 deliveryId) view returns (Delivery)",
  "function providers(address) view returns (string name, bool registered)",
  "function openHours(uint256 seriesId, address provider) view returns (uint256)",
  "function bondPerHour(uint256 seriesId, address provider) view returns (uint256)",
  "event ProviderRegistered(address indexed provider, string name)",
  "event Minted(uint256 indexed seriesId, address indexed provider, uint256 hours_, uint256 bond)",
  "event DeliveryRequested(uint256 indexed deliveryId, uint256 indexed seriesId, address indexed buyer, address provider, uint256 hours_, bytes32 buyerEncPubKey, uint64 deadline)",
  "event Provisioned(uint256 indexed deliveryId, bytes ciphertext)",
  "event Settled(uint256 indexed deliveryId, uint8 verdict, uint32 tflopsE2, uint256 toBuyer, uint256 toProvider)",
  "event TimeoutClaimed(uint256 indexed deliveryId, uint256 toBuyer, uint256 toProvider)",
]);
