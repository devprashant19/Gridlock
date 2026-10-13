# Envio Toolchain Requirements & Configuration

**Date:** 2026-10-14  
**Workstream:** 05 — Envio Indexer  
**Branch:** `feat/envio-indexer`  

## 1. Verified Toolchain Environment

- **Node.js:** `v22.23.3` (installed via NVM; Envio v3.14.0 requires `>= 22.15.0`)
- **Package Manager:** `npm 10.9.9` / `pnpm 10.18.1`
- **Envio CLI:** `envio 3.14.0` (HyperIndex V3 engine)
- **TypeScript:** `v5.9.3`
- **Test Framework:** `vitest 5.0.4`

## 2. HyperIndex V3 Architecture & Conventions

- **Codegen Target:** `.envio/types.d.ts` wired through `envio-env.d.ts`.
- **SDK Imports:** Direct import from `"envio"` (e.g. `import { indexer, createTestIndexer } from "envio"`). The legacy `generated` module from V2 is superseded.
- **Handler Model:**
  - `indexer.onEvent({ contract: "<Contract>", event: "<Event>" }, async ({ event, context }) => { ... })`
  - In-memory database context via `context.<Entity>.set({...})` (synchronous, returns void).
  - Entity reads via `await context.<Entity>.get(id)` and `await context.<Entity>.getWhere({...})`.
- **Unit Testing Model:**
  - Replaces legacy `MockDb` with `createTestIndexer()`.
  - Simulate events via `await testIndexer.process({ chains: { 10143: { simulate: [ ... ] } } })`.
  - Query indexed state via `await testIndexer.<Entity>.get(id)`.

## 3. Supported CLI Commands

- `npx envio codegen`: Generates TypeScript bindings and runtime types from `config.yaml` and `schema.graphql`.
- `npx envio dev`: Launches local development indexing loop.
- `npx vitest run`: Executes the test suite against simulated blockchain events.
