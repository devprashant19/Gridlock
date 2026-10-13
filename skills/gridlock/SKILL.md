---
name: gridlock
description: Buy, redeem, and verify physically delivered GPU compute hours on Gridlock (Monad). Use when the agent needs GPU compute for model training or inference, wants to lock guaranteed future compute prices, or needs to cryptographically verify rented hardware.
---

# Gridlock Agent Compute Skill

Enables AI agents to query forward compute markets, purchase GPU hours via Kuru order book, redeem hours for physical machine credentials, and verify GPU integrity inside rented pods.

## Security Rule
This skill **never** touches or requests private keys. It computes and outputs standard `{to, data, value}` Ethereum transactions that must be signed via `@metamask/agent-wallet` (`mm`), respecting Guard Mode limits and human approval policies.

## Commands

### 1. Quote Forward Prices
```bash
gridlock quote --class "H100 SXM"
```
Prints available forward series, delivery windows, and best asks from the order book.

### 2. Purchase Compute Hours
```bash
gridlock buy --series gH100-W43 --hours 4 --max-price 2.90
```
Generates the unsigned Kuru transaction `{to, data, value}` for the agent to submit with `mm`.

### 3. Redeem for Physical Pod
```bash
gridlock redeem --series gH100-W43 --hours 4
```
Generates `DeliveryEscrow.redeem` transaction with the agent's derived encryption public key.

### 4. In-Pod Hardware Verification
```bash
gridlock verify --delivery <id> --class "H100 SXM"
```
Runs the hardware challenge inside the rented machine. If the hardware is counterfeit or throttled, Gridlock slashes the provider's 120% bond and refunds the agent.

### 5. Mera Passkey PRF Decryption
```bash
npm run prf -- --decrypt --priv <buyerPriv> --ciphertext <ciphertextHex>
```
Extracts and decrypts on-chain SSH credentials into memory using Mera passkey PRF, X25519 Diffie-Hellman, and ChaCha20-Poly1305.

### 6. Autonomous Compute Arbitrageur Agent
```bash
npm run agent -- --scan
npm run agent -- --series gH100-W43 --hours 8 --budget 500
```
Scans spot vs forward spreads, detects forward discounts (>5%), enforces Guard Mode budget limits, and emits an end-to-end execution transaction bundle.

