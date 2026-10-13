# Gridlock (Monad Metropolis Track 01)

> **Physically delivered GPU-hour forwards on Monad.**  
> Providers mint weekly GPU tokens against a 120% bond, list them on Kuru order books, and the bond is automatically slashed to the buyer in 1 block if an in-pod hardware verification fails.

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │          Ornn Spot Compute Index         │
                      └────────────────────┬────────────────────┘
                                           │
                                  Chainlink CRE (04)
                                           ▼
┌───────────────────────┐          ┌────────────────┐          ┌──────────────────────┐
│  Provider Mint (01)   │─────────►│  IndexOracle   │◄─────────│   Buyer Trading (03)  │
│  - 120% gUSD Bond     │          └───────┬────────┘          │   - Mera Passkey     │
│  - Mint HourTokens    │                  │                   │   - Kuru Order Book  │
└──────────┬────────────┘                  │                   └──────────┬───────────┘
           │                               │                              │
           ▼                               ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DeliveryEscrow.sol (01)                                │
│   - FIFO Queue Allocation                                                           │
│   - Confidential Credential Transfer (Mera PRF X25519 + XChaCha20-Poly1305)         │
│   - One-Block Slashing upon EIP-712 Verifier Signature                              │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │
                                  In-Pod Verification
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            Gridlock Verifier (02)                                   │
│   - Deterministic Challenge Matrix                                                  │
│   - Row-Hash Merkle Commitment & Audit                                              │
│   - FP16 Hardware Throughput Benchmark                                             │
│   - EIP-712 Verdict: PASS (100% Provider) | DEGRADED (30/70) | FAIL (100% Buyer)     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Workstream Split

- **Stream A (01 + 04)**: `contracts/`, `bots/`, `cre/`
- **Stream B (03 + 05)**: `web/`, `indexer/`
- **Stream C (02 + 06 + 07)**: `verifier/`, `skills/`, `submission/`

See [COLLABORATION.md](file:///e:/Gridlock/COLLABORATION.md) for detailed independent workflow and branch guidelines.

---

## Shared Contracts & ABIs

- [shared/INTERFACES.md](file:///e:/Gridlock/shared/INTERFACES.md): The authoritative contract specification.
- [deployments/testnet.json](file:///e:/Gridlock/deployments/testnet.json): Deployed & staging mock contract addresses.
- [abis/](file:///e:/Gridlock/abis/): Pre-generated JSON ABIs for all 5 smart contracts.

---

## Hackathon Planning & Phase Workstreams

Detailed track specifications and roadmap files are organized in [`docs/phases/`](file:///e:/Gridlock/docs/phases):
- [`00-README.md`](file:///e:/Gridlock/docs/phases/00-README.md): Hackathon Plan & Strategy
- [`01-contracts.md`](file:///e:/Gridlock/docs/phases/01-contracts.md): Solidity Contracts & Kuru Markets
- [`02-verifier.md`](file:///e:/Gridlock/docs/phases/02-verifier.md): Verifier CLI & Grader API
- [`03-web-app.md`](file:///e:/Gridlock/docs/phases/03-web-app.md): Next.js Web App & Mera Authentication
- [`04-cre.md`](file:///e:/Gridlock/docs/phases/04-cre.md): Chainlink CRE Workflows
- [`05-envio.md`](file:///e:/Gridlock/docs/phases/05-envio.md): Envio Real-time Indexer
- [`06-metamask-skill.md`](file:///e:/Gridlock/docs/phases/06-metamask-skill.md): MetaMask Agent Wallet Skill
- [`07-submission.md`](file:///e:/Gridlock/docs/phases/07-submission.md): Submission Materials & Video Scripts

---

## Prior Art Disclosure

- **Silicon Markets**: Conceptual reference for forward compute curve framing.
- **Waterline**: Reference for commit-reveal challenge matrices.
- **CoreDEX & Pye**: Design reference for order book UI structure.  
*All code written tonight from scratch. Zero code reused.*
