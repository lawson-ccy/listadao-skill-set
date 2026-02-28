---
name: lista-health
description: "Checks a wallet's Lista Lending position health and liquidation risk on BSC. Fetches all user positions from the Moolah contract via RPC, computes LTV ratios and liquidation prices, and reports risk levels. Use when the user provides a wallet address and asks about their lending positions, health factor, LTV, or liquidation risk."
---

# Lista Position Health Monitor

Given a wallet address, fetch all active positions from the Moolah contract, compute LTV and liquidation prices, and report risk.

**RPC script:** `../.agents/scripts/moolah.js` (Node.js stdlib, no packages needed)

## Step 1 — Fetch all active positions

```bash
node ../.agents/scripts/moolah.js user-positions <walletAddress>
```

Returns JSON with `positions[]` — each entry has:

| Field | Description |
|---|---|
| `marketId` | 32-byte market ID |
| `collateralSymbol` / `loanSymbol` | Token symbols |
| `collateral` | Raw collateral (1e18 units) |
| `borrowShares` | User borrow shares |
| `currentDebt` | Current debt in loan token raw units |
| `lastUpdateIso` | Last accrual timestamp |

If `positions` is empty → no active positions for this wallet.

## Step 2 — Get oracle price and LLTV for each position

```bash
node ../.agents/scripts/moolah.js oracle-price <marketId>
```

Returns `{price, lltv, lltvPct, oracle}` where:
- `price` — oracle price (uint256, 1e36-scaled)
- `lltv`  — liquidation LTV (uint256, 1e18-scaled, e.g. `860000000000000000` = 86%)

## Step 3 — Get loan token price (USD) from Lista API

```bash
curl -s "https://api.lista.org/api/moolah/market/<marketId>" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['loanTokenPrice'])"
```

## Step 4 — Compute health metrics

All contract values are raw 1e18 integers. Perform integer-safe arithmetic:

```
# Price conversions
collateral_in_loan = collateral × oraclePrice / 1e36     (in loan token units)
collateralPriceUSD = oraclePrice / 1e36 × loanTokenPrice  (USD per collateral token)

# Health
LTV    = currentDebt / collateral_in_loan                 (ratio, e.g. 0.43 = 43%)
lltvF  = lltv / 1e18                                      (e.g. 0.86)

# Liquidation price (in USD, collateral token)
liqPriceUSD = (currentDebt / 1e18 × loanTokenPrice) / (collateral / 1e18 × lltvF)
buffer      = (collateralPriceUSD − liqPriceUSD) / collateralPriceUSD × 100%
```

## Output Format

```
Position Health Report — 0xAbCd…5678
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Market: slisBNB/WBNB  🟢 SAFE
  Collateral:        2.50 slisBNB  ($1,521.35)
  Debt:              1.10 WBNB     ($660.05)
  Current LTV:       43.38%  /  LLTV 86.0%
  Liquidation price: slisBNB < $272.40  (55.2% buffer)
  Last accrual:      2025-06-15 08:41 UTC
```

Risk levels: 🟢 SAFE = LTV/LLTV < 50% · 🟡 WARNING = 50–75% · 🔴 DANGER = >75%
