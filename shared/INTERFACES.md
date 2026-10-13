# Shared Interfaces & Specifications

> **Notice:** This document is the single source of truth between workstreams (A, B, C).
> Do not modify existing interfaces without notifying the team in the group chat.

---

## 1. Smart Contract Interfaces

### 1.1 `GridUSD` (ERC20)
- **Decimals**: 6
- **Symbol**: `gUSD`
- **Functions**:
  ```solidity
  function faucet() external; // Mints 1,000 * 1e6 gUSD to msg.sender (max once per hour per address)
  function decimals() external pure returns (uint8); // Returns 6
  function balanceOf(address account) external view returns (uint256);
  function transfer(address to, uint256 amount) external returns (bool);
  function approve(address spender, uint256 amount) external returns (bool);
  function transferFrom(address from, address to, uint256 amount) external returns (bool);
  ```

### 1.2 `HourToken` (ERC20)
- **Decimals**: 18 (`1e18` = 1 GPU-hour)
- **Symbol**: e.g., `gT4-NOW`, `gH100-W43`, `gA100-W43`
- **Functions**:
  ```solidity
  function escrow() external view returns (address);
  function mint(address to, uint256 amount) external; // Only escrow
  function burn(address from, uint256 amount) external; // Only escrow
  ```

### 1.3 `IndexOracle`
- **Owner**: Deployer
- **Forwarder**: Chainlink CRE Forwarder address
- **Functions**:
  ```solidity
  function setForwarder(address _forwarder) external; // onlyOwner
  function setFixedPrice(string calldata className, uint128 priceE8) external; // onlyOwner (e.g. "T4", 35_000_000 for $0.35/hr)
  function pushPrint(bytes32 gpuClass, uint64 dayKey, uint128 priceE8) external; // onlyOwner or forwarder
  function onReport(bytes calldata report) external; // only forwarder: decodes (bytes32 gpuClass, uint64 dayKey, uint128 priceE8)
  function latest(bytes32 gpuClass) external view returns (uint128 priceE8, uint64 dayKey);
  ```
- **Events**:
  ```solidity
  event PrintPublished(bytes32 indexed gpuClass, uint64 indexed dayKey, uint128 priceE8);
  ```

### 1.4 `SeriesFactory`
- **Functions**:
  ```solidity
  struct SeriesInfo {
      bytes32 gpuClass;
      address token;
      uint64 windowStart;
      uint64 windowEnd;
      string symbol;
  }

  function createSeries(
      bytes32 gpuClass,
      string calldata symbol,
      uint64 windowStart,
      uint64 windowEnd
  ) external returns (uint256 seriesId, address token);

  function series(uint256 seriesId) external view returns (
      bytes32 gpuClass,
      address token,
      uint64 windowStart,
      uint64 windowEnd,
      string memory symbol
  );
  function seriesCount() external view returns (uint256);
  ```
- **Events**:
  ```solidity
  event SeriesCreated(
      uint256 indexed seriesId,
      bytes32 indexed gpuClass,
      address token,
      uint64 windowStart,
      uint64 windowEnd,
      string symbol
  );
  ```

### 1.5 `DeliveryEscrow`
- **Bond calculation**:
  `bond (6 decimals gUSD) = hours * priceE8 * 120 / 100 / 100` (priceE8 divided by 100 converts to 1e6 decimals).
- **Enums**:
  ```solidity
  enum Status { None, Requested, Provisioned, Settled, TimedOut }
  enum Verdict { None, Pass, Degraded, Fail }
  ```
- **Functions**:
  ```solidity
  function registerProvider(string calldata name) external;

  function mint(uint256 seriesId, uint256 hours_) external returns (uint256 bondAmount);

  function redeem(
      uint256 seriesId,
      uint256 hours_,
      bytes32 buyerEncPubKey
  ) external returns (uint256 deliveryId);

  function provision(
      uint256 deliveryId,
      bytes calldata ciphertext
  ) external;

  function settleWithSig(
      uint256 deliveryId,
      uint8 verdict,          // 1: Pass, 2: Degraded, 3: Fail
      uint32 tflopsE2,        // e.g. 812 = 8.12 TFLOPS
      bytes32 resultRoot,     // Committed Merkle root
      bytes calldata signature
  ) external;

  function onReport(bytes calldata report) external; // only forwarder (Chainlink CRE)

  function claimTimeout(uint256 deliveryId) external;

  function withdrawUnsold(uint256 seriesId, uint256 hours_) external;
  ```
- **Events**:
  ```solidity
  event ProviderRegistered(address indexed provider, string name);
  event Minted(uint256 indexed seriesId, address indexed provider, uint256 hours_, uint256 bond);
  event DeliveryRequested(
      uint256 indexed deliveryId,
      uint256 indexed seriesId,
      address indexed buyer,
      address provider,
      uint256 hours_,
      bytes32 buyerEncPubKey,
      uint64 deadline
  );
  event Provisioned(uint256 indexed deliveryId, bytes ciphertext);
  event Settled(
      uint256 indexed deliveryId,
      uint8 verdict,
      uint32 tflopsE2,
      uint256 toBuyer,
      uint256 toProvider
  );
  event TimeoutClaimed(uint256 indexed deliveryId, uint256 toBuyer, uint256 toProvider);
  ```

- **Settlement Distribution**:
  - `Verdict.Pass` (1): Provider receives 100% of bond + payment.
  - `Verdict.Degraded` (2): Provider receives 30%, Buyer receives 70% refund.
  - `Verdict.Fail` (3): Buyer receives 100% refund.

---

## 2. EIP-712 Typed Data Specification

Verifier signatures are validated against EIP-712 typed structured data:

### Domain Separator
```json
{
  "name": "Gridlock Verifier",
  "version": "1",
  "chainId": 10143,
  "verifyingContract": "<DeliveryEscrow address>"
}
```

### Type Definition
```json
{
  "Verdict": [
    { "name": "deliveryId", "type": "uint256" },
    { "name": "verdict", "type": "uint8" },
    { "name": "tflopsE2", "type": "uint32" },
    { "name": "resultRoot", "type": "bytes32" }
  ]
}
```

---

## 3. Verifier REST API

Host: `http://localhost:8000` (or production URL on Render/Railway).

### 3.1 `POST /challenge`
- **Request**:
  ```json
  {
    "deliveryId": 1,
    "gpuClass": "T4"
  }
  ```
- **Response**:
  ```json
  {
    "deliveryId": 1,
    "seed": 84920491823,
    "n": 4096,
    "steps": 4,
    "deadlineMs": 20000
  }
  ```

### 3.2 `POST /commit`
- **Request**:
  ```json
  {
    "deliveryId": 1,
    "root": "0x4f8b...",
    "tflops": 8.15,
    "sm": 40,
    "device": "Tesla T4"
  }
  ```
- **Response**:
  ```json
  {
    "deliveryId": 1,
    "sampleIndices": [14, 289, 1022, 1845, 2400, 3102, 3890, 4010]
  }
  ```

### 3.3 `POST /reveal`
- **Request**:
  ```json
  {
    "deliveryId": 1,
    "rows": [
      {
        "index": 14,
        "data": "0x..." // hex bytes of row C[14]
      }
    ],
    "proofs": [
      ["0x...", "0x..."]
    ]
  }
  ```
- **Response**:
  ```json
  {
    "deliveryId": 1,
    "verdict": 1,
    "verdictName": "PASS",
    "tflopsE2": 815,
    "resultRoot": "0x4f8b...",
    "signature": "0x..."
  }
  ```

### 3.4 `GET /verdict/{deliveryId}`
- **Response**:
  ```json
  {
    "deliveryId": 1,
    "verdict": 1,
    "verdictName": "PASS",
    "tflopsE2": 815,
    "resultRoot": "0x4f8b...",
    "signature": "0x...",
    "timestamp": 1728864000
  }
  ```

---

## 4. Credential Delivery Encryption (Mera PRF + X25519)

### 4.1 Key Derivation
- **Buyer**:
  - Passkey PRF output (`prfOutput` 32 bytes)
  - `privateKey = HKDF-SHA256(ikm = prfOutput, salt = "gridlock", info = "gridlock/delivery-x25519/v1", length = 32)`
  - `buyerEncPubKey = X25519.getPublicKey(privateKey)` (bytes32)

### 4.2 Provider Encryption
- Provider generates ephemeral X25519 keypair: `(ephemeralPriv, ephemeralPub)`.
- `sharedSecret = X25519(ephemeralPriv, buyerEncPubKey)`.
- `symmetricKey = HKDF-SHA256(ikm = sharedSecret, salt = "gridlock-payload", info = "gridlock/xchacha20poly1305/v1", length = 32)`.
- Nonce: 24 random bytes.
- Plaintext JSON:
  ```json
  {
    "host": "192.0.2.1",
    "port": 22,
    "username": "root",
    "authType": "ssh-key",
    "keyOrPassword": "-----BEGIN OPENSSH PRIVATE KEY-----\n...",
    "gpuCount": 1,
    "gpuClass": "T4"
  }
  ```
- Encrypted using XChaCha20-Poly1305.
- Onchain `ciphertext` wire payload:
  `ephemeralPub (32 bytes) || nonce (24 bytes) || encryptedDataWithTag`

### 4.3 Buyer Decryption
- Read `ephemeralPub` (first 32 bytes) and `nonce` (next 24 bytes).
- `sharedSecret = X25519(buyerPriv, ephemeralPub)`.
- Re-derive `symmetricKey`.
- Decrypt ciphertext and parse JSON.

---

## 5. Chainlink CRE Report Encodings

### 5.1 `index-feed` (EVM Write to IndexOracle)
- **Call**: `IndexOracle.onReport(bytes report)`
- **Encoding**:
  `abi.encode(bytes32 gpuClass, uint64 dayKey, uint128 priceE8)`
- `gpuClass = keccak256(bytes(symbol))` (e.g. `keccak256("H100 SXM")`)

### 5.2 `delivery-settler` (EVM Write to DeliveryEscrow)
- **Call**: `DeliveryEscrow.onReport(bytes report)`
- **Encoding**:
  `abi.encode(uint256 deliveryId, uint8 verdict, uint32 tflopsE2, bytes32 resultRoot)`

---

## 6. GPU Classes and Reference TFLOPS

Reference values for FP16 dense matrix compute:

| Symbol | Class Key (`bytes32`) | Rated FP16 TFLOPS | Pass Threshold (0.7x) | Fail Threshold (<0.5x) | Reference Hourly Price |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `T4` | `keccak256("T4")` | 8.1 | ≥ 5.67 TFLOPS | < 4.05 TFLOPS | $0.35 (`35_000_000`) |
| `A100 SXM4` | `keccak256("A100 SXM4")` | 312.0 | ≥ 218.4 TFLOPS | < 156.0 TFLOPS | $1.80 (`180_000_000`) |
| `H100 SXM` | `keccak256("H100 SXM")` | 989.0 | ≥ 692.3 TFLOPS | < 494.5 TFLOPS | $2.65 (`265_000_000`) |
| `H200` | `keccak256("H200")` | 989.0 | ≥ 692.3 TFLOPS | < 494.5 TFLOPS | $3.40 (`340_000_000`) |
| `B200` | `keccak256("B200")` | 2250.0 | ≥ 1575.0 TFLOPS | < 1125.0 TFLOPS | $4.80 (`480_000_000`) |
