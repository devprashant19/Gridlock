# Bounty Application Answers

### 1. Kuru: Bring New Assets & Markets ($5k)
Gridlock brings physically delivered GPU-hour forwards to Kuru. Compute providers deposit a 120% bond in `GridUSD` to mint tradeable `HourTokens` (e.g., `gH100-W43`). AI researchers and autonomous agents buy hours on Kuru's central limit order book, lock compute costs weeks in advance, and redeem them for cryptographic SSH credentials. If in-pod verification fails, the 120% bond is slashed to the buyer on Monad.

### 2. Kuru: Next Consumer Trading App ($5k)
Our web app offers a consumer-grade trading terminal powered by Kuru's L2 order books. Users experience zero-friction trading with Mera passkey one-prompt logins, live forward curves comparing spot vs weekly futures, one-click market buy/sell orders, and seamless redemption directly from their portfolio into machine access.

### 3. Mera: Best UX ($2.5k)
We implement stateless, discoverable WebAuthn passkey authentication via Mera. Users sign up with biometric face/fingerprint recognition in one prompt. A scoped session key allows instant trading on Kuru order books and redemption without repeated wallet popups, enforcing strict expenditure caps and allowed target contracts.

### 4. Mera: PRF Bounty ($2.5k)
Gridlock leverages WebAuthn PRF extensions to solve confidential compute credential delivery. The buyer's passkey PRF output deterministically derives an X25519 encryption keypair—completely independent of the Ethereum signing key. The provider encrypts physical SSH keys using XChaCha20-Poly1305 to this public key onchain. When the buyer logs in from a phone or fresh browser, the passkey PRF seamlessly decrypts the machine credentials across devices.

### 5. Chainlink CRE: Best Workflow ($3k)
We deployed two production-grade Chainlink Runtime Environment (CRE) workflows on Monad testnet:
1. `index-feed`: Periodically ingests GPU spot rental price indices from Ornn API, executes DON median consensus, and publishes authenticated price prints to `IndexOracle`.
2. `delivery-settler`: Triggered by `Provisioned` log events on `DeliveryEscrow`, polls the verifier grading API, reaches decentralized consensus on hardware benchmark verdicts, and executes one-block bond settlement directly via `onReport`.

### 6. Envio: Best Use ($1k)
Gridlock indexes the entire forward compute lifecycle in real-time using Envio HyperSync on Monad testnet. Envio tracks provider slashing events, fulfillment latency, pass/fail counts, and weekly trade prints, powering our real-time provider reputation leaderboard and historical forward curve without querying RPC nodes directly.

### 7. MetaMask Agent Wallet ($2.5k)
Gridlock implements an installable MetaMask Agent Wallet skill (`@gridlock/agent-skill`). AI agents autonomously quote forward compute prices, generate unsigned Kuru buy orders, and redeem compute hours while strictly adhering to MetaMask Guard Mode limits and human approval workflows without exposing private keys.
