# Contract Interface Compatibility Matrix

This document provides a comprehensive comparative audit of all public and external functions, events, argument types, return types, and access controls across `GridUSD`, `HourToken`, `IndexOracle`, `SeriesFactory`, and `DeliveryEscrow` against the frozen interface specification in `shared/INTERFACES.md`, as required by Step 4 of `implementation.md`.

*Per Step 4 instructions, no signatures are modified in this step.*

---

## 1. GridUSD Compatibility Matrix

| Element | `shared/INTERFACES.md` Specification | `contracts/src/GridUSD.sol` Implementation | Status | Notes |
|---|---|---|---|---|
| **Decimals** | 6 decimals | `uint8 public constant decimals = 6;` | **MATCH** | Exact match |
| **faucet()** | Faucet mints 1,000 gUSD to caller, rate-limited 1/hour | `function faucet() external` (checks `block.timestamp >= lastFaucetTime + 1 hours`, mints `1000 * 1e6`) | **MATCH** | Exact match |
| **transfer()** | ERC-20 transfer | `function transfer(address to, uint256 amount) external returns (bool)` | **MATCH** | Exact match |
| **approve()** | ERC-20 approve | `function approve(address spender, uint256 amount) external returns (bool)` | **MATCH** | Exact match |
| **transferFrom()** | ERC-20 transferFrom | `function transferFrom(address from, address to, uint256 amount) external returns (bool)` | **MATCH** | Exact match |
| **Events** | `Transfer`, `Approval` | `Transfer(address,address,uint256)`, `Approval(address,address,uint256)` | **MATCH** | Exact match |

---

## 2. HourToken Compatibility Matrix

| Element | `shared/INTERFACES.md` Specification | `contracts/src/HourToken.sol` Implementation | Status | Notes |
|---|---|---|---|---|
| **Decimals** | 18 decimals (`1e18` = 1 GPU-hour) | `uint8 public constant decimals = 18;` | **MATCH** | Exact match |
| **Escrow Restriction** | Mint and burn only callable by escrow | `modifier onlyEscrow()` on `mint()` and `burn()` checking immutable `escrow` | **MATCH** | Exact match |
| **mint()** | `mint(address to, uint256 amount)` | `function mint(address to, uint256 amount) external onlyEscrow` | **MATCH** | Exact match |
| **burn()** | `burn(address from, uint256 amount)` | `function burn(address from, uint256 amount) external onlyEscrow` | **MATCH** | Exact match |
| **Events** | `Transfer`, `Approval` | Standard ERC-20 events | **MATCH** | Exact match |

---

## 3. IndexOracle Compatibility Matrix

| Element | `shared/INTERFACES.md` Specification | `contracts/src/IndexOracle.sol` Implementation | Status | Notes |
|---|---|---|---|---|
| **PrintPublished Event** | `event PrintPublished(bytes32 indexed gpuClass, uint64 indexed dayKey, uint128 priceE8);` | `event PrintPublished(bytes32 indexed gpuClass, uint64 indexed dayKey, uint128 priceE8);` | **MATCH** | Exact match |
| **latest()** | `function latest(bytes32 gpuClass) external view returns (uint128 priceE8, uint64 dayKey);` | `function latest(bytes32 gpuClass) external view returns (uint128 priceE8, uint64 dayKey)` | **MATCH** | Exact match |
| **pushPrint()** | `function pushPrint(bytes32 gpuClass, uint64 dayKey, uint128 priceE8) external;` | `function pushPrint(bytes32 gpuClass, uint64 dayKey, uint128 priceE8) external onlyOwnerOrForwarder` | **MATCH** | Restricted to owner or forwarder |
| **onReport()** | `function onReport(bytes calldata metadata, bytes calldata report) external;` | `function onReport(bytes calldata report) external` | **MISMATCH** | **Interface divergence**: `INTERFACES.md` specifies 2 parameters `(metadata, report)` for Chainlink CRE forwarder compatibility, while implementation has 1 parameter `(report)`. |
| **setForwarder()** | Mentioned in notes | `function setForwarder(address _forwarder) external onlyOwner` | **MATCH** | Allows setting CRE forwarder |
| **setFixedPrice()** | Demo fallback from `01-contracts.md` | `function setFixedPrice(string calldata className, uint128 priceE8) external onlyOwner` | **MATCH** | Owner helper for demo classes |

---

## 4. SeriesFactory Compatibility Matrix

| Element | `shared/INTERFACES.md` Specification | `contracts/src/SeriesFactory.sol` Implementation | Status | Notes |
|---|---|---|---|---|
| **SeriesCreated Event** | `event SeriesCreated(uint256 indexed seriesId, bytes32 indexed gpuClass, address token, uint64 windowStart, uint64 windowEnd, string symbol);` | `event SeriesCreated(uint256 indexed seriesId, bytes32 indexed gpuClass, address token, uint64 windowStart, uint64 windowEnd, string symbol);` | **MATCH** | Exact match |
| **createSeries()** | `function createSeries(bytes32 gpuClass, uint64 windowStart, uint64 windowEnd, string calldata symbol) external returns (uint256 seriesId);` | `function createSeries(bytes32 gpuClass, string calldata symbol, uint64 windowStart, uint64 windowEnd) external returns (uint256 seriesId, address token)` | **MISMATCH** | **Parameter Order Mismatch**: `symbol` is 2nd argument in source, but 4th in `INTERFACES.md`. Also returns `(seriesId, token)` rather than `(seriesId)`. |
| **series()** | `function series(uint256 seriesId) external view returns (bytes32 gpuClass, address token, uint64 windowStart, uint64 windowEnd);` | `function series(uint256 seriesId) external view returns (bytes32 gpuClass, address token, uint64 windowStart, uint64 windowEnd, string memory symbol)` | **MISMATCH** | Implementation returns 5 values (includes `symbol`), while `ISeriesFactory` returns 4 values. |

---

## 5. DeliveryEscrow Compatibility Matrix

| Element | `shared/INTERFACES.md` Specification | `contracts/src/DeliveryEscrow.sol` Implementation | Status | Notes |
|---|---|---|---|---|
| **Events** | `ProviderRegistered`, `Minted`, `DeliveryRequested`, `Provisioned`, `Settled`, `TimeoutClaimed` | Same 6 events declared | **MATCH** | All event signatures and indexed parameters match `INTERFACES.md`. |
| **registerProvider()** | `function registerProvider(string calldata name) external;` | `function registerProvider(string calldata name) external` | **MATCH** | Exact match |
| **mint()** | `function mint(uint256 seriesId, uint256 hours_) external;` | `function mint(uint256 seriesId, uint256 hours_) external returns (uint256 bond)` | **MATCH (Return)** | Returns `bond` (compatible enhancement). **Defect**: Lacks check for `providers[msg.sender].registered`. Overwrites `bondPerHour`. |
| **redeem()** | `function redeem(uint256 seriesId, uint256 hours_, bytes32 buyerEncPubKey) external returns (uint256 deliveryId);` | `function redeem(uint256 seriesId, uint256 hours_, bytes32 buyerEncPubKey) external returns (uint256 deliveryId)` | **MATCH** | Exact match |
| **provision()** | `function provision(uint256 deliveryId, bytes calldata ciphertext) external;` | `function provision(uint256 deliveryId, bytes calldata ciphertext) external` | **MATCH** | Exact match signature. **Defect**: Lacks check `block.timestamp <= d.deadline`. |
| **settleWithSig()** | `function settleWithSig(uint256 deliveryId, uint8 verdict, uint32 tflopsE2, bytes32 resultRoot, bytes calldata sig) external;` | `function settleWithSig(uint256 deliveryId, uint8 verdict, uint32 tflopsE2, bytes32 resultRoot, bytes calldata signature) external` | **MATCH** | Exact match signature. **Defect**: DEGRADED payout calculation splits 30% provider / 70% buyer instead of specified 70% provider / 30% buyer. |
| **onReport()** | `function onReport(bytes calldata metadata, bytes calldata report) external;` | `function onReport(bytes calldata report) external onlyForwarder` | **MISMATCH** | **Parameter Count Mismatch**: CRE forwarder specification expects `(bytes calldata metadata, bytes calldata report)`, implementation has `(bytes calldata report)`. |
| **claimTimeout()** | `function claimTimeout(uint256 deliveryId) external;` | `function claimTimeout(uint256 deliveryId) external` | **MATCH** | Exact match |
| **withdrawUnsold()** | `function withdrawUnsold(uint256 seriesId) external;` | `function withdrawUnsold(uint256 seriesId, uint256 hours_) external` | **MISMATCH** | **Parameter Mismatch**: `INTERFACES.md` has `(uint256 seriesId)`, while implementation has `(uint256 seriesId, uint256 hours_)`. |
| **deliveries()** | `deliveries(uint256) returns (seriesId, buyer, provider, hours, bond, buyerEncPubKey, deadline, status, verdict)` | Array getter `deliveries(uint256)` returns 13 fields (including internal tracking fields) | **MISMATCH** | Public array auto-getter exposes all struct fields (13) rather than the 9-field interface tuple. |
| **EIP-712 Domain** | `name: "Gridlock", version: "1", chainId: 10143, verifyingContract: <DeliveryEscrow>` | `DOMAIN_SEPARATOR` encodes `keccak256(bytes("Gridlock Verifier"))` | **MISMATCH** | Domain name string mismatch: `"Gridlock Verifier"` vs `"Gridlock"`. |

---

## 6. Summary of Actionable Divergences to Resolve in Phases A2–A4

1. **`IndexOracle.onReport`**: Add `bytes calldata metadata` parameter to match Chainlink CRE forwarder standard `(metadata, report)`.
2. **`DeliveryEscrow.onReport`**: Add `bytes calldata metadata` parameter to match Chainlink CRE forwarder standard `(metadata, report)`.
3. **`SeriesFactory.createSeries`**: Align parameter ordering with `(gpuClass, windowStart, windowEnd, symbol)`.
4. **`DeliveryEscrow.withdrawUnsold`**: Support single-parameter `withdrawUnsold(uint256 seriesId)` to withdraw all unsold hours, or provide overloaded variant.
5. **`DeliveryEscrow` EIP-712 Domain**: Change domain name from `"Gridlock Verifier"` to `"Gridlock"`.
6. **`DeliveryEscrow._settle` DEGRADED Split**: Correct bond distribution to 70% provider / 30% buyer.
7. **`DeliveryEscrow.mint` & `provision` Guards**: Enforce provider registration on mint; enforce deadline on provision.
