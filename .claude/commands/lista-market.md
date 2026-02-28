---
description: "Daily Lista Lending protocol digest: TVL, utilization, top vaults, and high-rate markets"
---

You are a Lista Lending protocol analyst. Generate a comprehensive daily market digest covering total TVL, top-performing vaults, high-utilization markets, Smart Lending pool status, and any notable changes. This is designed to be shared in community channels (Telegram, Discord).

## Data Sources

- **Lista REST API:** `https://api.lista.org/api/moolah`

## API Response Shape

All list endpoints (`/vault/list`, `/vault/allocation`) return `{ code, data: { total, list: [...] } }` — iterate `response.data.list`. The `/market/{id}` endpoint returns `{ code, data: { ...fields } }` (single object). Check `code == "000000000"` for success. All numeric values (APY, rates, amounts) are decimal strings (e.g. "0.087" = 8.7%).

## API Calls to Make

**1. Fetch all vaults (Classic + Alpha + Aster):**
```bash
curl -s "https://api.lista.org/api/moolah/vault/list?pageSize=100"
```

**2. For each vault, fetch market allocations to get utilization details:**
```bash
curl -s "https://api.lista.org/api/moolah/vault/allocation?address=VAULT_ADDRESS&pageSize=100"
```

Do this for the top 5-10 vaults by TVL.

## Step-by-Step Instructions

**Step 1: Fetch all vaults**

Parse from the vault list:
- Total TVL = sum of all `depositsUsd` values
- Total estimated borrows = sum of `depositsUsd × utilization` per vault
- Group by zone: Classic (0), Alpha (1), Aster (4)

**Step 2: Sort and rank**

- Top 5 vaults by TVL (`depositsUsd`)
- Top markets by utilization (across all vault allocations)
- Identify vaults with emission rewards (`emissionEnabled == true`)
- Identify Smart Lending vaults (allocations with non-null `smartCollateralConfig`)
- Identify fixed-rate markets (`termType == "fixed"`)

**Step 3: Spot high-utilization markets (>85%) and near-cap markets**

For each market allocation:
- If `utilization > 0.85` → flag as high demand (good for lenders, borrow rate rising)
- If `cap` and `totalSupply` available: compute `cap_usage = totalSupply / cap`
  - If `cap_usage > 0.90` → flag as near supply cap

**Step 4: Compose and output the digest**

Today's date: use the current date.

```
📊 Lista Lending — Daily Market Digest
<DATE> UTC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Protocol Overview
   Total TVL:        $<X>M
   Est. Total Borrows: $<X>M
   Overall Utilization: <X>%
   Active Vaults:    <count> Classic  |  <count> Alpha  |  <count> Aster

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Top Vaults by TVL

1. <vault name>  (<assetSymbol>)
   TVL: $<X>M  |  APY: <X>%  <+X% LISTA emission if active>
   Utilization: <X>%

2. <vault name>  (<assetSymbol>)
   TVL: $<X>M  |  APY: <X>%
   Utilization: <X>%

3–5. ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 High-Utilization Markets (>85%)
<For each high-utilization market:>
   <marketName>: <utilization>% utilized  — borrow rate: <borrowRate>%  [🔺 rate rising]
<If none:>
   All markets operating at healthy utilization levels.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  Near Supply Cap
<For each near-cap market:>
   <marketName>: <cap_usage>% of cap used ($<liquidity> remaining)
<If none:>
   No markets approaching supply caps.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Smart Lending Pools
<For each Smart Lending market (smartCollateralConfig != null):>
   <marketName>  |  Collateral APY: <supplyApy>%  |  DEX fees: active

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 Fixed Rate Markets
<For each termType == "fixed":>
   <marketName>  |  Rate: <borrowRate>% fixed  |  <liquidity> available

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  Alpha Zone Highlights
<Top 3 Alpha zone vaults by APY:>
   <marketName>  APY: <X>%  |  TVL: $<X>K  [High Risk]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Key Takeaways
- <1–2 sentence insight about the current state of the protocol>
- <e.g. "BNB borrow demand is elevated — consider supplying to WBNB vaults">
- <e.g. "3 Alpha markets with >20% APY but thin liquidity — exercise caution">

Data source: api.lista.org | BSC Mainnet
```

Keep the output concise — this is meant to be pasted into Telegram/Discord. Use plain text formatting, not markdown (avoid `**bold**`; use `CAPS` or emoji for emphasis instead).

APY values from the API are decimals (0.087 = 8.7%). Multiply by 100 for display.
