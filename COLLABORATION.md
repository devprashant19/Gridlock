# Gridlock — Multi-Developer Collaboration Guide

This repository is architected so that **3 developers work simultaneously and independently with ZERO merge conflicts or blocking dependencies**.

---

## 1. Team Allocation

| Stream | Owner | Responsibilities | Assigned Folders |
| :--- | :--- | :--- | :--- |
| **Stream A** | Developer A | Contracts (01), Kuru Bots (01b), Chainlink CRE (04) | `contracts/`<br>`bots/`<br>`cre/` |
| **Stream B** | Developer B | Web App (03), Envio Indexer (05) | `web/`<br>`indexer/` |
| **Stream C** | **You (Developer C)** | Verifier CLI & API (02), MetaMask Skill (06), Submission & Deck (07) | `verifier/`<br>`skills/`<br>`submission/` |

---

## 2. Directory Isolation Rules

To eliminate git conflicts:
1. **Never edit files in another person's assigned folder.**
2. **Shared Contract**: `shared/INTERFACES.md` is the locked spec. No changes without posting in group.
3. **Shared References**:
   - `deployments/testnet.json`: Contains pre-configured mock/staging addresses so B and C can run immediately.
   - `abis/`: Contains ready JSON ABIs for all 5 smart contracts.

---

## 3. Git Branching Workflow

```
main ──────────┬─────────────────────────┬──────────────► [Production / Demo]
               │                         │
stream-a ──────┴── (Person A: contracts) ┴── (pushes deployments/testnet.json @ 22:30)
stream-b ──────┴── (Person B: web/envio) ┴── (merges UI)
stream-c ──────┴── (Person C: verifier)  ┴── (merges verifier + submission)
```

1. **Clone & Branch**:
   - Developer A: `git checkout -b stream-a`
   - Developer B: `git checkout -b stream-b`
   - Developer C: `git checkout -b stream-c`
2. **Commit often**:
   Because all directories are partitioned, merging your branch into `main` will generate **zero merge conflicts**.

---

## 4. The 22:30 IST Deployment Hand-off Gate

- **Until 22:30**:
  - Person B develops `web/` and `indexer/` against `shared/INTERFACES.md` and mock `deployments/testnet.json`.
  - Person C runs `verifier/api` and `verifier/cli` locally and in Colab.
  - Person A writes Solidity tests and prepares `script/Deploy.s.sol`.
- **At 22:30 (Hard Gate)**:
  - Person A deploys contracts to Monad testnet.
  - Person A updates `deployments/testnet.json` with the real deployed addresses and commits.
  - Person B and Person C pull `main` (or copy the updated `testnet.json`). Everything immediately points to live onchain contracts.

---

## 5. Independent Running Instructions

### Stream A (Developer A)
```bash
# Contracts
cd contracts
forge test
forge script script/Deploy.s.sol --rpc-url $MONAD_RPC --broadcast --private-key $DEPLOYER_PK

# Bots
cd ../bots
npm install
npm run deploy-markets
npm run seed-ladder

# CRE Workflows
cd ../cre/index-feed
cre workflow simulate --target monad-testnet
```

### Stream B (Developer B)
```bash
# Web App
cd web
pnpm install
pnpm dev # Runs on http://localhost:3000

# Envio Indexer
cd ../indexer
pnpm install
pnpm dev
```

### Stream C (You / Developer C)
```bash
# Verifier API & CLI
cd verifier
pip install -r requirements.txt
# Start grader API:
python -m uvicorn api.server:app --reload --port 8000
# In a second terminal, run CLI audit:
python -m cli.main --api http://localhost:8000 --delivery 1 --gpu-class T4

# MetaMask Agent Wallet Skill
cd ../skills/gridlock
npm install
npm run quote
```
