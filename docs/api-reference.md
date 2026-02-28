# Lista Lending REST API Reference

Base URL: `https://api.lista.org/api/moolah`

All responses return `{ code, message, data }`. Success = `code == "000000000"`.

**Response shape:**
- List endpoints (`/vault/list`, `/vault/allocation`): `data` is `{ total: number, list: [...] }` — iterate `data.list`
- Single-item endpoint (`/market/{id}`): `data` is the market object directly

---

## GET /vault/list

List all vaults, optionally filtered by zone.

**Query params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `zone` | int | No | 0=Classic, 1=Alpha, 4=Aster |
| `page` | int | No | Page number (starts at 1) |
| `pageSize` | int | No | Items per page (default 100) |

**Example:**
```bash
curl "https://api.lista.org/api/moolah/vault/list?pageSize=100"
curl "https://api.lista.org/api/moolah/vault/list?zone=0&pageSize=100"
```

**Response fields per vault:**
| Field | Type | Description |
|---|---|---|
| `address` | string | Vault contract address |
| `name` | string | Vault display name |
| `apy` | number | Base supply APY (decimal: 0.087 = 8.7%) |
| `emissionApy` | number | LISTA token emission APY |
| `emissionEnabled` | bool | Whether emission is active |
| `deposits` | string | Total deposits in raw token units |
| `depositsUsd` | string | Total deposits in USD |
| `asset` | string | Token address users deposit |
| `assetSymbol` | string | Token symbol (e.g. WBNB, USD1) |
| `zone` | int | 0=Classic, 1=Alpha, 4=Aster |
| `utilization` | number | Current utilization ratio |
| `fee` | number | Performance fee rate |
| `collaterals` | array | List of accepted collateral types |

---

## GET /vault/allocation

Get a vault's fund allocation across its markets.

**Query params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `address` | string | **Yes** | Vault contract address |
| `page` | int | No | Page number |
| `pageSize` | int | No | Items per page (default 100) |

**Example:**
```bash
curl "https://api.lista.org/api/moolah/vault/allocation?address=0x57134a64B7cD9F9eb72F8255A671F5Bf2fe3E2d0&pageSize=100"
```

**Response fields per market allocation:**
| Field | Type | Description |
|---|---|---|
| `id` | string | Market ID (bytes32 hex) |
| `name` | string | Market display name |
| `collateralSymbol` | string | Collateral token symbol |
| `loanSymbol` | string | Loan token symbol |
| `allocation` | number | Fraction of vault in this market (0–1) |
| `totalSupply` | string | Total supplied to this market |
| `cap` | string | Supply cap for this market |
| `liquidity` | string | Available liquidity |
| `supplyApy` | number | Supply APY (decimal) |
| `utilization` | number | Utilization ratio |
| `borrowRate` | number | Borrow rate (decimal) |
| `zone` | int | 0=Classic, 1=Alpha, 4=Aster |
| `smartCollateralConfig` | object/null | Non-null = Smart Lending market |
| `termType` | string/null | "fixed" for fixed-rate markets |
| `rewards` | object/null | Emission reward details |

---

## GET /market/{marketId}

Get full details for a specific market.

**Path param:** `marketId` — the market ID (bytes32 hex string)

**Example:**
```bash
curl "https://api.lista.org/api/moolah/market/0x..."
```

**Response fields:**
| Field | Type | Description |
|---|---|---|
| `marketId` | string | Market ID |
| `borrowRate` | number | Current borrow rate (decimal) |
| `supplyApy` | number | Supply APY (decimal) |
| `loanToken` | string | Loan token address |
| `loanTokenName` | string | Loan token name |
| `loanTokenPrice` | string | Current loan token price (USD) |
| `collateralToken` | string | Collateral token address |
| `collateralTokenName` | string | Collateral token name |
| `zone` | int | 0=Classic, 1=Alpha, 4=Aster |
| `oracle` | object | Oracle configuration |
| `collateralOracles` | array | Collateral oracle chain |
| `loanOracles` | array | Loan token oracle chain |
| `smartCollateralConfig` | object/null | Smart Lending config |
| `termType` | string/null | "fixed" = fixed rate |
| `terms` | object/null | Fixed term details |
| `rewards` | object/null | Active emission rewards |
| `curator` | string | Vault curator address |
| `performanceFeeRate` | number | Performance fee (decimal) |
