---
name: lista-report
description: "Generates a bilingual (English / 中文) Moolah position report for one or more wallet addresses. Shows collateral, debt, net equity, LTV, liquidation price, and tailored strategy recommendations per position. Ask for language before running. Use when the user provides addresses and asks for a position overview, portfolio summary, report, or strategy advice."
---

# Lista Lending — Position Report

Generate a structured position report across one or more wallet addresses on Moolah.

**RPC script:** `../.agents/scripts/moolah.js` (Node.js stdlib, no packages needed)

---

## BEFORE ANYTHING ELSE — Ask for language

Do NOT run any commands until the user has answered this question:

> Which language should I use for the report?
> 請問報告以哪種語言生成？
>   A) English
>   B) 中文（繁體）

Remember the answer and use it for all output generated below.

---

## Step 1 — Collect addresses

Accept one or more wallet addresses from the user — comma-separated, space-separated, or line-by-line. Strip extra whitespace and deduplicate. Process them in the order received.

---

## Step 2 — Fetch positions for each address

Run once per address:

```bash
node ../.agents/scripts/moolah.js user-positions <address>
```

Returns JSON with `positions[]`. Each entry has:

| Field | Description |
|---|---|
| `marketId` | 32-byte market ID |
| `collateralSymbol` / `loanSymbol` | Token symbols |
| `collateral` | Raw collateral amount (1e18 units) |
| `borrowShares` | User borrow shares (raw) |
| `supplyShares` | User supply shares (raw) |
| `currentDebt` | Current debt in loan token raw units (pre-computed) |
| `lastUpdateIso` | Last interest accrual timestamp |

If `positions` is empty → the address has no active positions on Moolah.

---

## Step 3 — Get oracle price and loan token USD price (per unique market)

Deduplicate marketIds across all addresses. For each unique active marketId:

```bash
# Oracle price (1e36-scaled). May revert for some oracle types — handle gracefully.
node ../.agents/scripts/moolah.js oracle-price <marketId>
# Returns: { price, lltv, lltvPct }

# Loan token USD price from Lista API
curl -s "https://api.lista.org/api/moolah/market/<marketId>" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['loanTokenPrice'])"
```

If `oracle-price` reverts or fails, mark collateral USD value as `N/A` and omit USD-dependent rows (collateral USD, net equity, liquidation price, buffer).

---

## Step 4 — Compute metrics per position

All raw values are 1e18 integers. Use floating point for display only.

```
collateral_f       = collateral / 1e18
currentDebt_f      = currentDebt / 1e18
oraclePrice_f      = oraclePrice / 1e36              (from oracle-price result)
loanTokenUSD       = loanTokenPrice                  (float, from API)
lltvF              = lltv / 1e18                     (e.g. 0.86)

collateral_in_loan = collateral_f × oraclePrice_f    (in loan token units)
collateralPriceUSD = oraclePrice_f × loanTokenUSD    (USD per 1 collateral token)
collateralUSD      = collateral_f × collateralPriceUSD
debtUSD            = currentDebt_f × loanTokenUSD
netEquityUSD       = collateralUSD − debtUSD

LTV                = currentDebt_f / collateral_in_loan
liqPriceUSD        = debtUSD / (collateral_f × lltvF)
buffer             = (collateralPriceUSD − liqPriceUSD) / collateralPriceUSD
```

**Risk level:**
- 🟢 SAFE     — LTV / lltvF < 50%
- 🟡 WARNING  — 50% ≤ LTV / lltvF < 75%
- 🔴 DANGER   — LTV / lltvF ≥ 75%

**Supply-only position** (supplyShares > 0, borrowShares = 0): skip debt, LTV, and liquidation price rows.

---

## Step 5 — Position recommendations

After computing metrics for each active position, generate 1–3 concise strategy suggestions tailored to the actual numbers. Use the rules below as triggers.

**Risk reduction (high LTV):**
- LTV/LLTV ≥ 75% (DANGER): Strongly recommend repaying debt or adding collateral immediately. Show exact amounts needed to reach 60% LTV.
- LTV/LLTV 50–75% (WARNING): Suggest partial repayment or collateral top-up to reach a safer LTV. Show target amounts.
- Buffer < 15%: Flag that a small price drop could trigger liquidation; recommend increasing buffer.

**Yield enhancement (low LTV):**
- LTV/LLTV < 30%: Collateral is under-utilized. Suggest borrowing more against existing collateral to deploy into Lista yield vaults (`/lista-yield` for current rates), or looping (`/lista-loop`).
- Supply-only position (no borrow): Mention that the user could borrow against their supply to amplify yield.

**General:**
- Always show the current borrow rate context (from `oracle-price` lltv info or market utilization if available).
- If no positions exist for an address, no recommendations needed.
- Keep recommendations factual and numeric — avoid vague language.

### English recommendation format

```
Recommendations for 0xAbCd…5678:
  1. [DANGER] Repay ~5,000 U to bring LTV to 60% and restore a safe buffer.
  2. Use /lista-yield to find the best yield for idle USDT if you reduce debt.
```

### 中文建議格式

```
地址 0xAbCd…5678 的持倉建議：
  1. 【高風險】建議償還約 5,000 U，將 LTV 降至 60%，恢復安全緩衝。
  2. 若有閒置 USDT，可使用 /lista-yield 查看最佳存款收益。
```

---

## Step 6 — Generate report

Use plain text only — no markdown bold/italics. Intended for Telegram/Discord paste.
Numbers: comma thousands separator, 2 decimal places for token amounts, rounded to nearest dollar for USD.

### English format

```
Lista Lending — Position Report
Generated: <YYYY-MM-DD HH:MM> UTC  |  BSC Mainnet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Address 1: 0xAbCd…5678
────────────────────────────────────────────────
Market: BTCB / U  🟢 SAFE
  Collateral:     398.85 BTCB  (~$38,250,000)
  Debt:           18,020,988.00 U  (~$18,020,988)
  Net equity:                       ~$20,229,012
  LTV:            47.1%  /  LLTV 86.0%
  Liq. price:     BTCB < $45,200  (8.2% buffer)
  Last accrual:   2026-03-01 03:12 UTC

[If no active positions:]
  No active positions.

Address 1 summary: 1 active position  |  Net equity ~$20.2M

Recommendations for Address 1:
  1. LTV is comfortable. Collateral is under-utilized — consider /lista-loop to amplify yield.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[If multiple addresses, repeat the block above for each, then:]

Total: <N> addresses  |  <M> active positions  |  Combined net equity ~$X

Data: api.lista.org  |  BSC Mainnet
```

### 中文格式

```
Lista Lending — 持倉報告
產生時間：<YYYY-MM-DD HH:MM> UTC  |  BSC 主網
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

地址 1：0xAbCd…5678
────────────────────────────────────────────────
市場：BTCB / U  🟢 安全
  抵押品：    398.85 BTCB  (約 $38,250,000)
  負債：      18,020,988.00 U  (約 $18,020,988)
  淨資產：                      約 $20,229,012
  LTV：      47.1%  /  清算線 86.0%
  清算價格：  BTCB < $45,200  (緩衝 8.2%)
  最後結算：  2026-03-01 03:12 UTC

[若無活躍持倉：]
  無活躍持倉。

地址 1 小結：1 個活躍持倉  |  淨資產約 $20.2M

地址 1 的持倉建議：
  1. LTV 尚在安全範圍，抵押品尚有餘裕，可考慮使用 /lista-loop 提高槓桿收益。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[若有多個地址，重複以上區塊，最後加總：]

總計：<N> 個地址  |  <M> 個活躍持倉  |  合計淨資產約 $X

資料來源：api.lista.org  |  BSC 主網
```
