# EIP-712 Typed Data Cross-Language Audit & Compatibility

## 1. Domain Specification

Both Solidity (`DeliveryEscrow.sol`), Python Verifier API (`verifier/api/server.py`), and the shared specification (`shared/INTERFACES.md`) define the EIP-712 domain as follows:

| Field | Type | Solidity Value / Source | Python Verifier Value / Source | Specification (`shared/INTERFACES.md`) |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | `"Gridlock Verifier"` | `"Gridlock Verifier"` | `"Gridlock Verifier"` |
| `version` | `string` | `"1"` | `"1"` | `"1"` |
| `chainId` | `uint256` | `block.chainid` (e.g. 10143 Monad testnet) | `int(os.getenv("CHAIN_ID", 10143))` | `10143` |
| `verifyingContract` | `address` | `address(this)` (`DeliveryEscrow`) | `os.getenv("ESCROW_ADDRESS")` | `<DeliveryEscrow address>` |

### Domain TypeHash
```solidity
keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
```
Value: `0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f`

---

## 2. Primary Type: `Verdict`

### Type Definition
```
Verdict(uint256 deliveryId,uint8 verdict,uint32 tflopsE2,bytes32 resultRoot)
```

### TypeHash
```solidity
keccak256("Verdict(uint256 deliveryId,uint8 verdict,uint32 tflopsE2,bytes32 resultRoot)")
```
Value: `0x7a3038d179aa0b396eec5092a4073383a1523d532be930cfbf4eb118c7d5c7f8`

### Field Types and Ordering

| Field | Solidity Type | Python Type | ABI Encoding | Description |
| :--- | :--- | :--- | :--- | :--- |
| `deliveryId` | `uint256` | `int` (`uint256`) | 32 bytes (big endian) | Unique index in `deliveries` array |
| `verdict` | `uint8` | `int` (`uint8`) | 32 bytes (padded `uint8`) | 1 = Pass, 2 = Degraded, 3 = Fail |
| `tflopsE2` | `uint32` | `int` (`uint32`) | 32 bytes (padded `uint32`) | Compute speed * 100 (e.g. 31200 = 312.00 TFLOPS) |
| `resultRoot` | `bytes32` | `bytes` / hex (`bytes32`) | 32 bytes | Merkle root of verified benchmark matrix |

---

## 3. Compatibility Findings

1. **Domain Name Alignment:** The repository's `shared/INTERFACES.md`, `contracts/src/DeliveryEscrow.sol`, and `verifier/api/server.py` all agree on `"Gridlock Verifier"`.
2. **Signature Layout:** Standard 65-byte `(r, s, v)` format is decoded in Solidity via `assembly { r := ...; s := ...; v := ... }` and verified against `ecrecover`. Python uses `eth_account.messages.encode_typed_data` producing matching `(r, s, v)`.
3. **Replay Protection:**
   - EIP-712 binding to `block.chainid` prevents cross-chain replay.
   - Binding to `verifyingContract` prevents cross-deployment replay.
   - Single-use state transition in `_settle` (`require(d.status == Status.Provisioned)`) prevents same-contract replay.
