# Gridlock — Team Plan (Monad Metropolis, Track 01)

Physically delivered GPU-hour forwards on Monad. Providers mint "1 GPU-hour, class X, week N" tokens
against a 120% bond, sell them on a Kuru order book, and the bond is slashed to the buyer if a verifier
run inside the rented machine fails.

Full plan doc: https://claude.ai/code/artifact/f72a793c-df5a-47bb-9303-3a727d7a4aad

## Deadline

- Portal cutoff: **Oct 14, 09:29 IST** (from our research doc; monad.xyz only says "13 Oct").
  Workstream 08 owner confirms on the portal in the first 10 minutes and posts in the group.
- Team submits by **08:30 IST**. 08:30–09:29 is buffer only.

## Workstreams (one owner each — take a file and go)

| # | File | What | Prize it unlocks | Needs from others | Can start now? |
|---|------|------|------------------|-------------------|----------------|
| 01 | 01-contracts.md | Solidity contracts + deploy + Kuru markets + ask ladder | Track 01, Kuru New Markets $5k | nothing | yes |
| 02 | 02-verifier.md | Python CLI that runs in the GPU + FastAPI grader that signs verdicts | Track 01 (core demo) | escrow address (late, optional) | yes |
| 03 | 03-web-app.md | Next.js app: Mera passkey login, Kuru trade page, redeem, provider console, PRF credential delivery | Kuru Consumer App $5k, Mera UX $2.5k, Mera PRF $2.5k | ABIs + addresses (use mocks till 22:30) | yes |
| 04 | 04-cre.md | Chainlink CRE: Ornn index feed + verdict settler | Chainlink CRE $3k | IndexOracle + escrow address, verifier `/verdict` URL | yes (simulate against mocks) |
| 05 | 05-envio.md | Envio indexer for leaderboard + forward curve | Envio $1k | ABIs + addresses | yes (from ABIs in shared/) |
| 06 | 06-metamask-skill.md | SKILL.md + CLI so AI agents buy GPU hours | MetaMask Agent Wallet $2.5k | addresses | after a 15-min feasibility check |
| 07 | 07-submission.md | Survey, logo, Kuru written answers, pitch, demo script, bounty answers, final submit | everything | demo build at 05:30 | yes |

`shared/INTERFACES.md` is the contract between workstreams. **Do not change it without posting in the group.**

## Phases (IST)

| Phase | Time | Goal | Gate to pass |
|-------|------|------|--------------|
| 0 Setup | 20:30–21:00 | Repo, wallets, faucet, deadline confirmed, survey posted | Everyone can push to the repo; each has testnet MON |
| 1 Parallel build | 21:00–00:30 | Each workstream works against mocks | Contracts deployed on testnet by 22:30; verifier PASS on Colab by 00:30 |
| 2 Integration | 00:30–03:00 | Web + verifier + contracts end to end | One full flow: mint → buy on Kuru → redeem → provision → verify → settle |
| 3 Bounty add-ons | 03:00–05:00 | CRE, Envio, MetaMask, polish | Each add-on has a screen recording |
| 4 Ship | 05:00–08:30 | Demo video, pitch video, write-ups, submit | Submitted by 08:30 |

## Team size → who takes what

- **2 people:** A = 01 + 04 + 05 · B = 02 + 03 · both do 07 from 05:00.
- **3 people:** A = 01 + 04 · B = 03 + 05 · C = 02 + 06 + 07.
- **4+ people:** one file each; 07 owner also helps 03 with UI polish.

## Cut order if behind (cut from the top)

1. 06 MetaMask skill
2. 05 Envio (web reads Kuru + contract events directly)
3. 04 CRE settler workflow (keep the index-feed workflow)
4. Mera PRF credential encryption (keep Mera login)

**Never cut:** contracts, Kuru market, verifier PASS + FAIL, demo video.

## Rules

- All code written tonight. Reference repos (Silicon Markets, Waterline, CoreDEX, Pye) are design
  references only — copy no code. Credit them in README "Prior art".
- Repo goes public at submit and is shared with metropolis@hackathon.monad.xyz.
- Commit small and often. Main branch must always build.
- Post in the group when you hit a phase gate or are blocked > 20 min.
