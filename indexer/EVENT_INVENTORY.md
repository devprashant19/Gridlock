# Gridlock Indexed Event Inventory

**Date:** 2026-10-14  
**Workstream:** 05 — Envio Indexer  
**Branch:** `feat/envio-indexer`  

## 1. Verified Event Signatures

All event signatures below are verified against compiled ABI artifacts in `abis/*.json`.

### A. `DeliveryEscrow`
- **`ProviderRegistered(address indexed provider, string name)`**
  - Topics: `topic[1] = provider`
  - Data: `string name`
- **`Minted(uint256 indexed seriesId, address indexed provider, uint256 hours_, uint256 bond)`**
  - Topics: `topic[1] = seriesId`, `topic[2] = provider`
  - Data: `uint256 hours_`, `uint256 bond`
- **`DeliveryRequested(uint256 indexed deliveryId, uint256 indexed seriesId, address indexed buyer, address provider, uint256 hours_, bytes32 buyerEncPubKey, uint64 deadline)`**
  - Topics: `topic[1] = deliveryId`, `topic[2] = seriesId`, `topic[3] = buyer`
  - Data: `address provider`, `uint256 hours_`, `bytes32 buyerEncPubKey`, `uint64 deadline`
- **`Provisioned(uint256 indexed deliveryId, bytes ciphertext)`**
  - Topics: `topic[1] = deliveryId`
  - Data: `bytes ciphertext`
- **`Settled(uint256 indexed deliveryId, uint8 verdict, uint32 tflopsE2, uint256 toBuyer, uint256 toProvider)`**
  - Topics: `topic[1] = deliveryId`
  - Data: `uint8 verdict`, `uint32 tflopsE2`, `uint256 toBuyer`, `uint256 toProvider`
- **`TimeoutClaimed(uint256 indexed deliveryId, uint256 toBuyer, uint256 toProvider)`**
  - Topics: `topic[1] = deliveryId`
  - Data: `uint256 toBuyer`, `uint256 toProvider`

### B. `SeriesFactory`
- **`SeriesCreated(uint256 indexed seriesId, bytes32 indexed gpuClass, address token, uint64 windowStart, uint64 windowEnd, string symbol)`**
  - Topics: `topic[1] = seriesId`, `topic[2] = gpuClass`
  - Data: `address token`, `uint64 windowStart`, `uint64 windowEnd`, `string symbol`

### C. `IndexOracle`
- **`PrintPublished(bytes32 indexed gpuClass, uint64 indexed dayKey, uint128 priceE8)`**
  - Topics: `topic[1] = gpuClass`, `topic[2] = dayKey`
  - Data: `uint128 priceE8`
