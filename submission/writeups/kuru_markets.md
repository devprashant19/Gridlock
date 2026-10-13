# Kuru "Bring New Assets & Markets" Write-Up ($5k Bounty)

### 1. Asset Description
**Gridlock HourTokens (`g[Class]-[Period]`)**: Physically delivered GPU-hour forward contracts traded directly on Kuru's central limit order book on Monad.
- 1 Token = 1 physical hour of verified GPU compute in a specific weekly window (e.g., `gH100-W43`, `gA100-W43`, `gT4-NOW`).
- Unlike cash-settled futures (e.g., CME's Silicon Data rental futures launched Oct 5, 2026), Gridlock tokens represent actual delivery of machine access credentials, backed by a 120% provider collateral bond.

### 2. Market Demand & Evidence
- **Spot Volatility**: The Ornn H100 SXM compute index surged from $1.65/hr in Feb 2026 to $2.65/hr in Oct 2026 (+60% increase). AI developers cannot forecast training budgets without forward pricing.
- **Traction & Survey**: Verified quotes and responses from ML practitioners show that 80%+ of developers have suffered spot instance evictions or throttled GPU performance.
- **Institutional Precedent**: CME launched cash-settled compute index futures in early October 2026. Gridlock brings physically delivered forward trading to onchain order books on Monad.

### 3. Issuance & Mechanics
- Compute providers mint HourTokens against a 120% bond denominated in stablecoin (`GridUSD`).
- HourTokens are listed on Kuru order books where buyers purchase compute hours ahead of scheduled training runs.
- Upon redemption, credentials are confidential and encrypted end-to-end via Mera passkey PRF keys.
- If the hardware verifier confirms compliance, the bond + rental fee is released to the provider. If the hardware is counterfeit or underperforming, the bond is slashed 100% to the buyer in a single block.

### 4. Liquidity & Market-Making Plan
- **Natural Supply**: Compute providers run automated ask ladders around the spot index.
- **Kuru Backstop**: Utilizing Kuru's spread and tick parameters (`kuruAmmSpread`), liquidity pools guarantee two-sided books.
- **Automated DON Arbitrage**: A Chainlink CRE workflow continuously feeds live compute spot index prints, enabling makers to re-quote around spot fair-value.

### 5. Regulatory & Legal Structure
- Structured as prepaid, physically deliverable cloud compute vouchers (analogous to pre-purchased utility credits / cloud compute instances), rather than speculative cash-settled derivatives.
- Initial testnet version is restricted to non-US users; offchain providers undergo KYB/compliance screening before mainnet launch.
