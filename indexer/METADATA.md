# Envio Contract Metadata & ABI Inventory

**Date:** 2026-10-14  
**Workstream:** 05 — Envio Indexer  
**Branch:** `feat/envio-indexer`  

## 1. Network & Chain Metadata

- **Target Network:** Monad Testnet
- **Chain ID:** `10143`
- **RPC:** `https://testnet-rpc.monad.xyz`
- **HyperSync Endpoint:** `https://monad-testnet.hypersync.xyz`
- **Start Block:** `1234567` (from `deployments/testnet.json`)

## 2. Deployed Contracts & ABIs

| Contract Name | Address (`deployments/testnet.json`) | ABI Artifact | Key Events |
|---|---|---|---|
| `DeliveryEscrow` | `0x4444444444444444444444444444444444444444` | `abis/DeliveryEscrow.json` | `ProviderRegistered`, `Minted`, `DeliveryRequested`, `Provisioned`, `Settled`, `TimeoutClaimed` |
| `SeriesFactory` | `0x3333333333333333333333333333333333333333` | `abis/SeriesFactory.json` | `SeriesCreated` |
| `IndexOracle` | `0x2222222222222222222222222222222222222222` | `abis/IndexOracle.json` | `PrintPublished` |
| `GridUSD` | `0x1111111111111111111111111111111111111111` | `abis/GridUSD.json` | ERC-20 payment token |

## 3. GPU Series Configurations

1. **gT4-NOW** (Series ID 1): class `T4` (`0x21b2...`), token `0x7777...`, kuruMarket `0x8888...`
2. **gH100-W43** (Series ID 2): class `H100 SXM` (`0x6095...`), token `0x9999...`, kuruMarket `0xAAAA...`
3. **gH100-W44** (Series ID 3): class `H100 SXM` (`0x6095...`), token `0xBBBB...`, kuruMarket `0xCCCC...`
4. **gA100-W43** (Series ID 4): class `A100 SXM4` (`0x370c...`), token `0xDDDD...`, kuruMarket `0xEEEE...`
