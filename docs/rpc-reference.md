# Lista Lending — BSC RPC Reference

**RPC endpoint:** `https://bsc-dataseed.bnbchain.org`
**Moolah contract:** `0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C`
**Chain ID:** 56 (BSC Mainnet)

All calls use `eth_call` with JSON-RPC 2.0.

---

## market(bytes32 id)

Read the current state of a lending market.

**Selector:** `0x985c8cfe`

**Input:** `bytes32 marketId` — the 32-byte market ID

**Calldata construction:**
```
data = "0x985c8cfe" + marketId (32 bytes, no 0x prefix)
```

**Example:**
```bash
curl -s -X POST https://bsc-dataseed.bnbchain.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_call",
    "params": [{
      "to": "0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C",
      "data": "0x985c8cfe<MARKET_ID_HEX_WITHOUT_0x>"
    }, "latest"],
    "id": 1
  }'
```

**Returns:** 6 × uint128 (each padded to 32 bytes):
| Offset | Field | Description |
|---|---|---|
| 0–31 | `totalSupplyAssets` | Total assets supplied (in loan token, 1e18 decimals) |
| 32–63 | `totalSupplyShares` | Total supply shares |
| 64–95 | `totalBorrowAssets` | Total assets borrowed |
| 96–127 | `totalBorrowShares` | Total borrow shares |
| 128–159 | `lastUpdate` | Unix timestamp of last accrual |
| 160–191 | `fee` | Accrued fee shares |

**Parsing example (Python):**
```python
result = "0x" + response["result"][2:]  # strip 0x
vals = [int(result[i:i+64], 16) for i in range(2, len(result), 64)]
totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee = vals
free_liquidity = totalSupplyAssets - totalBorrowAssets
utilization = totalBorrowAssets / totalSupplyAssets if totalSupplyAssets > 0 else 0
```

**Key derived values:**
```
freeLiquidity = totalSupplyAssets - totalBorrowAssets
utilization   = totalBorrowAssets / totalSupplyAssets
```

---

## position(bytes32 id, address user)

Read a user's position in a specific market.

**Selector:** `0x6565bfb2`

**Inputs:**
- `bytes32 id` — market ID (32 bytes)
- `address user` — user wallet, left-padded to 32 bytes

**Calldata construction:**
```
data = "0x6565bfb2"
     + marketId (32 bytes, no 0x prefix)
     + "000000000000000000000000" + userAddress (20 bytes, no 0x prefix)
```

**Example:**
```bash
USER=0xAbCd1234...  # 20-byte address without 0x
MARKET=abc123...    # 32-byte market ID without 0x

curl -s -X POST https://bsc-dataseed.bnbchain.org \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"eth_call\",
    \"params\": [{
      \"to\": \"0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C\",
      \"data\": \"0x6565bfb2${MARKET}000000000000000000000000${USER}\"
    }, \"latest\"],
    \"id\": 1
  }"
```

**Returns:** 3 values (uint256 + uint128 + uint128, each 32 bytes):
| Offset | Field | Description |
|---|---|---|
| 0–31 | `supplyShares` | User's supply shares (uint256) |
| 32–63 | `borrowShares` | User's borrow shares (uint128) |
| 64–95 | `collateral` | User's collateral balance (uint128, in collateral token units) |

**Parsing example:**
```python
result = response["result"][2:]  # strip 0x
supplyShares  = int(result[0:64],   16)
borrowShares  = int(result[64:128],  16)
collateral    = int(result[128:192], 16)

# Check if user has an active borrow position:
has_borrow = borrowShares > 0

# Compute current debt (in loan token units):
# currentDebt = borrowShares * totalBorrowAssets / totalBorrowShares
```

**Computing LTV:**
```python
# Get prices from API /market/{marketId}
collateralPriceUSD = float(market_api["collateralTokenPrice"])
loanPriceUSD       = float(market_api["loanTokenPrice"])

# Normalize to human units (assume 18 decimals — adjust if needed)
collateral_human = collateral / 1e18
currentDebt_human = borrowShares * totalBorrowAssets / totalBorrowShares / 1e18

collateralUSD = collateral_human * collateralPriceUSD
debtUSD       = currentDebt_human * loanPriceUSD

LTV = debtUSD / collateralUSD  # e.g. 0.45 = 45%

# Liquidation price:
liqPrice = debtUSD / (collateral_human * LLTV)
```

---

## Contract Addresses (BSC Mainnet)

| Contract | Address |
|---|---|
| Moolah | `0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C` |
| InterestRateModel | `0xFe7dAe87Ebb11a7BEB9F534BB23267992d9cDe7c` |
| VaultAllocator | `0x9ECF66f016FCaA853FdA24d223bdb4276E5b524a` |
| Liquidator | `0x6a87C15598929B2db22cF68a9a0dDE5Bf297a59a` |
| LendingRevenueDistributor | `0xea55952a51ddd771d6eBc45Bd0B512276dd0b866` |
| LendingFeeRecipient | `0x2E2Eed557FAb1d2E11fEA1E1a23FF8f1b23551f3` |
| MoolahVaultFactory | `0x2a0Cb6401FD3c6196750dc6b46702040761D9671` |
| MoolahVault (WBNB) | `0x57134a64B7cD9F9eb72F8255A671F5Bf2fe3E2d0` |
| MoolahVault (USD1) | `0xfa27f172e0b6ebcEF9c51ABf817E2cb142FbE627` |
| OracleAdaptor | `0x21650E416dC6C89486B2E654c86cC2c36c597b58` |
| Lending TimeLock | `0x2e2807F88C381Cb0CC55c808a751fC1E3fcCbb85` |
| LendingRewardsDistributorV2 | `0x2993E9eA76f5839A20673e1B3cf6666ab5B3aE76` |
| RewardsRouter | `0xCb571b4ac0dB9c64B9ADdD2e6f3d1c7A84E5bfF4` |

---

## Notes

- Most token amounts use **18 decimals** (WBNB, slisBNB, etc.). USDT and USD1 may use 18 decimals on BSC — verify via `decimals()` call if needed.
- Market IDs are `bytes32` keccak hashes of the market params — obtain them from the API `id` field in allocation responses.
- `lastUpdate` is a Unix timestamp in seconds. Compare to `block.timestamp` (or current time) to detect oracle staleness.
