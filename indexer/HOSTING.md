# Envio Cloud Hosting & Deployment Guide

**Date:** 2026-10-14  
**Workstream:** 05 — Envio Indexer  
**Branch:** `feat/envio-indexer`  

## 1. Hosting Architecture Overview

Gridlock's indexer is designed for deployment on **Envio Cloud** (formerly Hosted Service) to provide continuous high-availability GraphQL endpoints for the web frontend and trading bots.

## 2. Envio Cloud Configuration Settings

When connecting the GitHub repository to [Envio Cloud](https://envio.dev):

| Setting | Value | Notes |
|---|---|---|
| **Repository** | `puneetnith28/Gridlock` | Main GitHub repo |
| **Root Directory** | `indexer` | Required for monorepo isolation |
| **Config File** | `config.yaml` | Relative to `indexer/` root |
| **Deployment Branch** | `feat/envio-indexer` (or `main`) | Automated Git push deployments |
| **Node.js Version** | `22.x` | Required for HyperIndex V3 |

## 3. Environment Variables

The indexer natively indexes Monad Testnet (`id: 10143`) via HyperSync (`https://monad-testnet.hypersync.xyz`) and RPC fallback (`https://testnet-rpc.monad.xyz`).

Optional Cloud Variables:
- `ENVIO_RPC_URL_10143`: Custom private Monad Testnet RPC endpoint if rate-limiting occurs.

## 4. Frontend Integration Workflow

1. Once deployment sync completes on Envio Cloud, copy the generated production GraphQL endpoint:
   `https://indexer.bigdevenergy.link/<org>/gridlock-indexer/graphql`
2. Update the frontend environment variable:
   ```bash
   NEXT_PUBLIC_ENVIO_GRAPHQL=https://indexer.bigdevenergy.link/<org>/gridlock-indexer/graphql
   ```
3. The frontend `web/lib/envio.ts` automatically consumes this live endpoint for the provider reputation leaderboard and forward curve queries.
