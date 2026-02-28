---
name: lista-market
description: "Generates a daily Lista Lending protocol digest covering total TVL, top vaults, high-utilization markets, Smart Lending pools, and Fixed Rate markets on BSC. Use when asked for a market overview, protocol stats, daily digest, or summary of Lista Lending activity."
---

# Lista Lending — Daily Market Digest

Fetch protocol-wide stats and produce a shareable digest.

**API base:** `https://api.lista.org/api/moolah`

## API Calls

```bash
# All vaults (Classic + Alpha + Aster)
curl -s "https://api.lista.org/api/moolah/vault/list?pageSize=100"

# Market allocations for top vaults
curl -s "https://api.lista.org/api/moolah/vault/allocation?address=<VAULT>&pageSize=100"
```

API shape: `response.data.list` (not `response.data`). APY values are decimals (0.087 = 8.7%).

## Metrics to Compute

From vault list:
- **Total TVL** = sum of `depositsUsd`
- **Est. Borrows** = sum of `depositsUsd × utilization`
- **Overall Utilization** = Est. Borrows / Total TVL
- Group by `zone`: 0=Classic, 1=Alpha, 4=Aster

From allocations:
- High-utilization markets: `utilization > 0.85`
- Near-cap markets: `totalSupply / cap > 0.90`
- Smart Lending: `smartCollateralConfig != null`
- Fixed Rate: `termType == "fixed"` (or `termType == 0` = variable, non-zero = fixed)

## Output Format

```
📊 Lista Lending — Daily Market Digest
<DATE> UTC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Protocol Overview
   Total TVL:        $42.1M
   Est. Borrows:     $18.9M  |  Overall Util: 44.9%
   Active Vaults:    12 Classic  |  4 Alpha  |  2 Aster

💰 Top Vaults by TVL
1. WBNB Vault  (WBNB)
   TVL: $18.2M  |  APY: 4.2% + 2.1% LISTA = 6.3%  |  Util: 52%

🔥 High-Utilization Markets (>85%)
   slisBNB/WBNB — 92%  |  Borrow rate: 8.4%  [rate rising]

⚠️  Near Supply Cap
   PT-slisBNBx/WBNB — 94% of cap used  ($240K remaining)

⚡ Smart Lending  |  🔒 Fixed Rate
   slisBNB/WBNB — DEX fees active
   PT-slisBNBx/WBNB — 5.8% fixed

💡 <1–2 insight sentences about current market state>

Data: api.lista.org | BSC Mainnet
```

Plain text formatting only (no markdown **bold**) — intended for Telegram/Discord paste.
