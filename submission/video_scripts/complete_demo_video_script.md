# Gridlock Master Demo Video Script & Storyboard
> **Project:** Gridlock — Physically Delivered GPU-Hour Forwards Settled on Proof (Monad Metropolis Track 01)  
> **Target Video Duration:** 3:30 – 4:00 minutes  
> **Resolution:** 1920 × 1080 (16:9), 60 FPS  
> **Theme:** Cyber-Industrial Obsidian Pro Terminal  

---

## 1. Production & Pre-Recording Setup

### 1.1 Browser Tabs Preparation
Have these tabs open and preloaded before recording:
- **Tab 1 (Main App):** `http://localhost:3000` (or `https://gridlock-ashen.vercel.app`)
- **Tab 2 (Market):** `http://localhost:3000/market/gT4-NOW`
- **Tab 3 (Delivery Cockpit):** `http://localhost:3000/delivery/1`
- **Tab 4 (Envio Leaderboard):** `http://localhost:3000/providers`
- **Tab 5 (Hardware Verifier API):** `http://localhost:8000/health`

### 1.2 Terminal Window Preparation
Have a clean terminal open in `e:\Gridlock` ready to execute:
```bash
python submission/demo_runner.py --fast
```

### 1.3 Audio & Cursor Guidelines
- **Cursor Movement:** Move deliberately with smooth deceleration. Hover over key interactive elements for 0.5s to let glowing borders and micro-animations register visually.
- **Microphone:** Clear, energetic, technical delivery with professional pacing.

---

## 2. Master Storyboard & Timecodes

```
0:00 ─── Act I: Global Pro Cockpit & Forward Curve (`/`)
0:45 ─── Act II: Kuru DEX L2 Central Limit Order Book (`/market/gT4-NOW`)
1:25 ─── Act III: Hours Portfolio & Passkey Redemption (`/hours`)
2:00 ─── Act IV: Verifier Radar, Oscilloscope & Slashing Sandbox (`/delivery/1`)
2:50 ─── Act V: Provider Node Minting Station (`/provider`)
3:15 ─── Act VI: Envio HyperIndex Provider Leaderboard (`/providers`)
3:35 ─── Act VII: Autonomous Trader Agent & CLI Terminal (`demo_runner.py`)
3:55 ─── Act VIII: Metropolis Track 01 Summary & Outro
```

---

## 3. Scene-by-Scene Script

### Act I: Global Pro Cockpit & Forward Curve (`0:00 – 0:45`)
**Location:** Homepage (`/`)

#### Visual Actions & Button Checklist
- [ ] **Global Header:**
  - Pan across the Monad 400ms Block Ticker (`#1,234,567 • 0.4s`) with pulsating neon badge.
  - Hover on the Gas Meter (`0.001 Gwei`).
  - Hover on the Biometric Session Spend Capsule (`$0.00 / $200.00 gUSD`).
  - Click **"Connect Passkey"** / **"Sign In with Passkey"** button $\rightarrow$ trigger WebAuthn TouchID / FaceID prompt.
- [ ] **Forward Curve Module:**
  - Hover across multi-tenor spline data points (Weeks 42, 43, 44) showing tooltips.
  - Click **[Basis % Spread]** toggle $\rightarrow$ watch spline animate to forward basis discounts/premiums.
  - Click **[Price ($/hr)]** toggle to return to dollar rates.
- [ ] **Faucet Button:**
  - Click **"Claim 500 gUSD"** button $\rightarrow$ observe instant green confirmation toast.
- [ ] **Forward Series Grid:**
  - Locate `gT4-NOW` card.
  - Click **"Trade Series →"** button.

#### Voiceover Audio
> *"Compute is the oil of the intelligence age. But today's cloud GPU market is broken: developers face sudden spot evictions, synthetic hardware spoofing, and volatile price spikes. This is Gridlock: physically delivered GPU-hour forwards on Monad.*
>
> *We authenticate in one biometric touch using Mera passkeys. A single prompt derives our ephemeral session key and an onchain PRF encryption identity—zero seed phrases, zero extension popups.*
>
> *On our cockpit, traders observe the live forward compute curve. Chainlink CRE oracles stream spot index benchmarks from the Ornn API, while Kuru central limit order books price future delivery weeks. With one click, we toggle between absolute hourly rates and basis spreads.*
>
> *Let's claim 500 testnet GridUSD from our faucet, and enter the gT4-NOW market to acquire compute."*

---

### Act II: Kuru DEX L2 Central Limit Order Book (`0:45 – 1:25`)
**Location:** `/market/gT4-NOW`

#### Visual Actions & Button Checklist
- [ ] **Spread Banner:** Hover over `Bid $0.350` / `Ask $0.355` / `Spread 1.4%` / `Monad 400ms Block Fill`.
- [ ] **L2 Order Book:** Highlight the breathing depth bars (green bids, red asks) updating in real-time.
- [ ] **Order Entry Form (Market Buy):**
  - Verify **"Market (IOC)"** tab is active.
  - Click amount preset pill **"1 Hour"** (or **"10 Hours"**).
  - Drag the **Slippage Slider** smoothly from `0.1%` to `0.5%`.
  - Click the primary action button: **"1-Click Market Buy"**.
  - Show the 400ms transaction confirmation toast with Monad block hash.
- [ ] **Limit Order Tab:**
  - Switch briefly to **"Limit (GTC)"** tab to demonstrate tick-snapping and margin deposit notice.
  - Click **"Hour Portfolio →"** in header navigation.

#### Voiceover Audio
> *"Here on the Kuru order book, HourTokens trade as fungible, deliverable forward contracts. Monad's 10,000 TPS architecture enables high-frequency central limit order book matching entirely onchain without off-chain rollups.*
>
> *We execute an immediate-or-cancel market buy for 1 hour of Tesla T4 compute. With Monad's sub-second block finality, our trade settles in 400 milliseconds, and the HourToken balance lands directly in our portfolio.*
>
> *Traders can also post resting limit orders snapped to tick sizes. Now, let's redeem our forward contract for physical server access."*

---

### Act III: Hours Portfolio & Passkey Redemption (`1:25 – 2:00`)
**Location:** `/hours`

#### Visual Actions & Button Checklist
- [ ] **Portfolio Metrics:** Highlight the `1.000 gT4-NOW` balance.
- [ ] **Redemption Station:**
  - Input `1` in the Redeem Quantity field.
  - Click the primary button: **"Redeem for Delivery"**.
  - Show the redemption modal explaining the X25519 public key derivation via Mera PRF.
- [ ] **My Active Deliveries Table:**
  - Show Delivery `#1` created in `PROVISIONED` state with the 2-hour SLA countdown.
  - Click the row action button: **"Open Delivery Cockpit →"**.

#### Voiceover Audio
> *"On the portfolio page, we hold 1 fungible gT4 hour. When we click Redeem, our client derives an X25519 public key directly from our Mera passkey PRF output. This key is registered onchain with DeliveryEscrow.sol so only our device can decrypt the server credentials.*
>
> *Our redemption creates Delivery #1. The assigned provider is now bound by a 2-hour provisioning deadline. Let's enter the live Delivery Cockpit."*

---

### Act IV: Verifier Radar, Oscilloscope & Slashing Sandbox (`2:00 – 2:50`)
**Location:** `/delivery/1`

#### Visual Actions & Button Checklist
- [ ] **Lifecycle Timeline:** Highlight 4 stages (Redeemed $\rightarrow$ Provisioned $\rightarrow$ Pod Verified $\rightarrow$ Settled).
- [ ] **Biometric Credential Vault:**
  - Click button: **"Decrypt with Passkey (In-Memory)"**.
  - Watch the raw hex ciphertext instantly decode into Host `34.125.82.10:22`, User `root`, and private SSH key.
  - Click **"Copy SSH Connection Command"**.
- [ ] **Concentric Hardware Verifier Radar:**
  - Point out the 60fps rotating sweep beam and target blips (PCIe Gen3 x16, 40 SMs, PCR attestation hashes).
- [ ] **Anti-vGPU Memory Jitter Oscilloscope:**
  - Highlight the fluctuating green waveform showing `2.4%` memory latency variance ($\le 25\%$ threshold).
- [ ] **Interactive Rogue Provider Slashing Sandbox:**
  - Click toggle: **"Simulate Malicious Provider (Hardware Spoofing)"**.
  - **WATCH UI REACT:**
    - Radar sweeps in crimson red alert.
    - Oscilloscope spikes to `48.7%` jitter with red turbulent waves.
    - Status flips to **SPOOFING DETECTED / FAIL**.
  - Point to Slashing Settlement Box: `100% of 120% Bond Slashed to Buyer (2.16 gUSD)`.
  - Highlight dual-path settlement buttons: **"Settle with Verifier Sig (EIP-712)"** and **"Chainlink CRE DON Resolution"**.

#### Voiceover Audio
> *"Inside the delivery cockpit, the provider has provisioned the pod with ChaCha20-Poly1305 ciphertext. Clicking Decrypt uses our local passkey to unpack the SSH credentials in-memory—no unencrypted secrets ever touch a centralized server or disk.*
>
> *Once connected to the pod, the verifier runs in-pod hardware attestation. Our radar verifies bare-metal PCR measurements, while our memory jitter oscilloscope confirms sub-microsecond cache latencies, proving this is dedicated silicon, not a noisy throttled vGPU.*
>
> *Now, what happens if a malicious provider tries to spoof an A100 SXM on a cheap T4? Watch our live slashing sandbox: the verifier detects the throughput deficit, the radar triggers a security alert, and the oscilloscope captures extreme contention.*
>
> *With an atomic EIP-712 signature or a Chainlink CRE DON report, 100% of the provider's 120% collateral bond is slashed directly to the buyer within a single 400ms Monad block."*

---

### Act V: Provider Node Minting Station (`2:50 – 3:15`)
**Location:** `/provider`

#### Visual Actions & Button Checklist
- [ ] **Node Registration:** Show registered hardware specifications (Tesla T4, 16GB VRAM).
- [ ] **Forward Minting Station:**
  - Select series `gT4-NOW`.
  - Input `10` in Hours to Mint.
  - Highlight Collateral Bond Calculator: `10 hrs × $0.35 × 120% = 4.20 gUSD Bond`.
  - Click button: **"Deposit Bond & Mint HourTokens"**.
- [ ] **Active Deliveries Queue:**
  - Show incoming buyer redemptions.
  - Highlight host IP, port, and SSH key fields.
  - Hover over button: **"Encrypt & Provision Pod"**.

#### Voiceover Audio
> *"On the supply side, GPU data centers register their bare-metal nodes. To mint forward HourTokens, providers must lock a 120% collateral bond in GridUSD. This economic bond guarantees delivery or finances instant buyer compensation upon default.*
>
> *When buyers redeem hours, incoming requests appear in the provider queue. The provider encrypts the credentials against the buyer's public key with one click."*

---

### Act VI: Envio HyperIndex Provider Leaderboard (`3:15 – 3:35`)
**Location:** `/providers`

#### Visual Actions & Button Checklist
- [ ] **Leaderboard Table:**
  - Highlight columns: Verified Node Address, Passes, Degraded Deliveries, Slashed Bonds, and Earned Yield.
  - Scroll down to show penalized providers with red slashed badges.

#### Voiceover Audio
> *"All provider reputations are indexed in real-time by Envio HyperIndex on Monad. Buyers can inspect historical delivery uptime, SLA passes, and slashed collateral before placing forward orders, creating transparent market discipline."*

---

### Act VII: Autonomous Trader Agent & CLI Terminal (`3:35 – 3:55`)
**Location:** Terminal running `python submission/demo_runner.py --fast`

#### Visual Actions & Button Checklist
- [ ] **Terminal Execution:**
  - Run: `python submission/demo_runner.py --fast`.
  - Watch Stages 1 through 10 execute with green `[OK]` badges.
  - Point to **Stage 3 (Autonomous Compute Trader Agent)** detecting a 6.0% discount on Kuru and executing within passkey budget caps.
  - Point to **Stage 10 (Dual-Path Settlement & Chainlink CRE)**.

#### Voiceover Audio
> *"Gridlock is fully automated for AI agents. Using our MetaMask Agent Wallet skill, autonomous trading bots monitor Kuru order books against spot oracle feeds, buying undervalued forward capacity within strictly scoped passkey session budgets."*

---

### Act VIII: Metropolis Track 01 Summary & Outro (`3:55 – 4:05`)
**Location:** Return to Homepage Cockpit (`/`)

#### Visual Actions & Button Checklist
- [ ] Zoom out on the hero forward curve cockpit.
- [ ] Display Metropolis Track 01 summary banner.

#### Voiceover Audio
> *"Physically delivered GPU forwards, secured by zero-knowledge hardware attestation, powered by Chainlink CRE and Envio, and built natively for Monad. This is Gridlock."*

---

## 4. Key Takeaways for Recording Success
1. **Interactive Slashing Sandbox (Act IV)** is your "wow" moment—ensure the toggle click and crimson radar animation are clearly captured on screen.
2. **Basis % Spread Toggle (Act I)** visually proves integration between Ornn index prices and Kuru forward order books.
3. **Mera Passkey Modal** demonstrates frictionless consumer-grade onboarding without seed phrases.
