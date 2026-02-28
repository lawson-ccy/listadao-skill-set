---
name: lista-loop
description: "Calculates optimal leverage loop strategies and net APY for Lista Lending on BSC. Simulates recursive deposit-borrow-redeposit loops using current market rates and LLTV to show effective leverage, net APY, and liquidation risk at each loop count. Use when asked about looping strategy, leverage, amplified yield, or how many times to loop a collateral asset."
---

# Lista Lending — Loop Strategy Calculator

Simulate a leverage loop strategy: deposit collateral → borrow → re-deposit → repeat.

**Input:** `<collateral_asset> <borrow_asset> <initial_amount> [target_loops]`
**API base:** `https://api.lista.org/api/moolah`

## Step 1 — Find the relevant market

```bash
curl -s "https://api.lista.org/api/moolah/vault/list?pageSize=100"
```

Filter vaults where `assetSymbol == <borrow_asset>`. For each, fetch allocations (`response.data.list`):

```bash
curl -s "https://api.lista.org/api/moolah/vault/allocation?address=<VAULT> &pageSize=100"
```

Find the allocation where `collateralSymbol == <collateral_asset>`. Collect `borrowRate` and `id`. Then get LLTV from the market API:

```bash
curl -s "https://api.lista.org/api/moolah/market/<MARKET_ID>"
```

## Step 2 — Get collateral native yield

- slisBNB, ankrBNB, BNBx: ~4–5% staking APY (check latest from Lista staking or CoinGecko)
- PT tokens: use fixed rate from `terms.apy` in market response
- BTCB, stablecoins: 0% native yield

## Step 3 — Simulate loops

Variables:
- `P_c` = collateral price (USD), `P_b` = borrow price (USD)
- `r` = `borrowRate` (annual), `y` = native yield (annual)
- `L` = LLTV, `targetLTV` = 0.70 (conservative default)

```
coll[0] = initial_amount
debt[0] = 0

for i in 1..N:
  borrowed_value = coll[i-1] × targetLTV × P_c / P_b   # in borrow token units
  coll[i] = coll[i-1] + borrowed_value × P_b / P_c       # convert back to collateral
  debt[i] = debt[i-1] + borrowed_value

  currentLTV = debt[i] × P_b / (coll[i] × P_c)
  stop recommending when currentLTV > 0.75 × L
```

Net APY at N loops:
```
grossYield  = coll[N] × y × P_c
borrowCost  = debt[N] × r × P_b
netAPY      = (grossYield − borrowCost) / (initial_amount × P_c)

liqPrice    = debt[N] × P_b / (coll[N] × L)   # in collateral asset USD
buffer      = (P_c − liqPrice) / P_c × 100%
```

## Output Format

```
Lista Lending — Loop Strategy: slisBNB/WBNB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LLTV: 86%  |  Borrow Rate: 2.6% APY  |  slisBNB Native Yield: 4.2%

Loops │ Collateral    │ Debt       │ Leverage │ Net APY │ Liq Price │ Buffer
──────┼───────────────┼────────────┼──────────┼─────────┼───────────┼───────
  0   │ 10.0 slisBNB  │ 0          │  1.00×   │  4.20%  │    —      │  —
  1   │ 17.0 slisBNB  │  7.0 WBNB  │  1.70×   │  5.80%  │  $195     │ 28%
  2   │ 21.9 slisBNB  │ 11.9 WBNB  │  2.19×   │  6.40%  │  $210     │ 23%
  3   │ 25.3 slisBNB  │ 15.3 WBNB  │  2.53×   │  6.70%  │  $221     │ 19%  ← Optimal
  4   │ 27.7 slisBNB  │ 17.7 WBNB  │  2.77×   │  6.60%  │  $230     │ 15%  ⚠️

✅ Recommended: 3 loops
   Net position: 25.3 slisBNB / 15.3 WBNB debt  |  Leverage: 2.53×
   Net APY: ~6.70% (vs 4.20% unlooped)
   Liquidation price: $221  (current ~$272, 19% buffer)

⚠️  Risk: Borrow rate is variable. If it rises above ~5.8%, strategy turns net negative.
```

Recommend the loop count that maximises net APY while keeping buffer ≥ 20%.
