# Going live on Monad testnet

`contracts/script/Deploy.s.sol` deploys the contracts and series but writes no `series`
section and creates no Kuru markets. The web app and indexer need both. These two bots
fill the gap. The whole sequence was tested on an anvil fork of Monad testnet (real Kuru
Router) and the web app bought and redeemed against the result.

```bash
# .env at repo root: DEPLOYER_PK, PROVIDER_PK, BUYER_PK (each needs testnet MON), VERIFIER_SIGNER_ADDRESS

# 1. contracts (forge-std isn't vendored; install it once)
cd contracts && forge install foundry-rs/forge-std
DEPLOYMENT_OUT=../deployments/testnet.json forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz --broadcast --slow

# 2. Kuru markets + full deployments/testnet.json (0-based seriesId, token, window, kuruMarket)
cd ../bots && pnpm install && pnpm deploy-markets

# 3. depth: provider bonds + mints, posts asks at +2..8% over the index; buyer posts bids at -3/-5%
pnpm seed-ladder

# 4. point the app + indexer at it, commit deployments/testnet.json
cd ../web && pnpm sync && cd ../indexer && pnpm sync
```

Market params (`common.ts`): type 0 (ERC20/ERC20; type 1 reverts with `MarketTypeMismatch`),
price precision 1e5 with tick 100 (0.001 gUSD), size precision 1e6, min size 0.01 h.
Prices are snapped to the tick, otherwise Kuru reverts with "Tick Size Error".

`deploy-markets` is idempotent (keeps markets that already have code). `seed-ladder` adds
another ladder each run; `SEED_ASKS=0` or `SEED_BIDS=0` skips a side. `GridUSD.faucet` is
rate-limited to once per hour per address.
