---
name: lista-vault-builder
description: "Designs a custom MoolahVault strategy with an optimal market queue for curators on Lista Lending. Scores and ranks candidate markets by yield and risk, then outputs supply and withdraw queue recommendations. Use when asked to build a vault strategy, design a market queue, or create a MoolahVault configuration."
---

# Lista Lending — Vault Strategy Builder

Design an optimal `MoolahVault` configuration for a chosen asset and risk profile.

**Input:** `[borrow_token] [risk_level]`  — defaults: WBNB, balanced
**API base:** `https://api.lista.org/api/moolah`

## Step 1 — Discover candidate markets

```bash
# Get all vaults, filter by assetSymbol == borrow_token
curl -s "https://api.lista.org/api/moolah/vault/list?pageSize=100"

# Get allocations for each matching vault
curl -s "https://api.lista.org/api/moolah/vault/allocation?address=<VAULT>&pageSize=100"

# Get full market detail for each candidate market ID
curl -s "https://api.lista.org/api/moolah/market/<MARKET_ID>"
```

API shape: `response.data.list` for lists, `response.data` for single market.

## Step 2 — Score each market (lower = safer)

| Factor | Score |
|---|---|
| Zone Alpha | +3 |
| Zone Aster | +2 |
| Custom/PT oracle | +1 |
| Utilization > 90% | +1 |
| Smart Lending market | +0.5 |

Risk level filters:
- **conservative**: exclude score > 2, prefer utilization < 85%
- **balanced**: exclude score > 2.5, allow utilization ≤ 90%
- **aggressive**: include all

Rank by: `supplyApy / (1 + riskScore)` descending.

## Step 3 — Design supply and withdraw queues

- **Supply Queue** (priority order): highest APY first → idle funds deployed here
- **Withdraw Queue** (priority order): highest free liquidity first → funds pulled here on redemption

## Output Format

```
Lista Lending — Vault Builder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vault Asset: WBNB  |  Risk Profile: balanced

📋 Supply Queue (highest yield → lowest)
1. slisBNB/WBNB — APY 4.8%  |  Util 52%  |  Zone Classic
   Why: Liquid blue-chip collateral, reliable oracle
2. PT-slisBNBx/WBNB — APY 5.8% fixed  |  Util 71%  |  Zone Classic

📋 Withdraw Queue (highest liquidity → lowest)
1. slisBNB/WBNB    — $4.2M free
2. PT-slisBNBx/WBNB — $820K free

📊 Projected Blended APY: ~5.1%  (+2.1% LISTA emission if applicable)

🚫 Excluded: BTCB/WBNB (Alpha zone), volatile-collateral/WBNB (util >92%)

🛠️  Next Steps
1. Create vault at https://lista.org/lending → "Create Vault"
2. Set asset: <borrow_token>
3. Add supply queue in order shown
4. Set withdraw queue as shown
5. VaultAllocator: 0x9ECF66f016FCaA853FdA24d223bdb4276E5b524a
```

Default to WBNB if no token specified. If no markets found, suggest the closest alternative.
