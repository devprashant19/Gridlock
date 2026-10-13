# Chainlink Runtime Environment (CRE) Workflows — Gridlock Protocol

Decentralized Oracle Network (DON) workflows powering Gridlock on Monad Testnet:

1. **`index-feed/`**: Cron-triggered workflow fetching GPU spot rental prints from Ornn API, reaching multi-node median consensus, and publishing ABI-encoded price reports to `IndexOracle.sol`.
2. **`delivery-settler/`**: Event-triggered workflow responding to `DeliveryEscrow.Provisioned`, polling the automated hardware verifier, validating unanimous consensus, and submitting atomic settlement reports to `DeliveryEscrow.onReport`.

---

## 1. Network & Chain Configuration

* **Network**: Monad Testnet
* **Chain ID**: `10143`
* **Chainlink Chain Selector**: `2183018362218727504`
* **RPC URL**: `https://testnet-rpc.monad.xyz`
* **Forwarder Pattern**: Smart contracts authorize `ChainlinkForwarder` (`onlyForwarder` modifier), which validates the DON signature and calls `onReport(bytes)`.

---

## 2. Workflows Architecture

### 2.1 GPU Index Feed (`cre/index-feed`)
* **Trigger**: Hourly Cron schedule (`0 * * * *`).
* **Source**: Ornn Backend API (`https://ornn-backend-api-135941626504.us-central1.run.app/api/gpu/{symbol}/index-history`).
* **Approved Symbols**:
  * `H100 SXM` -> `gpuClass = keccak256("H100 SXM")`
  * `H200` -> `gpuClass = keccak256("H200")`
  * `B200` -> `gpuClass = keccak256("B200")`
  * `A100 SXM4` -> `gpuClass = keccak256("A100 SXM4")`
* **Consensus**: Multi-node DON median aggregation across independent node observations.
* **Price Representation**: `priceE8 = round(value * 1e8)` (e.g. `$2.92/hr` = `292_000_000`).
* **Day Key**: Unix epoch seconds of latest print timestamp (`dayKey = uint64(timestamp)`).
* **Onchain Report Encoding**:
  ```solidity
  abi.encode(bytes32 gpuClass, uint64 dayKey, uint128 priceE8)
  ```
  Decoded directly by `IndexOracle.onReport(bytes calldata report)`.

### 2.2 Delivery Settler (`cre/delivery-settler`)
* **Trigger**: EVM Log trigger on `DeliveryEscrow.Provisioned(uint256 indexed deliveryId, bytes ciphertext)`.
* **Execution**:
  1. Parses `deliveryId` from topic1.
  2. Polls `GET {VERIFIER_URL}/verdict/{deliveryId}` with exponential backoff and timeout handling.
  3. Verifies DON unanimous consensus across all nodes on `(verdict, tflopsE2, resultRoot)`.
  4. Encodes report:
     ```solidity
     abi.encode(uint256 deliveryId, uint8 verdict, uint32 tflopsE2, bytes32 resultRoot)
     ```
  5. Submits report to `DeliveryEscrow.onReport` via authorized forwarder.
* **Settlement Outcomes**:
  * `Verdict.Pass` (1): 100% bond + payment released to provider.
  * `Verdict.Degraded` (2): 30% to provider, 70% refund to buyer.
  * `Verdict.Fail` (3): 100% bond slashed, full refund to buyer.

---

## 3. Toolchain & Prerequisites

* **Node.js**: >= v22.0.0 (Native TypeScript type-stripping support).
* **CRE CLI**: >= v1.30.0 (v1.38.0 installed).
  ```powershell
  # Windows installation:
  irm https://app.chain.link/cre/install.ps1 | iex
  cre version
  ```
* **Ethers.js**: v6.17.0 for deterministic ABI encoding and verification.

---

## 4. Running Tests & Simulations

From the `cre/` directory:

### Run Complete Workflow Test Suite (33 Tests)
```bash
npm test
# Or directly:
node --experimental-strip-types tests/test_workflows.ts
```

### Simulate Index Feed (Live Ornn API Fetch)
```bash
npm run simulate:index-feed
# Or directly:
node --experimental-strip-types index-feed/simulate.ts
```

### Simulate Delivery Settler (EVM Trigger & Verifier Polling)
```bash
npm run simulate:delivery-settler
# Or directly:
node --experimental-strip-types delivery-settler/simulate.ts
```

### Official CRE CLI Simulation
*(Requires authenticating once with `cre login` or setting `CRE_API_KEY`)*
```bash
cre workflow simulate cre/index-feed --target monad-testnet
cre workflow simulate cre/delivery-settler --target monad-testnet
```

---

## 5. Security & Idempotency Considerations

1. **Anti-Sybil Consensus**: Settlements require strict unanimous agreement across DON nodes, eliminating single-server compromise risks.
2. **Forwarder Restriction**: `IndexOracle.sol` and `DeliveryEscrow.sol` enforce `msg.sender == forwarder`, preventing unauthorized state alterations.
3. **Idempotency**: Once settled, `DeliveryEscrow` marks `delivery.status = Status.Settled`, reverting any replay attempts on duplicate triggers.
4. **Bounds Checking**: Index prices are strictly validated against non-positive numbers, malformed timestamps, and unapproved symbol identifiers.

---

## 6. Chainlink CRE Bounty Submission Draft

* **Track**: Chainlink CRE "Best workflow" ($3,000)
* **Summary**: Gridlock uses Chainlink CRE to decentralize forward compute settlement on Monad. `index-feed` fetches live GPU rental index prices from Ornn, aggregates multi-node median prints, and writes price curves to `IndexOracle`. `delivery-settler` triggers on `DeliveryEscrow.Provisioned`, queries decentralized hardware verifiers, validates unanimous DON consensus on matrix proofs, and atomically settles or slashes delivery bonds onchain without relying on centralized custody.
