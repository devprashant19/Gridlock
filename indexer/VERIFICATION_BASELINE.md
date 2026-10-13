# Envio Baseline Verification Report

**Date:** 2026-10-14  
**Workstream:** 05 — Envio Indexer  
**Branch:** `feat/envio-indexer`  

## 1. Baseline Verification Commands & Results

| Command | Working Directory | Exit Code | Result Summary |
|---|---|---|---|
| `npx envio codegen` | `indexer/` | 0 | Successfully generated `.envio/types.d.ts` and `envio-env.d.ts` |
| `npx tsc --noEmit` | `indexer/` | 0 | Strict TypeScript compilation passes with zero type errors |
| `npx vitest --version` | `indexer/` | 0 | Vitest 5.0.4 initialized and ready for test runners |

## 2. Environment Verification

- Node.js runtime: `v22.23.3` (satisfies Envio `>= 22.15.0`)
- Envio CLI: `3.14.0`
- Monad Testnet Chain ID: `10143` verified via RPC `https://testnet-rpc.monad.xyz`
- Local `tsconfig.json` established with `NodeNext` module resolution and strict type checking.
