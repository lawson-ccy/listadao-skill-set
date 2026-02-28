---
name: lista-risk
description: "Protocol-wide risk monitor for Lista Lending on BSC. Scans all markets for liquidity crunches, oracle staleness, and near-liquidation conditions via RPC. Optionally checks a specific wallet's position risk. Use when asked about protocol health, at-risk positions, oracle status, or whether any markets are near liquidity crisis."
---

# Lista Lending — Risk Monitor

Scan all markets for protocol-level risks. Optionally check a specific wallet.

**RPC script:** `../.agents/scripts/moolah.js`

## Step 1 — Fetch all markets

```bash
curl -s "https://api.lista.org/api/moolah/vault/list?pageSize=100"
```

Collect unique market IDs from each vault's allocations:

```bash
curl -s "https://api.lista.org/api/moolah/vault/allocation?address=<VAULT_ADDRESS>&pageSize=100"
```

API shape: `response.data.list` (not `response.data`).

## Step 2 — Fetch on-chain market state for each market ID

```bash
node ../.agents/scripts/moolah.js market <marketId>
```

Returns `{utilization, utilizationPct, freeLiquidity, lastUpdate, lastUpdateIso}`.

Classify each market:

| Condition | Risk |
|---|---|
| `utilization > 0.95` | 🔴 Liquidity crunch — withdrawals restricted |
| `utilization > 0.85` | 🟡 Near crunch — monitor closely |
| `now − lastUpdate > 3600` | 🟡 Oracle stale (>60 min) |
| `now − lastUpdate > 7200` | 🔴 Oracle critical (>120 min) |

## Step 3 — Check specific wallet (if provided)

```bash
node ../.agents/scripts/moolah.js user-positions <walletAddress>
```

For each position, get LTV via:

```bash
node ../.agents/scripts/moolah.js oracle-price <marketId>
```

LTV = `currentDebt / (collateral × oraclePrice / 1e36)`. LLTV from `oracle-price` output.

## Output Format

```
🛡️  Lista Lending — Risk Monitor
<TIMESTAMP> UTC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 CRITICAL
  slisBNB/WBNB — Utilization 97.3%  |  Free liquidity: $41.2K
  Action: Lender withdrawals restricted until borrows repay.

🟡 WARNING
  BTCB/USD1 — Oracle last updated 72 min ago (threshold: 60 min)
  PT-slisBNB/BNB — Utilization 87.1% — approaching liquidity pressure

📋 Market Health Summary
Market                  │ Util   │ Free Liq │ Oracle Age
────────────────────────┼────────┼──────────┼──────────
slisBNB/WBNB            │  52.1% │  $4.2M   │  8 min
BTCB/USD1               │  87.1% │  $420K   │  72 min ⚠️

👤 Wallet Check — 0xAbCd…5678  (if provided)
  slisBNB/WBNB — LTV 43.4% / LLTV 86% → 🟢 SAFE

🟢 All Clear  ← if no risks found
  All N markets within healthy parameters.
```
