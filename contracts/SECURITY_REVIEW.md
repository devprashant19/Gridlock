# Gridlock Smart Contract Security Review

## 1. Executive Summary & Audit Scope
This security audit reviews the production smart contract suite in `contracts/src/` implemented on branch `feat/gridlock-contracts-cre`:
- `GridUSD.sol` (Collateral settlement stablecoin)
- `HourToken.sol` (ERC-20 deliverable GPU hour claim tokens)
- `IndexOracle.sol` (Chainlink CRE-reported GPU pricing oracle)
- `SeriesFactory.sol` (Permissionless GPU series and deliverable token deployer)
- `DeliveryEscrow.sol` (Collateral bonding, FIFO queue, delivery lifecycle, EIP-712 verification)

---

## 2. Invariant & Category Analysis

### A. Access Control & Authorization
- **Status:** Verified Secure.
- **Audited Points:**
  - `HourToken.mint()` and `HourToken.burn()` strictly enforce `msg.sender == escrow`.
  - `DeliveryEscrow.provision()` strictly enforces `msg.sender == d.provider`.
  - `DeliveryEscrow.setVerifierSigner()` and `setForwarder()` strictly enforce `onlyOwner`.
  - `IndexOracle.pushPrint()` and `onReport()` strictly enforce `onlyOwnerOrForwarder` and `msg.sender == forwarder`.

### B. Reentrancy & Checks-Effects-Interactions
- **Status:** Verified Secure.
- **Audited Points:**
  - In `DeliveryEscrow.redeem()`, `HourToken.burn()` and internal storage allocations (`openHours`, `deliveries.push`) occur before any external transfer.
  - In `DeliveryEscrow._settle()`, `d.status = Status.Settled`, verdict, and metrics are written to storage *before* calling `gridUSD.transfer()`.
  - In `DeliveryEscrow.claimTimeout()`, `d.status = Status.TimedOut` is set *before* calling `gridUSD.transfer()`.
  - In `DeliveryEscrow.withdrawUnsold()`, `openHours` and `bondPerHour` are cleared *before* burning HourTokens and refunding GridUSD.

### C. Signature Replay & Malleability
- **Status:** Verified Secure.
- **Audited Points:**
  - EIP-712 Domain Separator includes `block.chainid` (cross-chain replay protection) and `address(this)` (cross-deployment replay protection).
  - Verdict struct hash binds `deliveryId`, `verdict`, `tflopsE2`, and `resultRoot`.
  - `_settle` strictly requires `d.status == Status.Provisioned`. A second settlement attempt with the same signature reverts because the delivery is already `Status.Settled`.
  - Signature `v` parameter is checked for standard bounds (`27` or `28`).

### D. Collateral Solvency & Accounting Precision
- **Status:** Verified Secure.
- **Audited Points:**
  - **Multi-Batch Weighted Average:** When providers mint across multiple price prints, `bondPerHour` preserves the weighted average collateral rate, preventing collateral under-allocation.
  - **Unsold Capacity Isolation:** `withdrawUnsold()` only releases bonds corresponding to remaining `openHours`, protecting active deliveries.
  - **Conservation of Collateral:** For all settlement paths (PASS 100/0, DEGRADED 70/30, FAIL 0/100, and Timeouts), `toBuyer + toProvider == d.bondAmount` down to 1 wei. No collateral is stranded in escrow.

---

## 3. Findings & Remediations Matrix

| ID | Component | Title | Severity | Impact | Resolution | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | `DeliveryEscrow` | Missing Provider Registration Check in `mint()` | High | Unregistered providers could mint compute tokens without identity verification. | Added `require(providers[msg.sender].registered, "Provider not registered")`. | **Resolved** |
| **SEC-02** | `DeliveryEscrow` | `bondPerHour` Overwritten in Multi-Batch Mints | High | Providers minting at lower prices could dilute historical bond collateral backing earlier hours. | Implemented weighted-average collateral rate formula across batches. | **Resolved** |
| **SEC-03** | `DeliveryEscrow` | Inverted DEGRADED Payout Split | Medium | Contract paid 30% provider / 70% buyer instead of specification's 70% provider / 30% buyer. | Corrected `toProvider = (d.bondAmount * 70) / 100; toBuyer = d.bondAmount - toProvider;`. | **Resolved** |
| **SEC-04** | `DeliveryEscrow` | Missing Provisioning Deadline Boundary | High | Provider could provision after buyer timeout or 2-hour window elapsed. | Added `require(block.timestamp <= d.deadline, "Provisioning deadline passed")`. | **Resolved** |
| **SEC-05** | `DeliveryEscrow` | Unsafe Signer Defaults & Zero-Address Constructors | Medium | Deployment could default to zero address or arbitrary signer fallback. | Enforced `require(_verifierSigner != address(0))` in constructor, setter, and deployment script. | **Resolved** |
| **SEC-06** | `IndexOracle` | Time Key Semantic Normalization | Low | `dayKey` represents Unix seconds; consumers must ensure consistent timestamp keys. | Documented time-key semantics and verified forwarder timestamp validation in tests. | **Accepted** |
