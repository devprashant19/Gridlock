# Chainlink Runtime Environment (CRE) Workflows

Two workflows running on Chainlink CRE:

1. **`index-feed/`**: Fetches GPU spot rental index prints from Ornn API, computes DON consensus median, and writes report to `IndexOracle`.
2. **`delivery-settler/`**: Triggered on `Provisioned` event from `DeliveryEscrow`, polls `GET {VERIFIER_URL}/verdict/{deliveryId}`, reaches DON consensus on verdict, and writes settlement report directly to `DeliveryEscrow.onReport`.

### How to Run Simulation

```bash
# In index-feed
cd index-feed
cre workflow simulate --target monad-testnet

# In delivery-settler
cd delivery-settler
cre workflow simulate --target monad-testnet
```
