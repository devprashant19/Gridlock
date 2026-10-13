# Envio Indexer Implementation Baseline Audit

**Date:** 2026-10-14  
**Branch:** `feat/envio-indexer`  
**Base Commit:** `99f4c6e60a14684125df2586d8f5764273c76379`  

## 1. Directory Structure & Files

The initial `indexer/` directory contains an early scaffold:
- `package.json`: Declares `gridlock-indexer` v0.1.0 with scripts (`codegen`, `dev`, `test`) and devDependencies (`envio: ^2.0.0`, `typescript: ^5.5.0`).
- `config.yaml`: Basic multi-contract configuration targeting Monad Testnet (`id: 10143`, `start_block: 0`). Defines events for `DeliveryEscrow`, `SeriesFactory`, and `IndexOracle`. Uses placeholder addresses (`0x4444...`, `0x3333...`, `0x2222...`).
- `schema.graphql`: Defines `@entity` models: `Provider`, `Series`, `Delivery`, `IndexPrint`, `Trade`.
- `src/EventHandlers.ts`: Placeholder handler functions (`handleSettled`, `handleMinted`, `handleDeliveryRequested`) that only emit `console.log` statements without actual entity mutations or Envio registration handlers (`DeliveryEscrow.Settled.handler(...)`).

## 2. Missing & Incomplete Components

- **Dependencies:** `node_modules` not installed yet; `envio` CLI version installed in global/system is v3.13.0, whereas `package.json` specified `^2.0.0`.
- **Generated Types:** No generated code (`generated/`) or TypeScript types exist yet.
- **Contract ABIs:** `config.yaml` does not yet point to the ABI json files located in `../abis/`.
- **Event Handlers:** Handlers are stubbed functions rather than Envio SDK v2/v3 contract event registrations (`<Contract>.<Event>.handler(...)`).
- **Tests & Fixtures:** No test suite, test framework (e.g. mocha/vitest/jest), or deterministic event fixtures exist.
- **Documentation:** No `README.md` or operational instructions existed prior to this audit.

## 3. Baseline Status Classification

| Component | Status | Notes |
|---|---|---|
| Package manifest | Scaffold | Missing lockfile, dependencies uninstalled |
| `config.yaml` | Partial scaffold | Needs actual ABI links, start blocks, and network config |
| `schema.graphql` | Scaffold | Solid base aligned with `metropolish/05-envio.md`, needs relation tuning |
| `src/EventHandlers.ts` | Stub | Needs real Envio handler API implementation |
| Tests | Missing | Needs unit, idempotency, and integration test suite |
| Generated artifacts | Missing | `codegen` must be executed |
| Operational docs | Missing | Will be established in Step 10 |
