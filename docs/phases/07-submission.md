# 07 — Submission, traction, videos

**Owner:** _______ · **Prizes:** all of them — judges score 45% on business (Founder & Market 25%,
Traction 20%), plus Design 20%, Technical 20%, Originality 15%.
**Hard gate:** submitted on the portal by **08:30 IST**.

## Phase 0 (20:30–21:00) — do these right now

- [ ] Confirm deadline + timezone on the Metropolis portal. Post it in the group.
- [ ] Check the **Community Team** bounty dropdown: is GDG on Campus NIT Hamirpur (or any group we're in)
      listed? Yes → free $5k shot, select it.
- [ ] Register the project on the portal, Track 01.
- [ ] **Demand survey** (Google Form, 4 questions), post to GDG, Kaggle/AI groups, college groups:
  1. Do you rent GPUs (Colab Pro, RunPod, Vast, Lambda, AWS)? Which?
  2. Have you been hit by a price jump or a GPU slower than advertised?
  3. Would you pre-buy GPU hours at a fixed price for next month if a failed GPU auto-refunds you?
  4. How many GPU-hours/month and what max price/hour?
  Also DM 5–10 people who run ML projects and ask for a one-line quote.

## Phase 1 (21:00–01:00) — written material

- [ ] Logo (simple grid + lock mark), PNG + SVG → 03 for the app
- [ ] **Kuru "New Assets & Markets" write-up** (they require it):
  - Asset: physically delivered GPU-hour forward, 1 token = 1 GPU-hour of a class in a delivery week
  - Demand evidence: survey count + quotes; CME + Silicon Data launched H100/B200 rental-index futures
    on Oct 5, 2026 (cash-settled index, one month of rent per contract) — institutions want this hedge;
    Ornn H100 SXM index $1.65/hr (Feb 22, 2026) → $2.65/hr (Oct 11, 2026), ~60% up
  - Issuance: providers mint against a 120% bond in stablecoin, burn unsold after the window
  - Legal plan: prepaid, physically delivered compute vouchers (closer to cloud credits than securities);
    v1 non-US users; providers KYB'd offchain; get counsel before mainnet (state as plan, not legal advice)
  - Liquidity plan: providers are natural sellers (ask ladders), Kuru backstop AMM via kuruAmmSpread,
    maker bot quoting around the CRE-fed index
- [ ] Bounty answers (collect drafts from each owner): Kuru ×2, CRE, Envio, Mera UX, Mera PRF, MetaMask
- [ ] README: what it is, architecture diagram, how to run each part, deployed addresses,
      **Prior art**: Silicon Markets, Waterline, CoreDEX, Pye (design references, no code reused)

## Phase 4 (05:00–08:30)

### 3-minute demo video (record 06:00–06:45)

| Time | Shot |
|------|------|
| 0:00 | Problem: compute futures just launched at CME; delivery is still self-reported; H100 index +60% since Feb |
| 0:20 | Sign in with fingerprint — one prompt. Forward curve. |
| 0:40 | Provider mints 10 `gT4-NOW` hours with 120% bond; asks show on Kuru |
| 1:00 | Buyer buys 2 hours; book updates instantly |
| 1:20 | Redeem → provider provisions → buyer decrypts credentials, then again on a phone |
| 1:45 | `gridlock-verify` in Colab → **PASS** → bond released |
| 2:10 | Same T4 sold as A100 → **FAIL** → bond paid to buyer in one block |
| 2:30 | CRE terminal, Envio leaderboard showing the failed provider, agent skill (if built) |
| 2:50 | "Forward compute, settled on proof." |

Use backup recordings from 02/03/04 if anything breaks live.

### 2-minute pitch video (06:45–07:30)

Problem → user (Indian AI startups + student researchers renting by the hour) → product → why Monad
(sub-second order book, one-block slashing) → business model (0.5% mint fee, 10% of slashes to an
insurance fund, verification-as-a-service) → traction (survey numbers + quotes) → ask.

### Final submit (07:30–08:30)

- [ ] Logo uploaded
- [ ] Repo public, shared with **metropolis@hackathon.monad.xyz**
- [ ] Live link (Vercel) + contract addresses + explorer links
- [ ] Demo video + pitch video links (YouTube unlisted)
- [ ] Short write-up + every bounty selected with its answer
- [ ] Screenshot of the submitted page posted in group
