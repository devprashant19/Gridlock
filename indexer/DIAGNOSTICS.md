# Envio Operational Diagnostics & Troubleshooting Guide

**Date:** 2026-10-14  
**Workstream:** 05 — Envio Indexer  
**Branch:** `feat/envio-indexer`  

## 1. Common Operational Scenarios & Fixes

### A. Missing or Lagging Events (HyperSync / RPC Desync)
- **Symptom:** On-chain transaction succeeded, but GraphQL entity is not returned.
- **Diagnostic Step:**
  Check whether the transaction occurred on Monad Testnet (`chainId: 10143`) after `start_block` in `config.yaml`.
  If indexing from block 0, verify the indexer has synced to current head via:
  ```bash
  curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' https://testnet-rpc.monad.xyz
  ```
- **Remedy:** Ensure `start_block` is set to or before the deployment block (`1234567`).

### B. Missing Parent Entity in Partial History
- **Symptom:** Delivery settlement arrived before `DeliveryRequested` was indexed (e.g., historical indexing starting midway).
- **Remedy:** The indexer features automated reconciliation: missing series or delivery records are synthesized with placeholder metadata (`symbol: "Series-<id>"`), preventing GraphQL crashes and preserving downstream queries.

### C. Reorg / Event Replay Idempotency
- **Symptom:** Node reorg triggers reprocessing of past `Settled` or `TimeoutClaimed` logs.
- **Remedy:** All terminal event handlers check `delivery.status === "SETTLED"` or `"TIMEOUT"` before modifying provider totals, preventing double-counting of passes, hours, or slashed collateral.
