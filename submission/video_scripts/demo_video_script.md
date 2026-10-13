# 3-Minute Demo Video Script

**Recording Target**: 06:00–06:45 IST  
**Video Length**: 3 minutes

| Timestamp | Screen Action | Voiceover Audio |
| :--- | :--- | :--- |
| **0:00–0:20** | **Intro & Problem**: Show CME compute futures headline + Ornn price spike chart (+60% since Feb). | *"On October 5th, CME launched compute index futures. But cloud delivery is still broken: developers suffer sudden spot evictions, throttling, and fake hardware specs. This is Gridlock: physically delivered GPU forwards on Monad."* |
| **0:20–0:40** | **Mera Sign-in**: Click 'Passkey Sign In', TouchID prompt, immediate connection. Show forward curve. | *"Sign in with biometric passkeys via Mera in a single prompt. No seed phrases, no extension popups. The app renders our live forward curve across Monad GPU classes."* |
| **0:40–1:00** | **Provider Mint**: Switch to Provider console, enter 10 hours for `gT4-NOW`, deposit 120% bond. | *"Providers mint HourTokens against a 120% collateral bond in GridUSD. Once minted, these tokens list on Kuru's central limit order book."* |
| **1:00–1:20** | **Kuru Order Book**: Open `/market/gT4-NOW`. Buy 1 hour at market price. Book updates in sub-second Monad time. | *"As a buyer, I purchase 1 hour of compute with a single click on Kuru. Monad's 1-second finality updates the book instantly."* |
| **1:20–1:45** | **Redeem & PRF Decrypt**: Go to `/hours`, redeem 1 hour. Provider provisions SSH key. Buyer decrypts on laptop and phone. | *"Upon redemption, Mera derives an X25519 key from passkey PRF. The provider encrypts the SSH credentials onchain. The buyer decrypts them instantly—and even from their phone with synchronized passkeys."* |
| **1:45–2:10** | **Verifier PASS**: Terminal running `gridlock-verify` in Google Colab T4. Matrices execute, Merkle root committed, PASS verdict received, bond released. | *"Inside the rented pod, the buyer runs `gridlock-verify`. Bit-level matmuls and hardware probes confirm rated FP16 performance. The verifier signs an EIP-712 PASS verdict, releasing the provider's bond."* |
| **2:10–2:30** | **Verifier FAIL**: Run same verifier requesting `A100 SXM4` on a T4. Grader returns FAIL. Bond slashed to buyer in 1 block. | *"What if a provider tries to deceive the network? Running the verifier claiming an A100 fails the throughput check. An EIP-712 FAIL verdict slashes 100% of the provider's 120% bond straight to the buyer."* |
| **2:30–2:50** | **Ecosystem Showcase**: Show Chainlink CRE simulation log, Envio provider leaderboard, and MetaMask skill. | *"Every state transition is verified: Chainlink CRE feeds index prints and automates DON settlements, Envio indexes provider reputation, and AI agents quote and buy via MetaMask Agent Wallet."* |
| **2:50–3:00** | **Outro**: Logo + GitHub repo + Metropolis submit tag. | *"Gridlock: Forward compute, settled on proof. Built on Monad."* |
