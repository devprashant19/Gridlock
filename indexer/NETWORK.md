# Monad Testnet Indexing Network Configuration

**Date:** 2026-10-14  
**Workstream:** 05 — Envio Indexer  
**Branch:** `feat/envio-indexer`  

## 1. Network Parameters

| Parameter | Value | Verification Status |
|---|---|---|
| **Network Name** | Monad Testnet | Verified |
| **Chain ID** | `10143` (`0x279f`) | Verified via `eth_chainId` RPC call |
| **RPC Endpoint** | `https://testnet-rpc.monad.xyz` | Active and responsive |
| **HyperSync URL** | `https://monad-testnet.hypersync.xyz` | Specified in `metropolish/INTERFACES.md` |
| **Deploy Block** | `1234567` | Specified in `deployments/testnet.json` |

## 2. Envio HyperIndex Network Compatibility

In `config.yaml`, the chain configuration for Monad Testnet is structured as:

```yaml
chains:
  - id: 10143
    start_block: 0
    contracts:
      - name: DeliveryEscrow
        address: "0x4444444444444444444444444444444444444444"
        handler: src/EventHandlers.ts
        events:
          - event: ProviderRegistered(address indexed provider, string name)
          - event: Minted(uint256 indexed seriesId, address indexed provider, uint256 hours_, uint256 bond)
          - event: DeliveryRequested(uint256 indexed deliveryId, uint256 indexed seriesId, address indexed buyer, address provider, uint256 hours_, bytes32 buyerEncPubKey, uint64 deadline)
          - event: Provisioned(uint256 indexed deliveryId, bytes ciphertext)
          - event: Settled(uint256 indexed deliveryId, uint8 verdict, uint32 tflopsE2, uint256 toBuyer, uint256 toProvider)
          - event: TimeoutClaimed(uint256 indexed deliveryId, uint256 toBuyer, uint256 toProvider)
      - name: SeriesFactory
        address: "0x3333333333333333333333333333333333333333"
        handler: src/EventHandlers.ts
        events:
          - event: SeriesCreated(uint256 indexed seriesId, bytes32 indexed gpuClass, address token, uint64 windowStart, uint64 windowEnd, string symbol)
      - name: IndexOracle
        address: "0x2222222222222222222222222222222222222222"
        handler: src/EventHandlers.ts
        events:
          - event: PrintPublished(bytes32 indexed gpuClass, uint64 indexed dayKey, uint128 priceE8)
```

HyperIndex automatically resolves known EVM testnets including Monad Testnet (Chain ID 10143), routing event ingestion through HyperSync with automated RPC fallback.
