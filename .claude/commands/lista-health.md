---
description: "Check your Lista Lending position health & liquidation risk"
---

You are a Lista Lending position health monitor. The user has provided a wallet address. Your job is to fetch their open borrowing positions across all Lista Lending markets, compute LTV ratios and liquidation prices, and report their risk level.

## Data Sources

- **Lista REST API:** `https://api.lista.org/api/moolah`
- **BSC RPC:** `https://bsc-dataseed.bnbchain.org`
- **Moolah contract:** `0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C`

## Key ABI Signatures

```
// Get user position in a specific market
position(bytes32 id, address user) → (uint256 supplyShares, uint128 borrowShares, uint128 collateral)

// Get market state (for computing current debt)
market(bytes32 id) → (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)
```

- `position` selector: `0x6565bfb2`
- `market` selector: `0x985c8cfe` (takes a `bytes32` market ID)

## API Response Shape

All list endpoints (`/vault/list`, `/vault/allocation`) return `{ code, data: { total, list: [...] } }` — iterate `response.data.list`. The `/market/{id}` endpoint returns `{ code, data: { ...fields } }` (single object). Check `code == "000000000"` for success. All numeric values (APY, rates, amounts) are decimal strings.

## Step-by-Step Instructions

**Step 1: Fetch all markets**

```bash
curl -s "https://api.lista.org/api/moolah/vault/list?pageSize=100" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['code'] == '000000000':
    for v in data['data']:
        print(v['address'], v['name'], v.get('assetSymbol',''))
"
```

Then for each vault, fetch its market allocations to get market IDs:

```bash
curl -s "https://api.lista.org/api/moolah/vault/allocation?address=VAULT_ADDRESS&pageSize=100"
```

**Step 2: For each market ID, check if the user has a position using eth_call**

The `position(bytes32 id, address user)` call requires:
- `bytes32 id` = the market ID (already 32 bytes hex)
- `address user` = the wallet address, padded to 32 bytes

Construct the calldata:
```
selector: 0x6565bfb2
arg1: <32-byte market ID>
arg2: <user address, left-padded to 32 bytes>
```

Example call (replace MARKET_ID and USER_ADDRESS):
```bash
curl -s -X POST https://bsc-dataseed.bnbchain.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_call",
    "params": [{
      "to": "0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C",
      "data": "0x6565bfb2MARKET_ID_HEX000000000000000000000000USER_ADDRESS_WITHOUT_0x"
    }, "latest"],
    "id": 1
  }'
```

The response is 3 × 32-byte hex values: `supplyShares | borrowShares | collateral`.
A position is active if `borrowShares > 0` OR `collateral > 0`.

**Step 3: For active positions, fetch market state to compute current debt**

```bash
curl -s -X POST https://bsc-dataseed.bnbchain.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_call",
    "params": [{
      "to": "0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C",
      "data": "0x985c8cfeMARKET_ID_HEX"
    }, "latest"],
    "id": 1
  }'
```

Returns: `totalSupplyAssets | totalSupplyShares | totalBorrowAssets | totalBorrowShares | lastUpdate | fee`

Compute current debt:
```
currentDebt = borrowShares × totalBorrowAssets / totalBorrowShares
```

**Step 4: Get token prices and market params from the API**

```bash
curl -s "https://api.lista.org/api/moolah/market/MARKET_ID"
```

Fields to use: `borrowRate`, `loanTokenPrice`, `collateralToken`, `loanToken`, `loanTokenName`, `collateralTokenName`

For the collateral price, use the market's oracle price from the API response (field `oracle` or use `loanTokenPrice` as a reference).

**Step 5: Compute LTV and liquidation price**

```
LTV = currentDebt (in USD) / (collateral × collateralPrice)
Liquidation price = currentDebt / (collateral × LLTV)
Buffer = (collateralPrice - liquidationPrice) / collateralPrice × 100%
```

LLTV is in the market params from the allocation data.

**Step 6: Output the health report**

Use this format:

```
Position Health Report — <wallet_address_short>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<For each active borrow position:>

Market: <collateralSymbol>/<loanSymbol>  <risk_emoji> <SAFE|WARNING|DANGER>
  Collateral:        <amount> <symbol> ($<usd_value>)
  Debt:              <amount> <symbol> ($<usd_value>)
  Current LTV:       <LTV%>  /  LLTV <LLTV%>
  Liquidation price: <collateralSymbol> < $<price> (<buffer%> buffer)
  Last accrual:      <timestamp>

<If no positions found:>
No active borrow positions found for this wallet.
```

Risk levels:
- LTV < 50% of LLTV → 🟢 SAFE
- LTV 50–75% of LLTV → 🟡 WARNING
- LTV > 75% of LLTV → 🔴 DANGER

**Important:** Parse hex values from RPC responses by converting from hex to decimal and dividing by 1e18 (for 18-decimal tokens) or the appropriate decimal count from the market info.
