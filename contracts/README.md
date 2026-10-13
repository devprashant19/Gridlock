# Gridlock Smart Contracts Baseline

This document records the baseline inspection and verified test suite results for the Gridlock smart contracts workstream (`Task A`), completing Phase A1 of `implementation.md`.

## 1. Repository and Branch State

- **Repository Root**: `/home/puneetyadav1625/Metropolish/Gridlock`
- **Active Branch**: `feat/gridlock-contracts-cre`
- **Base Commit**: `99f4c6e60a14684125df2586d8f5764273c76379`
- **Working Tree**: Clean; all phase commits tracked on feature branch.
- **Reference Folder**: `/home/puneetyadav1625/Metropolish/metropolish` (strictly separated, non-git planning directory).

## 2. Toolchain and Dependency Baseline

- **Foundry CLI**: `forge 1.8.5` (commit `51a52c59cf`, built 2026-10-05).
- **Solidity Compiler Target**: `0.8.24` (via `solc_version = "0.8.24"` in `foundry.toml`).
- **Dependencies Installed**: `forge-std` (installed in `contracts/lib/forge-std`).
- **Reproducible Test Command**:
  ```bash
  export PATH="$HOME/.foundry/bin:$PATH"
  cd contracts && forge test -vvv
  ```

## 3. Contracts Source Audit (`contracts/src/`)

| Contract | Lines | Purpose | Baseline Findings & Identified Defects |
|---|---|---|---|
| `GridUSD.sol` | 56 | 6-decimal mock payment token with rate-limited `faucet()` | Fully verified (12/12 tests passing). Decimals, 1-hour cooldown rate limits, transfers, and allowances behave correctly. |
| `HourToken.sol` | 68 | 18-decimal compute receipt token | Fully verified (9/9 tests passing). Only configured escrow can mint and burn; unauthorized mint/burn reverts. |
| `IndexOracle.sol` | 71 | Ornn compute price oracle | Fully verified (12/12 tests passing). Owner configuration, fixed prices, forwarder prints, and `dayKey` (Unix seconds) behave correctly. Interface divergence in `onReport` signature documented in `INTERFACES_MATRIX.md`. |
| `SeriesFactory.sol` | 71 | Series creator deploying `HourToken` instances | Fully verified (7/7 tests passing). Creates series, deploys tokens, sequential IDs, permissionless policy. Parameter ordering difference documented in `INTERFACES_MATRIX.md`. |
| `DeliveryEscrow.sol` | 333 | FIFO matching, collateral custody, settlement | **Carried into Phase A2 & A3 for hardening:**<br>1. `mint()` does not verify provider registration.<br>2. `mint()` overwrites `bondPerHour[seriesId][msg.sender]` on subsequent batches.<br>3. `provision()` lacks deadline verification (`block.timestamp <= d.deadline`).<br>4. `_settle()` has inverted DEGRADED split (pays 30% to provider / 70% to buyer instead of 70% provider / 30% buyer).<br>5. `DOMAIN_SEPARATOR` uses name `"Gridlock Verifier"` instead of `"Gridlock"`.<br>6. `withdrawUnsold(seriesId, hours_)` signature deviates from `IDeliveryEscrow.withdrawUnsold(seriesId)`. |
| `Deploy.s.sol` | 60 | Deployment script in `contracts/script/` | Uses placeholder signer `0x5555...` and logs rather than exporting canonical deployment JSON. |

## 4. Test Suite Execution & Baseline Report

Execution Command:
```bash
export PATH="$HOME/.foundry/bin:$PATH"
cd contracts && forge test -vvv
```

Execution Results:
- `test/Sanity.t.sol`: 4 passed, 0 failed
- `test/GridUSD.t.sol`: 12 passed, 0 failed
- `test/HourToken.t.sol`: 9 passed, 0 failed
- `test/IndexOracle.t.sol`: 12 passed, 0 failed
- `test/SeriesFactory.t.sol`: 7 passed, 0 failed

**Total Suites**: 5  
**Total Tests**: 44  
**Passed**: 44 (100%)  
**Failed**: 0  
**Skipped**: 0  

*Verification Note: No test relies on mock addresses or placeholder data from `deployments/testnet.json`. All test suites instantiate deterministic isolated environments via `GridlockTestBase`.*
