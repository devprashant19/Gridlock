# Gridlock Smart Contracts Baseline

This document records the baseline inspection and verified repository state for the Gridlock smart contracts workstream (`Task A`), as required by Step 1 of `implementation.md`.

## 1. Repository and Branch State

- **Repository Root**: `/home/puneetyadav1625/Metropolish/Gridlock`
- **Active Branch**: `feat/gridlock-contracts-cre`
- **Base Commit**: `99f4c6e60a14684125df2586d8f5764273c76379` (`feat(stream-c): initialize verifier scaffold, metamask agent skill, and submission assets`)
- **Working Tree**: Clean at branch creation; no pre-existing uncommitted changes were overwritten.
- **Reference Folder**: `/home/puneetyadav1625/Metropolish/metropolish` (strictly separated, non-git planning directory).

## 2. Toolchain and Dependency Baseline

- **Solidity Version**: `^0.8.24` specified in `foundry.toml` and source files.
- **Foundry (`forge`)**: Not found in PATH at initial checkout. Required for compilation and automated testing.
- **Dependencies (`lib/`)**: No libraries installed (`lib/` directory is empty/missing; `forge-std` is needed for `Deploy.s.sol` and test suite).
- **Node.js / npm**: `v22.13.1` / `10.9.2` available in user environment.

## 3. Contracts Source Audit (`contracts/src/`)

| Contract | Lines | Purpose | Baseline Findings & Identified Defects |
|---|---|---|---|
| `GridUSD.sol` | 56 | 6-decimal mock payment token with rate-limited `faucet()` | Standalone ERC-20 implementation. Aligns with basic transfer/allowance semantics. |
| `HourToken.sol` | 68 | 18-decimal compute receipt token | Restricted mint/burn to immutable `escrow` address. |
| `IndexOracle.sol` | 71 | Ornn compute price oracle | `onReport(bytes calldata report)` has 1 parameter instead of `(bytes calldata metadata, bytes calldata report)` specified in `shared/INTERFACES.md`. |
| `SeriesFactory.sol` | 71 | Series creator deploying `HourToken` instances | Stores `SeriesInfo`, tracks active delivery window. Permissionless series creation. |
| `DeliveryEscrow.sol` | 333 | FIFO matching, collateral custody, settlement | **Critical Defects:**<br>1. `mint()` does not check if `providers[msg.sender].registered` is true.<br>2. `mint()` overwrites `bondPerHour[seriesId][msg.sender]`, corrupting multi-batch collateral accounting.<br>3. `provision()` lacks deadline verification (`block.timestamp <= d.deadline`).<br>4. `_settle()` has inverted DEGRADED split (pays 30% to provider / 70% to buyer instead of 70% provider / 30% buyer).<br>5. `DOMAIN_SEPARATOR` uses name `"Gridlock Verifier"` instead of `"Gridlock"`.<br>6. `withdrawUnsold(seriesId, hours_)` signature deviates from `IDeliveryEscrow.withdrawUnsold(seriesId)`. |
| `Deploy.s.sol` | 60 | Deployment script in `contracts/script/` | Imports `forge-std/Script.sol` which is missing. Logs addresses but does not output `deployments/testnet.json` or exported ABIs. Uses default placeholder `verifierSigner` (`0x5555...`). |

## 4. Shared Interfaces and Deployments Audit

- `shared/INTERFACES.md`: Defines canonical signatures, network constants (Monad Testnet `10143`), price precision (`1e8`), and EIP-712 typed data structure.
- `deployments/testnet.json`: Contains placeholder addresses (`0x1111...` through `0x6666...`) and expired series windows from October 2024 (`1728864000`–`1730678400`). Schema differs from `shared/types.ts`.
- `abis/`: Contains 5 JSON ABI files that must be regenerated from actual build outputs.
