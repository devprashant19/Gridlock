# Provider Collateral Accounting Model

This document records the state transition audit, storage mapping, and failure analysis for provider registration, minting, and collateral custody in `DeliveryEscrow.sol`, as required by Step 11 of `implementation.md`.

---

## 1. Storage Layout & Accounting Entities

In `DeliveryEscrow.sol`:
- `providers`: `mapping(address => ProviderState)` where `ProviderState = { string name, bool registered }`. Tracks identity registration.
- `queue`: `mapping(uint256 => address[])`. FIFO array of providers with capacity in `seriesId`.
- `openHours`: `mapping(uint256 => mapping(address => uint256))`. Total unassigned GPU hours available for redemptions for a given provider in a series.
- `bondPerHour`: `mapping(uint256 => mapping(address => uint256))`. Collateral bond rate (6 decimals) backing 1 GPU hour for a provider in a series.
- `deliveries`: `Delivery[]`. Outstanding and settled deliveries, each holding allocated `bondAmount`.

---

## 2. State Transition Tracing

### Scenario 1: Single Mint Batch
1. **Initial State**:
   - Provider A registered. `openHours = 0`, `bondPerHour = 0`.
2. **Action**:
   - Provider A mints 10 hours at oracle price $1.00 (`100_000_000` e8).
   - Bond per hour: `(1 * 100_000_000 * 120) / 10000 = 1_200_000` gUSD (1.20 gUSD / hr, 120% bond).
   - Total bond pulled: `12_000_000` gUSD (12.00 gUSD).
   - HourToken minted: `10 * 1e18`.
3. **Resulting State**:
   - `queue[seriesId] = [Provider A]`
   - `openHours[seriesId][Provider A] = 10`
   - `bondPerHour[seriesId][Provider A] = 1_200_000`
   - Invariant holds: `openHours * bondPerHour == totalDepositedBond` ($12.00).

---

### Scenario 2: Multi-Batch Accounting Failure (Current Implementation)
1. **Step 1**: Provider A mints Batch 1 (10 hours at $1.00/hr):
   - Deposited bond: `12_000_000` gUSD ($12.00).
   - `openHours = 10`, `bondPerHour = 1_200_000`.
2. **Step 2**: Index price increases to $2.00/hr (`200_000_000` e8). Provider A mints Batch 2 (10 hours at $2.00/hr):
   - Deposited bond: `(10 * 200_000_000 * 120) / 10000 = 24_000_000` gUSD ($24.00).
   - Total collateral in contract for Provider A: `12 + 24 = 36_000_000` gUSD ($36.00).
   - `openHours` increments: `10 + 10 = 20`.
3. **Flaw**:
   - Current line 140 executes:
     ```solidity
     bondPerHour[seriesId][msg.sender] = bond / hours_; // evaluates to 2_400_000
     ```
   - Historical bond rate for Batch 1 is **overwritten** with `2_400_000`!
4. **Catastrophic Failure Modes**:
   - **Over-allocation on Redemption**:
     When Buyer redeems 10 hours, contract assigns:
     `deliveryBond = bondPerHour * 10 = 24_000_000` gUSD ($24.00).
     Remaining unassigned hours = 10.
   - **Solvency Drain on Withdrawal**:
     Provider calls `withdrawUnsold(10 hours)`:
     `refund = bondPerHour * 10 = 24_000_000` gUSD ($24.00).
     Total paid out: `$24.00 (delivery) + $24.00 (refund) = $48.00`.
     Actual deposit was only `$36.00`!
     **Excess `$12.00` is stolen from other providers' escrowed collateral.**
   - Conversely, if price drops from $2.00 to $1.00, `bondPerHour` is overwritten downward, stranding provider collateral.

---

## 3. Tranche-Safe Accounting Model Design

To guarantee exact conservation of collateral across arbitrary mint batches:
1. **Weighted Average Collateral Model**:
   When minting additional hours:
   ```solidity
   uint256 currentOpen = openHours[seriesId][msg.sender];
   uint256 currentBondPerHr = bondPerHour[seriesId][msg.sender];
   uint256 totalExistingBond = currentOpen * currentBondPerHr;
   uint256 totalNewBond = totalExistingBond + bond;
   uint256 totalHours = currentOpen + hours_;
   
   openHours[seriesId][msg.sender] = totalHours;
   bondPerHour[seriesId][msg.sender] = totalNewBond / totalHours;
   ```
2. **Conservation Invariant**:
   At all times:
   $$\sum \text{delivery.bondAmount} + \sum (\text{openHours} \times \text{bondPerHour}) \le \text{gridUSD.balanceOf}(\text{escrow})$$
   No withdrawal or redemption can ever claim more collateral than was actually deposited.
