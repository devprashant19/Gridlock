# Gridlock web (workstream 03)

Next.js 15 app: Mera passkey wallet, Kuru order book trading, redeem → encrypted credential delivery → verifier verdict.

```bash
pnpm install
cp .env.example .env.local   # optional, defaults point at Monad testnet
pnpm dev                     # http://localhost:3000 (passkeys work on localhost)
pnpm test                    # crypto, wallet derivation, session scope, config
pnpm build
```

`predev`/`prebuild` copy `../deployments/testnet.json` and `../shared/classes.json` into `lib/shared/`.
While those still hold Stream A's placeholder addresses (`0x1111…`), every page shows a **Preview data**
banner with demo numbers and writes are disabled. Once real addresses land, re-run `pnpm dev` and it's live.

## Pages

| Route | What |
|---|---|
| `/` | Forward curve per GPU class (IndexOracle spot vs Kuru price), series table, gUSD faucet |
| `/market/[series]` | Kuru L2 book (1s poll), market buy (IOC, approves gUSD), limit sell (margin deposit + GTC, snapped to tick) |
| `/hours` | HourToken balances, redeem (sends the passkey-derived X25519 pubkey), my deliveries |
| `/provider` | Register, mint (bond = hours × index × 1.2), deliveries queue → **Encrypt & provision** |
| `/providers` | Leaderboard from Envio, falls back to reading `getDelivery` from the escrow |
| `/delivery/[id]` | Timeline, decrypt credentials, verify command, settle with verifier signature, claim timeout |

## How the wallet works (Mera bounties)

`lib/wallet/WalletProvider.tsx`: one passkey prompt per visit.

- Sign up: `createPasskeyWithPrfOutput`. Sign in: `getPasskeyPrfOutput`, with a stored credential if
  there is one, otherwise discoverable (fresh browser / synced phone → same address).
- `prfOutput → BIP-39 → m/44'/60'/0'/0/0` → `createSecp256k1SigningSession`. Raw key is zeroed right away.
  `session.end()` on sign-out.
- **Scoped session** (`lib/wallet/scope.ts`): signs only txs to GridUSD, HourTokens, Kuru markets,
  Kuru MarginAccount/Router, DeliveryEscrow; no native MON; no raw-hash, EIP-712 or EIP-7702 signing;
  GridUSD approve/transfer total capped per session (`NEXT_PUBLIC_SESSION_CAP_GUSD`, default 200).
- Kuru SDK needs ethers v5: `MeraEthersSigner` wraps the same scoped viem account. No private key
  ever reaches ethers.
- **PRF delivery key** (`lib/crypto/delivery.ts`, INTERFACES.md §4): `HKDF(prfOutput, "gridlock",
  "gridlock/delivery-x25519/v1")` → X25519. It isn't a wallet key. The provider encrypts with
  ephemeral X25519 + XChaCha20-Poly1305, and only the buyer's passkey can decrypt, on any synced device.

## Env

See `.env.example`. `NEXT_PUBLIC_ENVIO_GRAPHQL` is optional; without it the leaderboard and curve read the chain.

## Deploy (Vercel)

Root directory `web`, framework Next.js. Keep "Include files outside the root directory" on so
`prebuild` can copy `../deployments`. If it's off, the committed `lib/shared/*.json` are used.
Passkeys bind to the domain (`rpId = location.hostname`), so pick the final domain early.

## Tested

- `pnpm test`: delivery crypto round trip / wrong key / tamper, BIP-44 derivation vs ethers, scope
  allowlist + cap, real Mera session through the ethers adapter.
- `KURU_FORK_RPC=… pnpm vitest run test/kuru.fork.test.ts`: deploys a gUSD/HourToken Kuru market on an
  anvil fork of Monad testnet and trades it through two Mera sessions (see the file header).
- Full browser flow on anvil with a PRF virtual authenticator: sign up → faucet → register → mint → redeem
  → provision → decrypt → settle (FAIL) → leaderboard; stateless re-sign-in gives the same address; a
  second passkey can't decrypt.
