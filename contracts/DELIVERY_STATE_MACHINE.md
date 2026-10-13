# Gridlock Delivery State Machine Specification

## 1. Overview
The `DeliveryEscrow` contract orchestrates the lifecycle of GPU compute hour deliveries between buyers (HourToken holders) and providers (GPU compute providers who staked GridUSD bond collateral).

## 2. State Enumeration

The delivery lifecycle is governed by the `Status` enum:
```solidity
enum Status {
    None,        // 0: Uninitialized delivery slot
    Requested,   // 1: Buyer redeemed HourTokens; provider assigned via FIFO; 2-hour provisioning window started
    Provisioned, // 2: Assigned provider posted encrypted credentials (ciphertext) within deadline
    Settled,     // 3: Verifier signature or Chainlink CRE forwarder report settled delivery (Pass, Degraded, Fail)
    TimedOut     // 4: Either provider failed to provision within 2h OR verifier failed to settle within hours + 1h
}
```

Settlement verdicts are governed by the `Verdict` enum:
```solidity
enum Verdict {
    None,     // 0: Unsettled
    Pass,     // 1: Compute verified >= target performance (100% bond returned to provider)
    Degraded, // 2: Compute verified degraded (70% bond to provider, 30% penalty refund to buyer)
    Fail      // 3: Compute verification failed (100% bond forfeited to buyer)
}
```

---

## 3. State Transition Matrix

| Current State | Trigger Function | Authorized Caller | Preconditions & Guards | Next State | Economic / Collateral Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **None** | `redeem(seriesId, hours, buyerEncPubKey)` | Any buyer (holding HourTokens) | • `hours > 0`<br>• Series window active: `windowStart <= block.timestamp <= windowEnd`<br>• Buyer has `>= hours * 1e18` HourTokens<br>• FIFO queue has provider with `openHours >= hours` | **Requested** | • `hours * 1e18` HourTokens atomically burned.<br>• `openHours[seriesId][p]` decremented.<br>• `bondAmount = bondPerHour * hours` locked in delivery.<br>• Deadline set: `uint64(block.timestamp + 2 hours)`. |
| **Requested** | `provision(deliveryId, ciphertext)` | Assigned `d.provider` | • `block.timestamp <= d.deadline`<br>• `d.status == Status.Requested`<br>• Valid ciphertext format | **Provisioned** | • `d.provisionedAt = block.timestamp`<br>• `d.ciphertext = ciphertext` stored onchain for buyer retrieval. |
| **Requested** | `claimTimeout(deliveryId)` | Anyone (permissionless, typically buyer) | • `block.timestamp > d.deadline`<br>• `d.status == Status.Requested` | **TimedOut** | • Provider failed to provision within 2 hours.<br>• 100% of `bondAmount` transferred to `d.buyer`. |
| **Provisioned** | `settleWithSig(...)` | Anyone (with valid EIP-712 verifier signature) | • `d.status == Status.Provisioned`<br>• Signer matches `verifierSigner`<br>• Verdict in `[Pass (1), Degraded (2), Fail (3)]` | **Settled** | • Payout based on verdict:<br>&nbsp;&nbsp;- **Pass (1)**: 100% bond to provider.<br>&nbsp;&nbsp;- **Degraded (2)**: 70% to provider, 30% to buyer.<br>&nbsp;&nbsp;- **Fail (3)**: 100% to buyer.<br>• Emits `Settled`. |
| **Provisioned** | `onReport(report)` | Authorized `forwarder` (Chainlink CRE) | • `d.status == Status.Provisioned`<br>• Caller == `forwarder`<br>• Verdict in `[Pass (1), Degraded (2), Fail (3)]` | **Settled** | • Same payout distribution as `settleWithSig`. |
| **Provisioned** | `claimTimeout(deliveryId)` | Anyone (permissionless, typically provider) | • `block.timestamp > d.provisionedAt + (d.hours * 1 hours) + 1 hours`<br>• `d.status == Status.Provisioned` | **TimedOut** | • Verifier failed to report within rental duration + 1h buffer.<br>• 100% of `bondAmount` released to `d.provider`. |
| **Settled** | Any mutation | Any | `d.status != Requested && d.status != Provisioned` | Terminal | Reverts with `"Not provisioned"` or `"Timeout condition not met"`. Terminal state. |
| **TimedOut** | Any mutation | Any | `d.status != Requested && d.status != Provisioned` | Terminal | Reverts. No duplicate payouts permitted. |

---

## 4. Reversion Boundaries & Invariants

1. **Deterministic Single-Payout Invariant:** A delivery can only transition once out of `Requested` or `Provisioned`. Once in `Settled` or `TimedOut`, all settlement or timeout claims revert.
2. **Mutual Exclusion Between Provision and Timeout:**
   - At `block.timestamp <= d.deadline`: `provision()` is permitted; `claimTimeout()` reverts.
   - At `block.timestamp > d.deadline`: `claimTimeout()` succeeds; `provision()` reverts.
3. **Atomic Collateral Conservation:**
   - Sum of transfers `toBuyer + toProvider == d.bondAmount` for all terminal transitions.
   - For `Degraded`: `toProvider = (d.bondAmount * 70) / 100; toBuyer = d.bondAmount - toProvider;` (ensuring zero residue).
