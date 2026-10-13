# 05 — Envio indexer

**Owner:** _______ · **Prize:** Envio "Best Use" ($1k) + free Envio Cloud hosting
**Bar:** a real indexer driving a core feature (our leaderboard + forward curve read only from it).
**Hard gate:** GraphQL endpoint live with real events by **04:00 IST**.

## Phase 1 (21:00–00:30) — build against the interface

- [ ] `pnpx envio init` → TypeScript → "contract import" from ABI. Use the event signatures in
      `shared/INTERFACES.md` if `abis/` isn't pushed yet.
- [ ] `config.yaml`:

```yaml
name: gridlock-indexer
chains:
  - id: 10143            # Monad testnet, HyperSync: https://monad-testnet.hypersync.xyz
    start_block: <deploy block from 01>
    contracts:
      - name: DeliveryEscrow
        address: <from deployments/testnet.json>
        handler: src/EventHandlers.ts
        events:
          - event: ProviderRegistered(address indexed provider, string name)
          - event: Minted(uint256 indexed seriesId, address indexed provider, uint256 hours_, uint256 bond)
          - event: DeliveryRequested(uint256 indexed deliveryId, uint256 indexed seriesId, address indexed buyer, address provider, uint256 hours_, bytes32 buyerEncPubKey, uint64 deadline)
          - event: Provisioned(uint256 indexed deliveryId, bytes ciphertext)
          - event: Settled(uint256 indexed deliveryId, uint8 verdict, uint32 tflopsE2, uint256 toBuyer, uint256 toProvider)
          - event: TimeoutClaimed(uint256 indexed deliveryId, uint256 toBuyer, uint256 toProvider)
      - name: SeriesFactory
        address: <...>
        events:
          - event: SeriesCreated(uint256 indexed seriesId, bytes32 indexed gpuClass, address token, uint64 windowStart, uint64 windowEnd, string symbol)
      - name: IndexOracle
        address: <...>
        events:
          - event: PrintPublished(bytes32 indexed gpuClass, uint64 indexed dayKey, uint128 priceE8)
      - name: KuruOrderBook   # one address per series market; take the trade event signature from the Kuru OrderBook ABI
        address: [<market0>, <market1>, <market2>, <market3>]
        events:
          - event: <Trade event from Kuru ABI>
```

- [ ] `schema.graphql`:

```graphql
type Provider { id: ID! name: String! minted: BigInt! passes: Int! degraded: Int! fails: Int! timeouts: Int! hoursDelivered: BigInt! slashedTotal: BigInt! }
type Series { id: ID! symbol: String! gpuClass: String! token: String! market: String lastPrice: BigInt openHours: BigInt! }
type Delivery { id: ID! series: Series! buyer: String! provider: Provider! hours: BigInt! status: String! verdict: Int tflopsE2: Int toBuyer: BigInt toProvider: BigInt }
type IndexPrint { id: ID! gpuClass: String! dayKey: BigInt! priceE8: BigInt! }
type Trade { id: ID! market: String! price: BigInt! size: BigInt! timestamp: BigInt! }
```

- [ ] Handlers: `Settled` increments provider counters by verdict (1 pass, 2 degraded, 3 fail) and
      adds `toBuyer` to `slashedTotal`; trades update `Series.lastPrice`.

## Phase 2 (00:30–04:00)

- [ ] Plug real addresses + start block; `pnpm dev` locally; check events land.
- [ ] Deploy to Envio hosted service; put the GraphQL URL in `NEXT_PUBLIC_ENVIO_GRAPHQL`.
- [ ] Give 03 two ready queries: `providersLeaderboard` (order by fails asc, passes desc) and
      `forwardCurve` (series with lastPrice + latest IndexPrint per class).

## Done =

- [ ] Hosted GraphQL URL in group
- [ ] Leaderboard + forward curve in the web app read from Envio
- [ ] 3-line bounty answer to 07
