# Gridlock Smart Contract Integration Handoff

This guide provides teammates across workstreams (CRE Workflows, Web Frontend, Verifier, and Indexer) with the finalized contract interfaces, artifacts, and integration specs.

## 1. Network & Toolchain Baseline
- **Target Network:** Monad Testnet (`10143`)
- **RPC Endpoint:** `https://testnet-rpc.monad.xyz`
- **Solidity Version:** `0.8.24` (optimizer: 200 runs)

---

## 2. ABI Artifacts
Compiler-generated ABIs are located in the repository's root `abis/` directory:
- `abis/DeliveryEscrow.json`
- `abis/GridUSD.json`
- `abis/HourToken.json`
- `abis/IndexOracle.json`
- `abis/SeriesFactory.json`

To regenerate ABIs from current compiler output:
```bash
python3 contracts/export_abis.py
```

---

## 3. Core Contract Methods & Interactions

### DeliveryEscrow (`DeliveryEscrow.sol`)
1. **Provider Onboarding:**
   - `registerProvider(string name)`
   - Requires one-time call before provider can call `mint()`.
2. **Minting Compute Capacity:**
   - `mint(uint256 seriesId, uint256 hours_) external returns (uint256 bond)`
   - Pulls `(hours * oraclePriceE8 * 120) / 10000` GridUSD (6 decimals) and mints `hours * 1e18` HourTokens to provider.
3. **Buyer Redemption:**
   - `redeem(uint256 seriesId, uint256 hours_, bytes32 buyerEncPubKey) external returns (uint256 deliveryId)`
   - Burns HourTokens, FIFO assigns provider, and sets a 2-hour provisioning deadline.
4. **Provider Provisioning:**
   - `provision(uint256 deliveryId, bytes ciphertext) external`
   - Callable strictly by assigned provider before deadline. `ciphertext` must follow `0x01 || ephPub(32) || nonce(24) || authTag(16)` format.
5. **Settlement (Verifier EIP-712 Signature):**
   - `settleWithSig(uint256 deliveryId, uint8 verdict, uint32 tflopsE2, bytes32 resultRoot, bytes signature)`
   - Anyone can submit; verified against configured `verifierSigner`.
   - Verdicts: `1 = Pass` (100% provider), `2 = Degraded` (70% provider / 30% buyer), `3 = Fail` (100% buyer).
6. **Settlement (Chainlink CRE Forwarder):**
   - `onReport(bytes report)`
   - Callable strictly by authorized `forwarder`. Report is `abi.encode(deliveryId, verdict, tflopsE2, resultRoot)`.
7. **Timeout Claims:**
   - `claimTimeout(uint256 deliveryId) external`
   - Unprovisioned past deadline (`block.timestamp > d.deadline`): 100% refund to buyer.
   - Provisioned past rental buffer (`block.timestamp > d.provisionedAt + hours*1h + 1h`): 100% release to provider.
8. **Unsold Capacity Withdrawal:**
   - `withdrawUnsold(uint256 seriesId, uint256 hours_) public`
   - Releases unsold capacity and refunds collateral after series window end.

### IndexOracle (`IndexOracle.sol`)
1. **Query Latest Price:**
   - `latest(bytes32 gpuClass) external view returns (uint128 priceE8, uint64 dayKey)`
2. **CRE Price Feed Report:**
   - `onReport(bytes report)`
   - Callable strictly by `forwarder`. Report is `abi.encode(gpuClass, dayKey, priceE8)`.

---

## 4. Events for Indexer (Envio)

```solidity
event ProviderRegistered(address indexed provider, string name);
event Minted(uint256 indexed seriesId, address indexed provider, uint256 hours_, uint256 bond);
event DeliveryRequested(uint256 indexed deliveryId, uint256 indexed seriesId, address indexed buyer, address provider, uint256 hours_, bytes32 buyerEncPubKey, uint64 deadline);
event Provisioned(uint256 indexed deliveryId, bytes ciphertext);
event Settled(uint256 indexed deliveryId, uint8 verdict, uint32 tflopsE2, uint256 toBuyer, uint256 toProvider);
event TimeoutClaimed(uint256 indexed deliveryId, uint256 toBuyer, uint256 toProvider);
event PrintPublished(bytes32 indexed gpuClass, uint64 indexed dayKey, uint128 priceE8);
```

---

## 5. Deployment Metadata Consumption
Consumers can import the strongly-typed schema from `shared/types.ts`:
```typescript
import { parseDeploymentAddresses } from "../shared/types";
import testnetJson from "../deployments/testnet.json";

const deployment = parseDeploymentAddresses(testnetJson);
console.log(deployment.contracts.DeliveryEscrow);
```
