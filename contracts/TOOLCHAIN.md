# Foundry Toolchain & Dependency Requirements

This document records the toolchain configuration audit, library dependency status, and reproducible build commands for the Gridlock smart contracts, as required by Step 2 of `implementation.md`.

## 1. Current Toolchain Audit

- **Foundry CLI (`forge`)**: `NOT INSTALLED` (`forge: command not found`).
- **Foundry Cast CLI (`cast`)**: `NOT INSTALLED` (`cast: command not found`).
- **Solidity Compiler Target**: `0.8.24` (declared in `foundry.toml` via `solc_version = "0.8.24"`).
- **Optimizer Settings**: Enabled, 200 runs (`optimizer = true`, `optimizer_runs = 200`).
- **File System Permissions**: Read-write access configured for `../deployments` and `../abis`.
- **RPC Endpoints**: `monad_testnet = "https://testnet-rpc.monad.xyz"` (Chain ID `10143`).

## 2. Dependency Audit & Toolchain Gaps

- **Libraries (`contracts/lib/`)**: The `lib` directory is currently non-existent.
- **`forge-std`**: Missing. The deployment script `contracts/script/Deploy.s.sol` requires `forge-std/Script.sol`, and future test suites require `forge-std/Test.sol`.
- **OpenZeppelin Contracts**: Not currently imported in `contracts/src/` (all 5 contracts are currently standalone implementations), but referenced in `01-contracts.md`.
- **Remappings**: No `remappings.txt` exists. When `forge-std` is installed, remapping `forge-std/=lib/forge-std/src/` is required.

## 3. Toolchain Installation & Setup Prerequisites

To satisfy toolchain requirements when approved:

1. **Install Foundry**:
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   source ~/.bashrc
   foundryup
   ```

2. **Install `forge-std` Testing & Scripting Library**:
   ```bash
   cd contracts
   forge install foundry-rs/forge-std --no-git
   ```

3. **Verify Remappings**:
   Ensure `contracts/remappings.txt` contains:
   ```text
   forge-std/=lib/forge-std/src/
   ```

## 4. Reproducible Build & Verification Commands

Once `forge` is available:

- **Compile Contracts**:
  ```bash
  cd contracts && forge build
  ```
- **Run Contract Tests**:
  ```bash
  cd contracts && forge test -vvv
  ```
- **Format Code**:
  ```bash
  cd contracts && forge fmt --check
  ```
- **Inspect Bytecode / ABI**:
  ```bash
  cd contracts && forge inspect <ContractName> abi
  ```
