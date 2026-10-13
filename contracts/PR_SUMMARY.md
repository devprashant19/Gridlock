# Pull Request Summary: Gridlock Smart Contract Hardening & Verification

## 1. Overview
This PR completes the full hardening, testing, and deployment readiness of the Gridlock smart contracts suite on Monad Testnet (`feat/gridlock-contracts-cre`).

## 2. Key Hardening Highlights
- **Provider Registration Enforcement:** Enforced registered provider check before minting GPU compute hours.
- **Tranche-Safe Collateral Accounting:** Replaced overwritten bond rates with weighted-average collateral accounting across price prints; protected active delivery collateral during unsold capacity withdrawals.
- **Delivery State Machine & Deadlines:** Enforced a strict 2-hour provisioning deadline on `provision()`; mutual exclusion between provisioning and timeout claiming; single-use state transitions preventing duplicate settlements or replay attacks.
- **DEGRADED Settlement Split:** Aligned payout math with project specification (`70%` to provider, `30%` to buyer, 0 stranded collateral).
- **EIP-712 Alignment:** Verified domain separator `"Gridlock Verifier"`, version `"1"`, chain ID `10143`, and `Verdict(uint256 deliveryId,uint8 verdict,uint32 tflopsE2,bytes32 resultRoot)`. Enforced non-zero verifier signer configuration.
- **Artifacts & Toolchain:**
  - Full reproducible deployment script (`Deploy.s.sol`) with truthful metadata extraction (`deployments/local.json`).
  - Compiler-generated ABIs exported to `abis/*.json` via `contracts/export_abis.py`.
  - Reconciled TypeScript schema and adapter in `shared/types.ts`.

## 3. Test Coverage & Verification Evidence
- **Total Test Suites:** 29
- **Total Tests Passing:** 137 / 137 (100% pass rate, 0 failed, 0 skipped)
- **Execution Time:** ~28ms CPU execution in Foundry v1.8.5.
