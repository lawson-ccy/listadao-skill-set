# Lista Lending Agent Skills

Claude Code agent skills for [Lista Lending](https://lista.org/lending) — daily DeFi workflows on BSC, powered by live on-chain data.

Install via openclaw and use these slash commands in any Claude Code session.

## Skills

| Command | Description |
|---|---|
| `/lista-health <wallet>` | Check your lending position health & liquidation risk |
| `/lista-yield [asset]` | Scan best yield opportunities across all Lista vaults |
| `/lista-loop <asset> <amount> [loops]` | Calculate optimal leverage loop strategy & net APY |
| `/lista-market` | Daily protocol digest: TVL, utilization, top vaults |
| `/lista-risk [wallet]` | Protocol-wide risk monitor: near-liquidation, oracle health |
| `/lista-vault-builder [token] [risk]` | Build a custom MoolahVault strategy with market queue recommendations |

## Installation

```bash
# Via openclaw (once published)
openclaw install @lista-dao/lending-skills

# Manual installation — copy commands to your Claude Code config
cp .claude/commands/*.md ~/.claude/commands/
```

## Usage Examples

```
/lista-health 0xYourWalletAddress
/lista-yield BNB
/lista-yield USD1
/lista-loop slisBNB BNB 10
/lista-loop BTCB BNB 0.5 3
/lista-market
/lista-risk
/lista-risk 0xYourWalletAddress
/lista-vault-builder WBNB balanced
/lista-vault-builder USD1 conservative
```

## How It Works

Each skill is a markdown prompt file that instructs Claude to:
1. Call the **Lista REST API** (`https://api.lista.org/api/moolah`) for vault and market data
2. Call the **BSC RPC** (`https://bsc-dataseed.bnbchain.org`) for user-specific on-chain position data
3. Perform calculations and format results into a clean report

No backend infrastructure required — skills work out of the box using Claude's Bash tool.

## Data Sources

- **Lista REST API:** `https://api.lista.org/api/moolah`
- **BSC RPC:** `https://bsc-dataseed.bnbchain.org`
- **Smart Contracts:** See [docs/rpc-reference.md](docs/rpc-reference.md) for all contract addresses

## Docs

- [API Reference](docs/api-reference.md) — REST endpoints with curl examples
- [RPC Reference](docs/rpc-reference.md) — Moolah ABI, eth_call examples, contract addresses

## About Lista Lending

Lista Lending (powered by the Moolah protocol) is a permissionless lending protocol on BNB Smart Chain. It features:
- **Isolated markets** — each market has its own collateral, oracle, and risk params
- **Curated vaults** — ERC4626 vaults that aggregate capital across markets
- **Smart Lending** — collateral doubles as DEX liquidity, earning trading fees
- **Fixed Rate markets** — via PT token integrations
- **Alpha / Aster Zones** — curated markets for emerging and partner assets

Learn more: [docs.bsc.lista.org](https://docs.bsc.lista.org/lista-lending/smart-contract)
