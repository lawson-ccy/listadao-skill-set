---
name: lista-market
description: "Generates a daily Lista Lending protocol digest covering total TVL, top vaults, high-utilization markets, Smart Lending pools, and Fixed Rate markets on BSC. Use when asked for a market overview, protocol stats, daily digest, or summary of Lista Lending activity."
---

# Lista Lending — Daily Market Digest

Fetch protocol-wide stats and produce a shareable digest.

**API base:** `https://api.lista.org/api/moolah`

---

## BEFORE ANYTHING ELSE — Ask for language

Do NOT run any commands until the user has answered this question:

> Which language should I use for the output?
> 請問輸出以哪種語言生成？
>   1) English
>   2) 简体中文
>   3) 繁體中文
>   4) Other (specify)

**Language handling rules:**
- **1 / English** — use the English format template exactly.
- **2 / 简体中文** — use the 繁體中文 format template, then convert all Traditional Chinese characters to Simplified Chinese. Do NOT alter any numbers, symbols, separators, or field layout.
- **3 / 繁體中文** — use the 繁體中文 format template exactly.
- **4 / Other** — translate all label text into the requested language. Keep every separator line, number format, and indentation identical to the English template. Do NOT add bullet points or reformat rows.

Remember the answer and use it for all output generated below.

---

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

---

## Generate Output

**STRICT FORMAT RULES — follow exactly, no exceptions:**
- Copy the template below character-for-character, including separator lines (━━━) and `- - - - -` dividers.
- Use the exact field labels shown. Do NOT rename, reorder, or omit any field.
- Plain text only — no markdown bold/italics. Intended for Telegram/Discord paste.
- Note: In the templates below, ＄ represents $. Use the regular $ in actual output.

### English format

```
📊 Lista Lending — Daily Market Digest
<DATE> UTC
━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Protocol Overview
   Total TVL:        ＄42.1M
   Est. Borrows:     ＄18.9M  |  Overall Util: 44.9%
   Active Vaults:    12 Classic  |  4 Alpha  |  2 Aster

- - - - -

💰 Top Vaults by TVL
1. WBNB Vault  (WBNB)
   TVL: ＄18.2M  |  APY: 4.2% + 2.1% LISTA = 6.3%  |  Util: 52%

- - - - -

🔥 High-Utilization Markets (>85%)
   slisBNB/WBNB — 92%  |  Borrow rate: 8.4%  [rate rising]

⚠️  Near Supply Cap
   PT-slisBNBx/WBNB — 94% of cap used  (＄240K remaining)

⚡ Smart Lending  |  🔒 Fixed Rate
   slisBNB/WBNB — DEX fees active
   PT-slisBNBx/WBNB — 5.8% fixed

━━━━━━━━━━━━━━━━━━━━━━━━━

💡 <1–2 insight sentences about current market state>

Data: api.lista.org  |  BSC Mainnet
```

### 繁體中文格式

```
📊 Lista Lending — 每日市場摘要
<DATE> UTC
━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 協議總覽
   總 TVL：      ＄42.1M
   預估借款：    ＄18.9M  |  整體利用率：44.9%
   活躍金庫：    12 Classic  |  4 Alpha  |  2 Aster

- - - - -

💰 TVL 最高金庫
1. WBNB 金庫  (WBNB)
   TVL：＄18.2M  |  年化：4.2% + 2.1% LISTA = 6.3%  |  利用率：52%

- - - - -

🔥 高利用率市場（>85%）
   slisBNB/WBNB — 92%  |  借款利率：8.4%  [利率上升中]

⚠️  接近供給上限
   PT-slisBNBx/WBNB — 已用 94%（剩餘 ＄240K）

⚡ Smart Lending  |  🔒 固定利率
   slisBNB/WBNB — DEX 手續費啟用
   PT-slisBNBx/WBNB — 5.8% 固定

━━━━━━━━━━━━━━━━━━━━━━━━━

💡 <1-2 句關於當前市場狀況的見解>

資料來源：api.lista.org  |  BSC 主網
```
