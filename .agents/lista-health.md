---
description: "Check your Lista Lending position health & liquidation risk"
---

You are a Lista Lending position health monitor. Given a wallet address, fetch all open positions from the Moolah contract via RPC, compute LTV ratios and liquidation prices, and produce a health report.

## Data Sources

- **Lista REST API:** `https://api.lista.org/api/moolah`
- **BSC RPC:** `https://bsc-dataseed.bnbchain.org`
- **Moolah contract:** `0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C`

## Contract Functions

### `position(bytes32 id, address user)` — selector `0x6565bfb2`

Returns the user's position in one market.

Calldata:
```
0x6565bfb2
+ marketId_hex (64 chars, 32 bytes, no 0x)
+ 000000000000000000000000 + userAddr_hex (40 chars, 20 bytes, no 0x)
```

Response — 3 × 32 bytes:
```
[0:64]    supplyShares  (uint256)
[64:128]  borrowShares  (uint128)
[128:192] collateral    (uint128, raw token units)
```

### `market(bytes32 id)` — selector `0x985c8cfe`

Returns current market state.

Calldata: `0x985c8cfe` + marketId_hex (64 chars)

Response — 6 × 32 bytes:
```
[0:64]    totalSupplyAssets
[64:128]  totalSupplyShares
[128:192] totalBorrowAssets
[192:256] totalBorrowShares
[256:320] lastUpdate (unix timestamp)
[320:384] fee
```

### `idToMarketParams(bytes32 id)` — selector `0x64e0b1a0`

Returns market parameters including LLTV.

Calldata: `0x64e0b1a0` + marketId_hex (64 chars)

Response — 5 × 32 bytes (addresses right-aligned):
```
[0:64]    loanToken       (address)
[64:128]  collateralToken (address)
[128:192] oracle          (address)
[192:256] irm             (address)
[256:320] lltv            (uint256, scaled 1e18 — e.g. 0.86e18 = 86%)
```

### `price()` on the oracle contract — selector `0xa035b1fe`

Returns the price ratio used for LTV computation, scaled 1e36.

```
collateral_in_loan_tokens = collateral_amount × oracle_price / 1e36
```

No calldata arguments. Call to the oracle address from `idToMarketParams`.

---

## Step-by-Step Instructions

Run this single Python script (stdlib only, no extra packages needed):

```bash
python3 << 'SCRIPT'
import urllib.request, json, sys
from datetime import datetime, timezone

WALLET   = "$ARGUMENTS"          # wallet address from user input
RPC      = "https://bsc-dataseed.bnbchain.org"
CONTRACT = "0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C"
BASE_API = "https://api.lista.org/api/moolah"

# ── helpers ────────────────────────────────────────────────────────────────

def api_get(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read())

def eth_call(to, data, call_id=1):
    body = json.dumps({
        "jsonrpc": "2.0", "method": "eth_call",
        "params": [{"to": to, "data": data}, "latest"],
        "id": call_id
    }).encode()
    req = urllib.request.Request(RPC, body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        resp = json.loads(r.read())
    if "error" in resp:
        return None
    raw = resp["result"]
    return raw[2:] if raw and raw != "0x" else None

def parse_chunks(raw, size=64):
    return [raw[i:i+size] for i in range(0, len(raw), size)]

# ── Step 1: collect all market IDs from vault allocations ──────────────────

print("Fetching markets…")
vaults_resp = api_get(f"{BASE_API}/vault/list?pageSize=100")
vaults = vaults_resp["data"]["list"]          # data is {total, list}

markets = {}   # marketId → allocation info (last vault wins for metadata)
for v in vaults:
    alloc_resp = api_get(
        f"{BASE_API}/vault/allocation?address={v['address']}&pageSize=100"
    )
    for m in alloc_resp["data"]["list"]:
        markets[m["id"]] = m

print(f"Found {len(markets)} unique markets across {len(vaults)} vaults")

# ── Step 2: check user position in every market via RPC ───────────────────

user_hex = WALLET.lower().replace("0x", "").zfill(40)
active_positions = []

for mid, minfo in markets.items():
    mid_hex = mid.replace("0x", "").zfill(64)

    # position(bytes32, address)
    calldata = "0x6565bfb2" + mid_hex + "000000000000000000000000" + user_hex
    raw = eth_call(CONTRACT, calldata)
    if not raw or len(raw) < 192:
        continue

    supply_shares = int(raw[0:64],   16)
    borrow_shares = int(raw[64:128], 16)
    collateral    = int(raw[128:192], 16)

    if borrow_shares == 0 and collateral == 0:
        continue   # no position in this market

    # market(bytes32) — get current debt
    raw_state = eth_call(CONTRACT, "0x985c8cfe" + mid_hex)
    if not raw_state or len(raw_state) < 384:
        continue

    total_supply_assets  = int(raw_state[0:64],    16)
    total_supply_shares  = int(raw_state[64:128],  16)
    total_borrow_assets  = int(raw_state[128:192], 16)
    total_borrow_shares  = int(raw_state[192:256], 16)
    last_update          = int(raw_state[256:320], 16)

    current_debt = (
        borrow_shares * total_borrow_assets // total_borrow_shares
        if total_borrow_shares > 0 else 0
    )

    # idToMarketParams(bytes32) — get oracle address + LLTV
    raw_params = eth_call(CONTRACT, "0x64e0b1a0" + mid_hex)
    oracle_addr = None
    lltv        = None
    if raw_params and len(raw_params) >= 320:
        oracle_addr = "0x" + raw_params[128+24:192]   # 3rd slot, last 20 bytes
        lltv_raw    = int(raw_params[256:320], 16)
        lltv        = lltv_raw / 1e18                  # e.g. 0.86 = 86%

    # oracle.price() — get collateral/loan price ratio (scaled 1e36)
    oracle_price = None
    if oracle_addr:
        raw_price = eth_call(oracle_addr, "0xa035b1fe")
        if raw_price and len(raw_price) >= 64:
            oracle_price = int(raw_price[0:64], 16)   # uint256

    active_positions.append({
        "id":               mid,
        "collateralSymbol": minfo.get("collateralSymbol", "?"),
        "loanSymbol":       minfo.get("loanSymbol", "?"),
        "collateral_raw":   collateral,
        "current_debt_raw": current_debt,
        "supply_shares":    supply_shares,
        "last_update":      last_update,
        "lltv":             lltv,
        "oracle_price":     oracle_price,   # 1e36-scaled
        "loan_token_price": float(minfo.get("price", 0)),
    })

# ── Step 3: compute health metrics and print report ───────────────────────

short_wallet = WALLET[:6] + "…" + WALLET[-4:]
print(f"\nPosition Health Report — {short_wallet}")
print("━" * 48)

if not active_positions:
    print(f"\nNo active positions found for {WALLET}.")
    sys.exit(0)

# Fetch loanTokenPrice from market API if not in allocation data
for pos in active_positions:
    if pos["loan_token_price"] == 0:
        try:
            mdata = api_get(f"{BASE_API}/market/{pos['id']}")["data"]
            pos["loan_token_price"] = float(mdata.get("loanTokenPrice", 0))
        except Exception:
            pass

for pos in active_positions:
    coll_sym  = pos["collateralSymbol"]
    loan_sym  = pos["loanSymbol"]
    coll_raw  = pos["collateral_raw"]
    debt_raw  = pos["current_debt_raw"]
    lltv      = pos["lltv"]
    op        = pos["oracle_price"]
    loan_usd  = pos["loan_token_price"]

    # Convert from raw (1e18) to human units
    coll_human = coll_raw / 1e18
    debt_human = debt_raw / 1e18

    # LTV calculation in loan-token terms using oracle price
    # oracle_price = (collateralPrice / loanPrice) × 1e36
    # collateral_in_loan = collateral × oracle_price / 1e36
    if op and op > 0 and debt_raw > 0:
        coll_in_loan = coll_human * op / 1e36
        ltv = debt_human / coll_in_loan if coll_in_loan > 0 else None
    else:
        coll_in_loan = None
        ltv = None

    # USD values (for display)
    debt_usd = debt_human * loan_usd if loan_usd else None
    coll_usd = coll_in_loan * loan_usd if (coll_in_loan and loan_usd) else None
    coll_price_usd = (op / 1e36 * loan_usd) if (op and loan_usd) else None

    # Liquidation price (collateral token in USD)
    # At liquidation: debt_usd = coll_human × liq_price × lltv
    liq_price = None
    buffer    = None
    if lltv and debt_usd and coll_human > 0:
        liq_price = debt_usd / (coll_human * lltv)
        if coll_price_usd and coll_price_usd > 0:
            buffer = (coll_price_usd - liq_price) / coll_price_usd * 100

    # Risk level
    if ltv is None or lltv is None:
        risk_emoji, risk_label = "⚪", "UNKNOWN"
    elif ltv / lltv < 0.50:
        risk_emoji, risk_label = "🟢", "SAFE"
    elif ltv / lltv < 0.75:
        risk_emoji, risk_label = "🟡", "WARNING"
    else:
        risk_emoji, risk_label = "🔴", "DANGER"

    # Timestamp
    ts = datetime.fromtimestamp(pos["last_update"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC") if pos["last_update"] else "?"

    print(f"\nMarket: {coll_sym}/{loan_sym}  {risk_emoji} {risk_label}")

    if coll_usd:
        print(f"  Collateral:        {coll_human:.4f} {coll_sym}  (${coll_usd:,.2f})")
    else:
        print(f"  Collateral:        {coll_human:.4f} {coll_sym}")

    if debt_usd:
        print(f"  Debt:              {debt_human:.4f} {loan_sym}  (${debt_usd:,.2f})")
    else:
        print(f"  Debt:              {debt_human:.4f} {loan_sym}")

    if ltv is not None:
        lltv_pct = f"{lltv*100:.1f}%" if lltv else "?"
        print(f"  Current LTV:       {ltv*100:.2f}%  /  LLTV {lltv_pct}")
    else:
        print(f"  Current LTV:       n/a")

    if liq_price:
        buf_str = f"  ({buffer:.1f}% buffer)" if buffer is not None else ""
        print(f"  Liquidation price: {coll_sym} < ${liq_price:,.2f}{buf_str}")

    print(f"  Last accrual:      {ts}")

print()
SCRIPT
```

## Output Format

```
Position Health Report — 0xAbCd…5678
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Market: slisBNB/WBNB  🟢 SAFE
  Collateral:        2.50 slisBNB  ($1,521.35)
  Debt:              1.10 WBNB     ($660.05)
  Current LTV:       43.38%  /  LLTV 86.0%
  Liquidation price: slisBNB < $272.40  (55.2% buffer)
  Last accrual:      2025-06-15 08:41 UTC

Market: BTCB/USD1  🟡 WARNING
  Collateral:        0.012 BTCB  ($720.00)
  Debt:              420.00 USD1  ($420.00)
  Current LTV:       58.33%  /  LLTV 91.5%
  Liquidation price: BTCB < $38,200.00  (36.3% buffer)
  Last accrual:      2025-06-15 09:02 UTC
```

## Risk Levels

| Label | Condition |
|---|---|
| 🟢 SAFE    | LTV < 50% of LLTV |
| 🟡 WARNING | LTV 50–75% of LLTV |
| 🔴 DANGER  | LTV > 75% of LLTV |
| ⚪ UNKNOWN | Price or LLTV data unavailable |

## Notes

- `$ARGUMENTS` in the script is replaced with the wallet address the user provides.
- All token amounts assume **18 decimals**. If a token uses fewer (e.g. USDT 6 dec on some chains), adjust the divisor accordingly — check `decimals()` via eth_call if in doubt.
- A position is active if `borrowShares > 0` **or** `collateral > 0`. Supply-only positions (no borrow) are included but show zero debt.
- The oracle `price()` follows the Morpho price convention: `collateral_amount × price / 1e36 = loan_token_equivalent`. This normalizes for token decimal differences automatically.
- LLTV from `idToMarketParams` is a `uint256` scaled by `1e18` (e.g. `860000000000000000` = 86%).
