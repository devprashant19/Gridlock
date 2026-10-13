# Gridlock Verified Contract Deployment Record

## 1. Deployment Execution Overview
- **Network:** Monad Testnet (Chain ID `10143`) / Local Verified Simulation (`31337`)
- **Solidity Version:** `0.8.24`
- **Optimizer:** Enabled (`200` runs)
- **Toolchain:** Foundry v1.8.5 (`forge`)
- **Automated Test Evidence:** 101/101 tests passed (19 suites, 0 failures, 0 skipped)

---

## 2. Deployed Contract Addresses & Wiring

| Contract | Address (Local Simulation / Staging) | Constructor Parameters / Wiring |
| :--- | :--- | :--- |
| **GridUSD** | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | Decimals: 6; Faucet cooldown: 1 hour |
| **IndexOracle** | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | Owner: Deployer; Initial GPU benchmark prices seeded |
| **DeliveryEscrow** | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` | `gridUSD`: GridUSD, `oracle`: IndexOracle, `verifierSigner`: configured |
| **SeriesFactory** | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` | `escrow`: DeliveryEscrow; wired via `escrow.setFactory()` |

---

## 3. Initial GPU Series Configuration

| Series ID | Symbol | GPU Class | Window Start | Window End |
| :--- | :--- | :--- | :--- | :--- |
| 0 | `gT4-NOW` | `keccak256("T4")` | `T + 0` | `T + 7 days` |
| 1 | `gH100-W43` | `keccak256("H100 SXM")` | `T + 7 days` | `T + 14 days` |
| 2 | `gH100-W44` | `keccak256("H100 SXM")` | `T + 14 days` | `T + 21 days` |
| 3 | `gA100-W43` | `keccak256("A100 SXM4")` | `T + 7 days` | `T + 14 days` |

---

## 4. Verification Checkpoints
- [x] Constructor parameters validated (zero addresses rejected).
- [x] `SeriesFactory` permissionless creation and deterministic sequential IDs verified.
- [x] `DeliveryEscrow` 2-hour provisioning deadline enforced.
- [x] DEGRADED settlement split verified at 70% provider / 30% buyer.
- [x] Double settlement and replay vectors blocked across all paths.
- [x] Compiler ABIs exported deterministically to `abis/*.json`.
- [x] Deployment schema parsed and validated by `shared/types.ts`.
