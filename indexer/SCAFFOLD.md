# Envio Project Scaffold Structure & Verification

**Date:** 2026-10-14  
**Workstream:** 05 — Envio Indexer  
**Branch:** `feat/envio-indexer`  

## 1. Scaffold Components Inventory

| File Path | Role | State | Action Required |
|---|---|---|---|
| `config.yaml` | Indexer configuration (chains, contracts, events) | Valid YAML with placeholder addresses | Update with verified ABI references, testnet addresses, and Monad RPC/HyperSync |
| `schema.graphql` | GraphQL entity schema | Defines 5 core entities (`Provider`, `Series`, `Delivery`, `IndexPrint`, `Trade`) | Valid schema; preserve entities and refine relations for HyperIndex V3 |
| `src/EventHandlers.ts` | Event handling logic | Placeholder stub functions | Refactor to `indexer.onEvent(...)` HyperIndex V3 pattern with idempotent entity updates |
| `envio-env.d.ts` | TypeScript environment typing | Generated | Preserved; maintained via `codegen` |
| `.envio/types.d.ts` | HyperIndex generated types | Generated | Auto-updated on schema/config changes |
| `package.json` | Dependency manifest | Configured with `envio: ^3.14.0`, `vitest` | Ready |

## 2. Reusability Assessment

- **`schema.graphql`**: The existing entity definitions align with `metropolish/05-envio.md` and can be reused as the core data model.
- **`config.yaml`**: The event definitions align with `IDeliveryEscrow`, `ISeriesFactory`, and `IIndexOracle`. Needs contract ABI linkage and contract addresses from `deployments/testnet.json`.
- **`src/EventHandlers.ts`**: The handler signatures will be replaced with clean HyperIndex V3 `indexer.onEvent` calls.
