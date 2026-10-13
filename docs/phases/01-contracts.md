# 01 — Contracts + Kuru markets

**Owner:** _______ · **Prizes:** Track 01, Kuru "Bring New Assets & Markets" ($5k)
**Hard gate:** contracts deployed + `deployments/testnet.json` + `abis/` pushed by **22:30 IST**.

Read `shared/INTERFACES.md` first. It is the spec.

## Phase 0 (20:30–21:00)

- [ ] `forge init contracts && cd contracts && forge install OpenZeppelin/openzeppelin-contracts`
- [ ] Testnet MON in deployer, provider, buyer wallets.
- [ ] Check Kuru testnet router is alive:
      `cast code 0x7EFbE105Ca7415dE98F96622173458ac1c054630 --rpc-url https://testnet-rpc.monad.xyz`
      Empty output → tell the group; plan B is mainnet router `0xd651346d7c789536ebf06dc72aE3C8502cd695CC`
      with our own mock tokens (gas only, no value at risk; needs ~1 MON on mainnet).

## Phase 1 (21:00–22:30) — write + test + deploy

### Contracts

1. `GridUSD.sol` — ERC20, 6 decimals, `faucet()` mints 1,000 to caller (rate limit 1/hour per address).
2. `IndexOracle.sol` — Ownable. `pushPrint` (owner + `forwarder`), `onReport` (only `forwarder`, decode
   `(bytes32,uint64,uint128)`), `latest()`. `setForwarder(address)` for CRE.
   Owner can `setFixedPrice("T4", 35_000_000)` → $0.35/hr for the demo class (T4 isn't in the Ornn index).
3. `HourToken.sol` — ERC20 18 decimals, mint/burn only by escrow.
4. `SeriesFactory.sol` — `createSeries` deploys HourToken (`new HourToken(symbol, escrow)`), stores series.
5. `DeliveryEscrow.sol`
   - `mint`: price = `oracle.latest(class)`; bond (6dp) = `hours * priceE8 * 120 / 100 / 100` (priceE8 → 1e6 USD: divide by 100). Pull GridUSD. Mint `hours * 1e18` tokens to provider. Push provider onto `queue[seriesId]`, `open[seriesId][provider] += hours`, `bondPerHour[seriesId][provider]` recorded.
   - `redeem`: require `windowStart <= now <= windowEnd`; burn from buyer; walk FIFO queue to first provider with `open >= hours` (v1: single provider per delivery, revert if none); move that bond slice into the delivery; `deadline = now + 2h`.
   - `provision`: only assigned provider, status Requested → Provisioned, store `provisionedAt`.
   - `settleWithSig`: EIP-712 recover == `verifierSigner`; status Provisioned → Settled; pay per split.
   - `onReport`: only `forwarder`; same logic as settleWithSig minus sig.
   - `claimTimeout`: Requested & now > deadline → buyer gets bond. Provisioned & now > provisionedAt + hours*1h + 1h → provider gets bond.
   - `withdrawUnsold`: after windowEnd, provider burns unsold tokens it still holds → bond slice back.
   - Emit every event in INTERFACES.md exactly.

### Tests (`forge test`) — write these before polishing

- [ ] PASS releases bond to provider
- [ ] FAIL sends 100% to buyer
- [ ] DEGRADED 30/70
- [ ] provisioning timeout → buyer
- [ ] verdict timeout → provider
- [ ] bad signature reverts; wrong provider can't provision
- [ ] FIFO: two providers, redeem goes to the first with open hours

### Deploy script `script/Deploy.s.sol`

- Deploy GridUSD, IndexOracle, SeriesFactory, DeliveryEscrow (wire factory ↔ escrow).
- Push initial prices: H100 SXM from Ornn (latest print, e.g. 265_000_000), A100 SXM4 from Ornn, T4 fixed 35_000_000.
- Create series: `gT4-NOW` (window = now → now+7d), `gH100-W43`, `gH100-W44`, `gA100-W43`.
- Set `verifierSigner` = address of VERIFIER_PK (get from workstream 02).
- Write `deployments/testnet.json`; `forge inspect` each contract → `abis/*.json`.

```bash
forge script script/Deploy.s.sol --rpc-url $MONAD_RPC --broadcast --private-key $DEPLOYER_PK --gas-estimate-multiplier 130
```

## Phase 1b (22:30–23:30) — Kuru markets + liquidity

`bots/` (TypeScript, `npm i @kuru-labs/kuru-sdk ethers@5`):

1. `deploy-markets.ts` — for each series: `ParamCreator.calculatePrecisions(price, 1, maxPrice=price*3, minSize=1, 10)`
   then `deployMarket(signer, ROUTER, 0, hourToken, gridUSD, sizePrecision, pricePrecision, tickSize, minSize, maxSize, 30, 10, BigNumber.from(100))`.
   Write `kuruMarket` into `deployments/testnet.json`.
2. `seed-ladder.ts` — provider: `GridUSD.faucet()` → `escrow.mint(series, 20)` → deposit HourTokens to Kuru
   MarginAccount (`MarginDeposit.deposit`) → `GTC.placeLimit` asks at index ×1.02, ×1.04, ×1.06, ×1.08 (5 hours each).
   Buyer wallet: post a few bids at index ×0.97 so the book looks two-sided.
3. `kuru-maker.ts` (only if time) — every 60s read `IndexOracle.latest`, cancel + re-post ladder.

Docs: https://docs.kuru.io/sdk/deploy-market · https://docs.kuru.io/sdk/orderbook-sdk

## Phase 2 (00:30–03:00) — integration support

- Help 02 run one real `settleWithSig` against the deployed escrow.
- Help 03 with any ABI/addr issues. Do one full manual flow with `cast` and paste tx hashes in the group.
- Give 04 the `setForwarder` call once CRE knows its forwarder address.

## Hand-off (post in group)

- `deployments/testnet.json` + `abis/` committed
- Explorer links for each contract
- Tx hashes of: one mint, one Kuru fill, one PASS settle, one FAIL settle

## Done =

- [ ] All tests green
- [ ] 4 series live, 4 Kuru markets with a two-sided book
- [ ] One PASS and one FAIL settled onchain
