# Envio Integration Requirements & Specification Mapping

**Date:** 2026-10-14  
**Workstream:** 05 — Envio Indexer  
**Branch:** `feat/envio-indexer`  

## 1. Event to Entity Mapping Matrix

| Contract | Event Signature | Target Entity | State Mutation |
|---|---|---|---|
| `DeliveryEscrow` | `ProviderRegistered(address indexed provider, string name)` | `Provider` | Creates new `Provider` record with initial zero counters (`passes: 0`, `degraded: 0`, etc.) |
| `DeliveryEscrow` | `Minted(uint256 indexed seriesId, address indexed provider, uint256 hours_, uint256 bond)` | `Provider`, `Series` | Increments `Provider.minted` by `hours_`; increments `Series.openHours` by `hours_` |
| `DeliveryEscrow` | `DeliveryRequested(uint256 indexed deliveryId, uint256 indexed seriesId, address indexed buyer, address provider, uint256 hours_, bytes32 buyerEncPubKey, uint64 deadline)` | `Delivery` | Creates `Delivery` record (`status: "REQUESTED"`, `hours`, `buyer`, `provider_id`, `series_id`) |
| `DeliveryEscrow` | `Provisioned(uint256 indexed deliveryId, bytes ciphertext)` | `Delivery` | Updates `Delivery.status = "PROVISIONED"` |
| `DeliveryEscrow` | `Settled(uint256 indexed deliveryId, uint8 verdict, uint32 tflopsE2, uint256 toBuyer, uint256 toProvider)` | `Delivery`, `Provider` | Updates `Delivery` (`status = "SETTLED"`, `verdict`, `tflopsE2`, `toBuyer`, `toProvider`). If verdict == 1 (PASS): `passes++`, `hoursDelivered += hours`. If verdict == 2 (DEGRADED): `degraded++`, `slashedTotal += toBuyer`. If verdict == 3 (FAIL): `fails++`, `slashedTotal += toBuyer`. |
| `DeliveryEscrow` | `TimeoutClaimed(uint256 indexed deliveryId, uint256 toBuyer, uint256 toProvider)` | `Delivery`, `Provider` | Updates `Delivery` (`status = "TIMEOUT"`, `toBuyer`, `toProvider`). If `toBuyer > 0` and unprovisioned: `timeouts++`, `slashedTotal += toBuyer`. |
| `SeriesFactory` | `SeriesCreated(uint256 indexed seriesId, bytes32 indexed gpuClass, address token, uint64 windowStart, uint64 windowEnd, string symbol)` | `Series` | Creates `Series` record (`symbol`, `gpuClass`, `token`, `openHours: 0n`) |
| `IndexOracle` | `PrintPublished(bytes32 indexed gpuClass, uint64 indexed dayKey, uint128 priceE8)` | `IndexPrint` | Creates `IndexPrint` (`gpuClass`, `dayKey`, `priceE8`) |

## 2. Consumer Requirements

- **Frontend Leaderboard (`web/app/providers/page.tsx`):**
  Requires `Provider` entities with `name`, `passes`, `degraded`, `fails`, `hoursDelivered`, `slashedTotal`.
  Query: `providersLeaderboard` (order by fails asc, passes desc).
- **Forward Curve (`web/app/`):**
  Requires active `Series` and recent `IndexPrint` prices per `gpuClass`.

## 3. Ambiguities & Scope Boundaries

- **Kuru OrderBook Trades:** Kuru testnet contracts emit events on specific market addresses; until active testnet trades are placed, `Trade` entity is scaffolded and test-ready without blocking core escrow indexing.
- **Source of Truth:** On-chain events from Monad are the sole authority for entity states.
