# Gridlock indexer (workstream 05, Envio)

Indexes DeliveryEscrow, SeriesFactory, IndexOracle and the Kuru OrderBook `Trade` events on Monad
testnet (10143). The web app's provider leaderboard (`/providers`) and forward curve (`/`) read from it.

```bash
pnpm install
pnpm sync       # copy addresses + deployBlock + Kuru markets from ../deployments/testnet.json
pnpm codegen
pnpm test       # handler tests on Envio's MockDb
pnpm dev        # Docker: Postgres + Hasura on http://localhost:8080
```

Local `pnpm dev` needs a HyperSync token or it gets rate limited. Put `ENVIO_API_TOKEN=...` in
`indexer/.env` (free at https://envio.dev/app/api-tokens). The hosted service doesn't need one.

## When Stream A deploys

1. Pull `deployments/testnet.json` with real addresses, `deployBlock`, and `kuruMarket` per series.
2. `pnpm sync && pnpm codegen && pnpm test`, commit `config.yaml` + `src/markets.ts`.
3. Envio hosted: connect the repo, root dir `indexer`, config `config.yaml`. Put the GraphQL URL
   in the web app's `NEXT_PUBLIC_ENVIO_GRAPHQL`.

## Entities

`Provider` (passes / degraded / fails / timeouts, hoursDelivered, slashedTotal, earnedTotal),
`Series` (openHours, lastPrice from Kuru trades in 1e18), `Delivery` (full lifecycle), `GpuClass`
(latest index print), `IndexPrint`, `Trade`.

- `Settled`: verdict 1/2/3 bumps passes/degraded/fails. `toBuyer` → slashedTotal, `toProvider` → earnedTotal.
- `TimeoutClaimed` with `toBuyer > 0` (provider never provisioned) counts as a timeout strike and a slash.
- Kuru `Trade` → `Series.lastPrice`, using the market → series map in `src/markets.ts`.

## Queries the web app uses (`web/lib/envio.ts`)

```graphql
query providersLeaderboard {
  Provider(order_by: [{ fails: asc }, { passes: desc }, { hoursDelivered: desc }], limit: 100) {
    id name minted passes degraded fails timeouts hoursDelivered slashedTotal earnedTotal
  }
}
query forwardCurve {
  Series(order_by: { windowStart: asc }) { id symbol gpuClass market lastPrice lastTradeAt openHours tradeCount }
  GpuClass { id latestPriceE8 latestDayKey }
}
```

## Bounty answer (for 07)

Gridlock's provider reputation and forward curve come from an Envio HyperIndex indexer on Monad
testnet. It joins our escrow's delivery and settlement events with Kuru order-book trades and
Chainlink-fed index prints. The `/providers` leaderboard (passes, fails, slashed bonds) and the `/`
forward curve (Kuru price vs spot index per delivery week) read only from its GraphQL API.
