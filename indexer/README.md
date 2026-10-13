# Gridlock Envio Indexer

Real-time blockchain indexer for Gridlock GPU forwards on Monad Testnet, built with [Envio HyperIndex V3](https://docs.envio.dev).

## Overview

The Gridlock Envio Indexer ingests on-chain events emitted by Gridlock smart contracts (`DeliveryEscrow`, `SeriesFactory`, `IndexOracle`) and provides an entity-relational GraphQL API consumed by the Gridlock frontend web application, trading bots, and telemetry dashboards.

## Prerequisites

- **Node.js:** `>= 22.15.0` (Node `v22.23.3` recommended)
- **Package Manager:** `npm` (v10+) or `pnpm` (v10+)
- **Envio CLI:** `v3.14.0` (HyperIndex engine)
- **Target Network:** Monad Testnet (Chain ID `10143`)
  - RPC: `https://testnet-rpc.monad.xyz`
  - HyperSync: `https://monad-testnet.hypersync.xyz`

## Repository Structure

```
indexer/
├── config.yaml               # Network, contract addresses, and event source declarations
├── schema.graphql            # GraphQL entity models (Provider, Series, Delivery, etc.)
├── src/
│   └── EventHandlers.ts      # HyperIndex event handler implementation
├── test/                     # Unit and lifecycle integration tests using createTestIndexer
├── queries/                  # Standard frontend GraphQL queries (leaderboard, forward curve)
├── envio-env.d.ts            # Type reference linking .envio/types.d.ts into the envio module
├── tsconfig.json             # TypeScript configuration
└── package.json              # Scripts and dependencies
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate Types
```bash
npm run codegen
```

### 3. Run Tests
```bash
npm test
```

### 4. Run Local Indexer
```bash
npm run dev
```

## Key Entities Indexed

1. **`Provider`**: Collateralized GPU provider reputation, hours delivered, passes, degradations, failures, timeouts, and slashed collateral totals.
2. **`Series`**: GPU forward contract series (`gT4-NOW`, `gH100-W43`, etc.), open hour capacity, and settlement windows.
3. **`Delivery`**: Complete delivery lifecycle states (`REQUESTED`, `PROVISIONED`, `SETTLED`, `TIMEOUT`), cryptographic public keys, and verdict outcomes.
4. **`IndexPrint`**: Spot GPU index prices published by the Ornn oracle (`gpuClass`, `dayKey`, `priceE8`).
5. **`Trade`**: Orderbook executions on Monad.
