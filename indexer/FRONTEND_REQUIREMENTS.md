# Frontend GraphQL Query Requirements & API Surface

**Date:** 2026-10-14  
**Workstream:** 05 — Envio Indexer  
**Branch:** `feat/envio-indexer`  

## 1. Consumer Analysis from Frontend Code

Inspection of `web/app/` surfaces five core query needs:

### A. Provider Leaderboard (`web/app/providers/page.tsx`)
- **Consumer:** Reputation table ranking compute providers.
- **Query Shape:**
  ```graphql
  query GetProviderLeaderboard {
    Provider(order_by: { fails: asc, passes: desc }) {
      id
      name
      passes
      degraded
      fails
      timeouts
      hoursDelivered
      slashedTotal
    }
  }
  ```

### B. Forward Curve & GPU Series (`web/app/market/[series]/page.tsx`, `web/app/page.tsx`)
- **Consumer:** Series market selector, pricing table, and index oracle comparisons.
- **Query Shape:**
  ```graphql
  query GetForwardCurve {
    Series(order_by: { id: asc }) {
      id
      symbol
      gpuClass
      token
      lastPrice
      openHours
    }
    IndexPrint(order_by: { dayKey: desc }, limit: 10) {
      id
      gpuClass
      dayKey
      priceE8
    }
  }
  ```

### C. Delivery Status & Credentials Lifecycle (`web/app/delivery/[id]/page.tsx`)
- **Consumer:** Delivery detail page displaying pod allocation, status badge, and timeline.
- **Query Shape:**
  ```graphql
  query GetDeliveryById($id: ID!) {
    Delivery_by_pk(id: $id) {
      id
      series {
        id
        symbol
        gpuClass
      }
      buyer
      provider {
        id
        name
      }
      hours
      status
      verdict
      tflopsE2
      toBuyer
      toProvider
    }
  }
  ```

### D. Buyer Deliveries (`web/app/hours/page.tsx`)
- **Consumer:** Buyer dashboard showing active redemptions and completed pod sessions.
- **Query Shape:**
  ```graphql
  query GetBuyerDeliveries($buyer: String!) {
    Delivery(where: { buyer: { _eq: $buyer } }, order_by: { id: desc }) {
      id
      series {
        symbol
      }
      hours
      status
      verdict
      toBuyer
      toProvider
    }
  }
  ```

### E. Provider Active Deliveries (`web/app/provider/page.tsx`)
- **Consumer:** Provider portal listing pending provisioning jobs and settlement verdicts.
- **Query Shape:**
  ```graphql
  query GetProviderDeliveries($providerId: String!) {
    Delivery(where: { provider_id: { _eq: $providerId } }, order_by: { id: desc }) {
      id
      series {
        symbol
      }
      hours
      status
      verdict
      toProvider
    }
  }
  ```
