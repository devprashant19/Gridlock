# Monad Testnet Deployment Prerequisites & Safety Checklist

## 1. Network & RPC Configuration
- **Target Network:** Monad Testnet
- **Chain ID:** `10143`
- **RPC URL:** `https://testnet-rpc.monad.xyz`
- **Block Explorer:** `https://testnet.monadexplorer.com`

Verify RPC reachability:
```bash
cast chain-id --rpc-url https://testnet-rpc.monad.xyz
# Expected output: 10143
```

---

## 2. Deployer Account Readiness
- Environment Variable: `DEPLOYER_PK` (in `.env`, never committed to git)
- Recommended Balance: `>= 0.5 MON` for contract creation and series initialization.

Verify deployer balance:
```bash
cast balance $(cast wallet address --private-key $DEPLOYER_PK) --rpc-url https://testnet-rpc.monad.xyz
```

---

## 3. Verifier Signer Configuration
- Environment Variable: `VERIFIER_SIGNER_ADDRESS` (or derived from `VERIFIER_PK`).
- Verify alignment with Verifier API (`GET /health`):
```bash
curl -s http://localhost:8000/health | jq .signer
```
- Must never use the zero address or fabricated defaults.

---

## 4. External Protocol Integrations

### Kuru DEX Router
- **Address:** `0x7EFbE105Ca7415dE98F96622173458ac1c054630`
- Verified on Monad testnet. Used for CLOB order books and forward compute markets.

### Chainlink CRE Forwarder
- Configured post-deployment via `escrow.setForwarder(<CRE_FORWARDER_ADDRESS>)` and `oracle.setForwarder(<CRE_FORWARDER_ADDRESS>)` once the Chainlink CRE workflow is published.

---

## 5. Bytecode Verification Protocol
Before binding any existing or deployed address:
```bash
# Verify address contains code (not EOA or empty slot)
cast code <CONTRACT_ADDRESS> --rpc-url https://testnet-rpc.monad.xyz
```

---

## 6. Execution Safety Gates
1. **Simulation Run (No Broadcast):**
   ```bash
   forge script script/Deploy.s.sol --rpc-url monad_testnet
   ```
2. **Review Output:** Inspect deployed contract addresses, initial oracle prints, and series windows.
3. **Broadcast Run (Requires explicit approval):**
   ```bash
   forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
   ```
4. **Metadata Generation:** Validate `deployments/testnet.json` with `python3 contracts/export_abis.py`.
