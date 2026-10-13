# 06 — MetaMask Agent Wallet skill

**Owner:** _______ · **Prize:** MetaMask Agent Wallet ($2.5k, Track 01 only)
**Bar:** installable plugin + SKILL.md, no signing bypass.
**First thing:** a **15-minute feasibility check**. If it fails, drop this file and help 03 or 07.

## Feasibility check (do before anything else)

```bash
npm install -g @metamask/agent-wallet@latest   # Node >= 22.18
npx skills add MetaMask/agent-skills
mm --help
```

Pass if `mm` can: (1) select/add Monad testnet (10143) or Monad mainnet (143), and (2) send a tx with
arbitrary `to` + `data` (contract call). Docs: https://docs.metamask.io/agent-wallet/quickstart
The docs don't mention Monad — post the result in the group either way.

## Build (only if check passes) — target 1h30

```
skills/gridlock/
  SKILL.md
  cli/  (node, viem read-only + calldata builder)
    quote.ts    -> forward curve + best ask per series (Envio or Kuru getL2OrderBook)
    buy.ts      -> calldata for Kuru IOC buy (approve + placeMarket) -> prints {to, data, value}
    redeem.ts   -> calldata for DeliveryEscrow.redeem
    verify.ts   -> runs gridlock-verify against VERIFIER_URL
```

**No signing bypass:** the CLI never touches a private key. It prints `{to, data, value}`; the skill
tells the agent to send it via `mm` so Guard Mode limits + human approval still apply.

### SKILL.md outline

```markdown
---
name: gridlock
description: Buy, redeem and verify GPU hours on Gridlock (Monad). Use when the agent needs GPU compute for a job, wants to lock a price for future GPU hours, or must check a rented GPU is the class it paid for.
---
# Gridlock
1. `gridlock quote --class "H100 SXM"` → pick the series and price.
2. Confirm budget with the user if total > their limit.
3. `gridlock buy --series gH100-W43 --hours 4 --max-price 2.90` → send printed tx with `mm` (needs approval if over limits).
4. When the job is ready: `gridlock redeem --series ... --hours 4` → send with `mm`.
5. After credentials arrive, run `gridlock verify --delivery <id> --class "H100 SXM"` inside the machine.
6. If FAIL: tell the user the bond was refunded; never retry on the same provider.
Never ask for or handle private keys.
```

Pitch line: AI agents are the natural buyers of forward compute — they know their training schedule.

## Done =

- [ ] `npx skills add <our-repo>/skills/gridlock` installs it
- [ ] 30-second recording: agent quotes, buys 1 hour with an approval prompt, redeems
- [ ] 3-line bounty answer to 07
