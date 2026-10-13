# 03 — Web app (Mera + Kuru + delivery)

**Owner:** _______ · **Prizes:** Kuru "Next Consumer Trading App" ($5k), Mera UX ($2.5k), Mera PRF ($2.5k)
**Hard gate:** login + market page with live Kuru book by **01:00 IST**; full buyer + provider flow by **03:00**.

Until 01 pushes ABIs/addresses (~22:30), build against `shared/INTERFACES.md` with a mock
`deployments/testnet.json`. Swap in real addresses after.

## Stack

Next.js 15 (app router) · viem · Tailwind (dark default) · `@kuru-labs/kuru-sdk` + `ethers@5` ·
`@category-labs/mera` · `@scure/bip32` `@scure/bip39` · `@noble/curves` `@noble/ciphers` `@noble/hashes` · recharts.
Deploy on Vercel (HTTPS required for passkeys). Test in Chrome (Google Password Manager) and on an Android/iOS phone.

## Phase 0 (20:30–21:00)

- [ ] `npx create-next-app@latest web --ts --tailwind --app`
- [ ] Vercel project linked; first deploy of the empty app so the passkey `rpId` is the real domain early.

## Phase 1 (21:00–01:00)

### A. Mera login (Mera UX bounty) — do first

Docs: https://docs.monad.xyz/guides/mera.md

- Sign up: `createPasskeyWithPrfOutput` **once** → save `{credentialId, transports}` to localStorage.
- Sign in: `getPasskeyPrfOutput({ rpId: location.hostname, credential })` — works with no stored
  credential too (discoverable passkey) → this is the **stateless test**: fresh browser, sign in, same address.
- Wallet key: `prfOutput → entropyToMnemonic → mnemonicToSeedSync → m/44'/60'/0'/0/0`.
- Hold one `createSecp256k1SigningSession` for the visit = **one prompt**. `session.end()` on sign-out.
- **Scoped session**: wrap the signer; refuse any tx whose `to` is not in
  `{GridUSD, HourTokens, Kuru markets, Kuru MarginAccount, DeliveryEscrow}` and cap GridUSD spend per session
  (e.g. 200). Show the scope in a small "Session: trading only, ≤ 200 gUSD" badge.
- Kuru SDK needs an ethers v5 signer → inside the session build `new ethers.Wallet(hexKey, provider)`;
  null it on session end.

### B. Pages

| Route | Content |
|-------|---------|
| `/` | Hero line + **forward curve** chart: spot index (IndexOracle) vs last price per weekly series. Faucet button (GridUSD). |
| `/market/[series]` | Kuru L2 book (`OrderBook.getL2OrderBook`, poll 1s), Buy (`IOC.placeMarket`, approveTokens true), Sell (`GTC.placeLimit`, deposit to margin first), my balance. |
| `/hours` | My HourTokens per series → Redeem (hours) → delivery card with status, deadline countdown, **Decrypt credentials**, copy-paste verify command. |
| `/provider` | Register, Mint (shows bond = hours × index × 1.2), open deliveries queue → paste creds → **Encrypt & provision**. |
| `/providers` | Leaderboard: passes / degraded / fails / slashed (Envio GraphQL from 05; fallback: read events with viem `getLogs`). |
| `/delivery/[id]` | Timeline: requested → provisioned → verdict (poll `/verdict/{id}` + `Settled` event). Big green/red verdict. |

Kuru docs: https://docs.kuru.io/sdk/orderbook-sdk

## Phase 2 (01:00–02:00) — Mera PRF credential delivery (Mera PRF bounty)

Format is fixed in `shared/INTERFACES.md`.

- Buyer key: `HKDF-SHA256(prfOutput, "gridlock", "gridlock/delivery-x25519/v1")` → X25519 private →
  pub goes into `redeem(..., buyerEncPubKey)`. This key is **not** a wallet key — that is the bounty point.
- Provider: ephemeral X25519 → shared → HKDF → XChaCha20-Poly1305 → `provision(id, ciphertext)`.
- Buyer: read `Provisioned` event → decrypt in browser → show host/user/key with copy buttons.
- **Cross-device test (record it):** redeem on laptop, open `/delivery/[id]` on phone with the synced
  passkey, decrypt there.

## Phase 3 (02:00–05:00) — polish

- [ ] Dark theme, consistent spacing, Gridlock logo from 07
- [ ] Empty/loading/error states on every page
- [ ] Mobile layout works at 375px (phone part of demo)
- [ ] Txs show explorer link toast
- [ ] One "Demo mode" banner explaining `gT4-NOW` uses a fixed $0.35/hr reference price

## Done =

- [ ] Live Vercel URL in group
- [ ] Recorded: one-prompt sign-in, stateless sign-in on a fresh browser, buy on Kuru, redeem, decrypt on phone
