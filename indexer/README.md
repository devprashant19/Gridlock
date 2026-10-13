# Gridlock Envio Indexer (Workstream 05)

Real-time blockchain indexer for Gridlock GPU forwards on Monad Testnet (`10143`), built with [Envio HyperIndex V3](https://docs.envio.dev).

## Overview

The Gridlock Envio Indexer ingests on-chain events emitted by Gridlock smart contracts (`DeliveryEscrow`, `SeriesFactory`, `IndexOracle`) and Kuru order-book `Trade` events on Monad Testnet. It exposes an entity-relational GraphQL API consumed by the Gridlock frontend web application, trading bots, and telemetry dashboards.

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
│   ├── EventHandlers.ts      # HyperIndex event handler implementation
│   ├── markets.ts            # Kuru market address mapping
│   └── diagnostics.ts        # Self-diagnostic utility
├── test/                     # Unit and lifecycle integration tests using createTestIndexer
│   └── fixtures/             # Deterministic event fixtures
├── queries/                  # Standard frontend GraphQL queries (leaderboard, forward curve, etc.)
├── envio-env.d.ts            # Type reference linking .envio/types.d.ts into the envio module
├── tsconfig.json             # TypeScript configuration
└── package.json              # Scripts and dependencies
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Sync Contract Addresses (Optional after Stream A deploys)
```bash
npm run sync
```

### 3. Generate Types
```bash
npm run codegen
```

### 4. Run Tests
```bash
npm test
```

### 5. Run Local Indexer
```bash
npm run dev
```

> Note: Local development connects to Monad Testnet HyperSync. Set `ENVIO_API_TOKEN=...` in `indexer/.env` if rate-limited.

## Key Entities Indexed

1. **`Provider`**: Collateralized GPU provider reputation, hours delivered, passes, degradations, failures, timeouts, slashed collateral, and earned totals.
2. **`Series`**: GPU forward contract series (`gT4-NOW`, `gH100-W43`, etc.), open hour capacity, settlement windows, and last Kuru trade price.
3. **`Delivery`**: Complete delivery lifecycle states (`REQUESTED`, `PROVISIONED`, `SETTLED`, `TIMEOUT`), cryptographic public keys, benchmarks, and verdicts.
4. **`GpuClass`**: Spot GPU index benchmark state by class (`latestPriceE8`, `latestDayKey`).
5. **`IndexPrint`**: Spot GPU index prices published by the Ornn oracle (`gpuClass`, `dayKey`, `priceE8`).
6. **`Trade`**: Orderbook executions on Monad.

## Available GraphQL Queries

Predefined queries in the `queries/` directory and `web/lib/envio.ts`:
- `queries/leaderboard.graphql`: Provider rankings by fewest failures, most passes, and hours delivered.
- `queries/series.graphql`: GPU forward series and open hour capacities.
- `queries/deliveries.graphql`: Complete delivery lifecycle and buyer/provider filters.
- `queries/settlements.graphql`: Terminal outcomes, benchmark TFLOPS, and bond payouts.
- `queries/forward_curve.graphql`: Daily oracle index prices by GPU class and series market prices.
- `queries/pagination.graphql`: Pagination templates.

## Envio Cloud Deployment

1. Connect the repository to [Envio Cloud](https://envio.dev).
2. Set root directory to `indexer` and config file to `config.yaml`.
3. Set deployment branch to `feat/envio-indexer` (or `main`).
4. Set `NEXT_PUBLIC_ENVIO_GRAPHQL` in the frontend environment to the resulting GraphQL endpoint.
