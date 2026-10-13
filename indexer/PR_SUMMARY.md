# Pull Request: Gridlock Envio Indexer (Workstream 05)

## Overview

This pull request implements the production **Envio HyperIndex V3** blockchain indexer for the Gridlock GPU-hour forward marketplace on Monad Testnet (Chain ID `10143`).

The indexer consumes on-chain smart contract events from `DeliveryEscrow`, `SeriesFactory`, and `IndexOracle`, maintaining relational entities (`Provider`, `Series`, `Delivery`, `IndexPrint`, `Trade`) and exposing a GraphQL API that drives the frontend provider reputation leaderboard, delivery status tracking, and forward-curve pricing views.

---

## Key Features & Implementations

1. **HyperIndex V3 Engine Architecture:**
   - Multi-contract event ingestion for Monad Testnet (`10143`) via HyperSync (`https://monad-testnet.hypersync.xyz`) and RPC fallback (`https://testnet-rpc.monad.xyz`).
   - Clean, modular handler model using `indexer.onEvent(...)`.
   - Strong typing generated into `.envio/types.d.ts` and wired through `envio-env.d.ts`.

2. **Idempotency & Reorg Resilience:**
   - Idempotency guards on `Settled`, `TimeoutClaimed`, and `Provisioned` handlers to ensure node reorgs and duplicate event replays never double-count provider passes, hours delivered, or slashed collateral.
   - Auto-reconciliation for mid-stream historical indexing, synthesizing placeholder parent entities to prevent dangling references or GraphQL crashes.

3. **Accurate Accounting & Decimals:**
   - Strict preservation of Solidity integer precision (`BigInt` / `bigint`) for hours, bond amounts, and Oracle `priceE8`.
   - Exact mapping of PASS (verdict 1), DEGRADED (verdict 2), and FAIL (verdict 3) outcomes to provider reputation and bond distributions.

4. **GraphQL Queries & Frontend Integration:**
   - `queries/leaderboard.graphql`: Provider reputation ranked by fewest failures first and highest passes breaking ties.
   - `queries/series.graphql`: GPU forward series and open hour capacities.
   - `queries/deliveries.graphql`: Complete delivery lifecycle and buyer/provider filters.
   - `queries/settlements.graphql`: Terminal outcomes, benchmark TFLOPS, and bond payouts.
   - `queries/forward_curve.graphql`: Daily oracle index prices by GPU class.
   - `queries/pagination.graphql`: Limit/offset pagination and filter templates.
   - `web/lib/envio.ts`: Frontend client connected to `NEXT_PUBLIC_ENVIO_GRAPHQL` with fallback to local mock data.

---

## Verification & Test Suite Summary

- **Toolchain:** Node.js `v22.23.3`, Envio CLI `v3.14.0`, TypeScript `5.9.3`, Vitest `5.0.4`.
- **Codegen:** `npx envio codegen` passes with 0 warnings.
- **Type Check:** `npx tsc --noEmit` passes with 0 errors across indexer and frontend.
- **Unit & Integration Suite:** **34 / 34 tests passing** across 27 test files:
  - `test/core_handler.test.ts`
  - `test/provider_registration.test.ts`
  - `test/series_indexing.test.ts`
  - `test/mint_indexing.test.ts`
  - `test/delivery_request.test.ts`
  - `test/provisioning_indexing.test.ts`
  - `test/settlement_indexing.test.ts`
  - `test/idempotency.test.ts`
  - `test/provider_relationships.test.ts`
  - `test/series_token_entities.test.ts`
  - `test/delivery_lifecycle.test.ts`
  - `test/settlement_records.test.ts`
  - `test/price_history.test.ts`
  - `test/marketplace_relationships.test.ts`
  - `test/partial_history.test.ts`
  - `test/derived_statistics.test.ts`
  - `test/queries_leaderboard.test.ts`
  - `test/queries_series.test.ts`
  - `test/queries_deliveries.test.ts`
  - `test/queries_settlements.test.ts`
  - `test/queries_price_history.test.ts`
  - `test/queries_pagination.test.ts`
  - `test/queries_validation.test.ts`
  - `test/frontend_consistency.test.ts`
  - `test/full_lifecycle.test.ts`
  - `test/deployment_metadata.test.ts`
  - `test/graphql_validation.test.ts`

---

## Deployment & Hosting Instructions

1. Connect `puneetnith28/Gridlock` to [Envio Cloud](https://envio.dev).
2. Set root directory to `indexer` and config file to `config.yaml`.
3. Set deployment branch to `feat/envio-indexer` (or `main`).
4. Set `NEXT_PUBLIC_ENVIO_GRAPHQL` in the frontend hosting environment to the resulting GraphQL URL.
