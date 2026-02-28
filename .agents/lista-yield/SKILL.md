---
name: lista-yield
description: "Scans all Lista Lending vaults and markets to surface the best current yield opportunities for lenders on BSC. Ranks vaults by total APY, identifies Smart Lending and Fixed Rate markets, and separates by risk zone. Use when asked about yield opportunities, best APY, where to deposit, or lending rates on Lista."
---

# Lista Lending — Yield Scanner

Scan all vaults and surface the best deposit opportunities. Optionally filter by asset symbol.

**API base:** `https://api.lista.org/api/moolah`

## Step 1 — Fetch all vaults

```bash
curl -s "https://api.lista.org/api/moolah/vault/list?pageSize=100"
```

Key fields per vault (`response.data.list`):

| Field | Description |
|---|---|
| `assetSymbol` | Token deposited (WBNB, USD1…) |
| `apy` | Base supply APY (decimal: 0.087 = 8.7%) |
| `emissionApy` | LISTA token bonus APY |
| `emissionEnabled` | Whether LISTA rewards are active |
| `depositsUsd` | Total TVL in USD |
| `utilization` | Current utilization |
| `zone` | 0=Classic, 1=Alpha, 4=Aster |

## Step 2 — Sort and filter

- Filter by `assetSymbol` if user specified an asset
- `totalApy = apy + (emissionApy if emissionEnabled else 0)`
- Sort by `totalApy` descending within each zone

## Step 3 — For top 5 vaults, fetch market allocation breakdown

```bash
curl -s "https://api.lista.org/api/moolah/vault/allocation?address=<VAULT_ADDRESS>&pageSize=100"
```

Identify from allocation (`response.data.list`):
- `smartCollateralConfig != null` → Smart Lending market (extra DEX fees)
- `termType == "fixed"` → Fixed Rate market
- `zone == 1` → Alpha (higher risk/reward)
- `zone == 4` → Aster (partner assets)

## Output Format

```
Lista Lending — Top Yield Opportunities
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏆 Classic Zone (Audited)

🥇 WBNB Vault
   APY: 4.2% base  +  2.1% LISTA  =  6.3% total
   TVL: $42.1M  |  Utilization: 52%
   Top markets: slisBNB/WBNB 39%, PT-slisBNBx/WBNB 21%

⚡ Smart Lending — slisBNB/WBNB market earns extra ~1.2% from DEX fees

📌 Fixed Rate — PT-slisBNBx market at 5.8% fixed

⚠️  Alpha Zone (Higher Risk)
   WBTC/USD1 — 14.2%  |  Emerging market, less liquidity

💡 High utilization (>85%) = rates may rise. Smart Lending earns DEX trading fees.
```

APY values are decimal strings — multiply × 100 for display.
