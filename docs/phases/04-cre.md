# 04 — Chainlink CRE workflows

**Owner:** _______ · **Prize:** Chainlink CRE "Best workflow" ($3k)
**Bar:** CRE workflow simulated or deployed, combining a chain + an external API/LLM.
**Hard gate:** `index-feed` simulating with a recording by **01:00 IST**; `delivery-settler` by **03:30**.

## Phase 0 (20:30–21:00)

- [ ] Install CRE CLI **≥ v1.30.0** (Monad Testnet support), TS SDK **≥ v1.19.0**.
      Networks page: https://docs.chain.link/cre/supported-networks-ts.md
- [ ] `cre login` → `cre workflow supported-chains --output json` → note the exact Monad testnet chain-selector name. Post it in the group.
- [ ] `cre init` two projects under `cre/`: `index-feed`, `delivery-settler`.

## Phase 1 (21:00–01:00) — `index-feed`

- Trigger: cron (every hour; simulate once).
- Step 1 (HTTP capability): GET Ornn `.../api/gpu/{symbol}/index-history` for
  `H100 SXM`, `H200`, `B200`, `A100 SXM4`; take the latest `index_value`.
- Step 2: consensus = median across nodes; convert to `priceE8 = round(value * 1e8)`;
  `dayKey = unix seconds of the print timestamp`.
- Step 3 (EVM write): `writeReport` to `IndexOracle` with report `abi.encode(bytes32 gpuClass, uint64 dayKey, uint128 priceE8)`,
  `gpuClass = keccak256(symbol)`. One report per symbol.
- Until 01 deploys: point at any address and run `cre workflow simulate` without broadcast; switch
  to the real IndexOracle at ~22:30 and simulate with broadcast.
- Give 01 the forwarder address so they call `IndexOracle.setForwarder(...)`.

Proof to record: terminal run + `PrintPublished` event on the explorer.

## Phase 2 (01:00–03:30) — `delivery-settler`

- Trigger: EVM log trigger on `DeliveryEscrow.Provisioned(uint256 indexed deliveryId, bytes)`.
- Step 1 (HTTP): poll `GET {VERIFIER_URL}/verdict/{deliveryId}` (from 02) until 200 or timeout.
- Step 2: consensus on `(verdict, tflopsE2, resultRoot)` — all nodes must agree (identical aggregation).
- Step 3 (EVM write): report `abi.encode(uint256 deliveryId, uint8 verdict, uint32 tflopsE2, bytes32 resultRoot)`
  → `DeliveryEscrow.onReport`. 01 sets the escrow forwarder.
- Pitch line: settlement doesn't trust one server key — the DON fetches the verdict and writes it.

## Fallbacks

- Monad testnet writes fail in simulate → run without broadcast, show the computed report bytes in the
  log, and settle the same delivery via `settleWithSig`. Record both. The bounty accepts simulation.

## Done =

- [ ] Both workflows in repo with a README (trigger, steps, how to simulate)
- [ ] 2 screen recordings (≤ 30s each) for the demo video
- [ ] Bounty answer draft (5 lines) sent to 07
