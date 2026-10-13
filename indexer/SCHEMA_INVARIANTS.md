# Schema & Entity Invariants Validation Report

**Date:** 2026-10-14  
**Workstream:** 05 — Envio Indexer  
**Branch:** `feat/envio-indexer`  

## 1. Verified Schema Invariants

1. **Identifier Uniqueness & Case Normalization:**
   - Provider addresses normalized to lowercase hexadecimal strings.
   - Series IDs mapped directly to stringified `uint256` series identifiers.
   - Delivery IDs mapped directly to stringified `uint256` delivery identifiers.
   - Oracle prints indexed under composite stable key `${gpuClass}-${dayKey}`.

2. **Numeric Precision:**
   - All accounting fields (`hours`, `minted`, `hoursDelivered`, `slashedTotal`, `priceE8`, `toBuyer`, `toProvider`) maintain raw Solidity integer precision (`BigInt` / `bigint`).
   - No floating-point loss or premature division inside event handlers.

3. **Lifecycle Integrity & Non-regression:**
   - Single terminal state guarantees: once a delivery is `SETTLED` or `TIMEOUT`, replaying identical logs cannot double-credit provider delivered hours, passes, timeouts, or slashed funds.
   - Provisioning cannot revert settled deliveries.

4. **Foreign Key Resilience:**
   - Delivery entities safely link `series_id` and `provider_id`.
   - Incomplete histories (e.g. indexing starting after series creation) synthesize placeholder series or provider records to avoid dangling entity references or GraphQL query crashes.

## 2. Test Execution Summary

- `codegen`: 0 errors
- `tsc --noEmit`: 0 errors
- `vitest`: 16 test suites, 22/22 unit and regression tests passing.
