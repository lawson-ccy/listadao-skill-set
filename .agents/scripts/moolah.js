#!/usr/bin/env node
'use strict';

/**
 * moolah.js — Moolah protocol RPC tool (BSC + ETH Mainnet)
 * No external dependencies required — uses Node.js stdlib only.
 *
 * Usage:
 *   node moolah.js [--chain bsc|eth] position      <marketId> <userAddr>
 *   node moolah.js [--chain bsc|eth] market        <marketId>
 *   node moolah.js [--chain bsc|eth] params        <marketId>
 *   node moolah.js [--chain bsc|eth] oracle-price  <marketId>
 *   node moolah.js [--chain bsc]     user-positions <userAddr>
 *
 * Default chain: bsc
 * All output is JSON on stdout. Errors go to stderr with exit code 1.
 *
 * Selectors (keccak256 of ABI signature, first 4 bytes).
 * Verify with: cast sig "functionName(types)"  [foundry]
 */

const https  = require('https');
const http   = require('http');

// ── Chain config ─────────────────────────────────────────────────────────────

const CHAINS = {
  bsc: {
    moolah: '0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C',
    rpc:    'https://bsc-dataseed.bnbchain.org',
    name:   'BSC Mainnet',
    chainId: 56,
  },
  eth: {
    moolah: '0xf820fB4680712CD7263a0D3D024D5b5aEA82Fd70',
    rpc:    'https://eth.drpc.org',
    name:   'Ethereum Mainnet',
    chainId: 1,
  },
};

const API_URL = 'https://api.lista.org/api/moolah';

// Resolved at startup from --chain flag (default: bsc)
let chain;

// keccak256(sig).slice(0,4) — verified against deployed contract ABI
const SEL = {
  position:         '6565bfb2', // position(bytes32,address)
  market:           '985c8cfe', // market(bytes32)
  idToMarketParams: '64e0b1a0', // idToMarketParams(bytes32)
  oraclePrice:      'a035b1fe', // price()  — Morpho oracle interface
};

// ── ABI encoding ─────────────────────────────────────────────────────────────

/** Pad a hex value (with or without 0x) to 32 bytes (64 hex chars). */
function pad32(hex) {
  return hex.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
}

/** Encode a bytes32 argument (already 32 bytes; just strip 0x and zero-pad). */
function encBytes32(id) {
  const h = id.replace(/^0x/i, '').toLowerCase();
  if (h.length > 64) throw new Error(`bytes32 too long: ${id}`);
  return h.padStart(64, '0');
}

/** Encode an address argument (20 bytes, left-padded to 32). */
function encAddress(addr) {
  const h = addr.replace(/^0x/i, '').toLowerCase();
  if (h.length !== 40) throw new Error(`Invalid address: ${addr}`);
  return h.padStart(64, '0');
}

// ── ABI decoding ─────────────────────────────────────────────────────────────

/** Split a hex string into N × 64-char (32-byte) chunks. */
function chunks(hex) {
  const out = [];
  for (let i = 0; i < hex.length; i += 64) out.push(hex.slice(i, i + 64));
  return out;
}

/** Decode a uint256/uint128 chunk → BigInt. */
function decUint(chunk) { return BigInt('0x' + chunk); }

/** Decode an address chunk (last 20 bytes of 32-byte slot). */
function decAddr(chunk) { return '0x' + chunk.slice(24); }

/** Format BigInt wei (1e18) to human-readable string. */
function toHuman(bn, decimals = 18) {
  const s = bn.toString().padStart(decimals + 1, '0');
  const int  = s.slice(0, s.length - decimals) || '0';
  const frac = s.slice(s.length - decimals).replace(/0+$/, '') || '0';
  return `${int}.${frac}`;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function request(url, opts = {}, body = null) {
  return new Promise((resolve, reject) => {
    const lib  = url.startsWith('https') ? https : http;
    const req  = lib.request(url, { timeout: 10000, ...opts }, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

let _callId = 1;

/**
 * Make an eth_call to the active chain's RPC.
 * @param {string} to       - Contract address
 * @param {string} calldata - Hex calldata (no 0x prefix)
 * @param {string} [rpcUrl] - Override RPC URL (defaults to chain.rpc)
 * Returns the raw hex result (no 0x prefix).
 */
async function ethCall(to, calldata, rpcUrl) {
  const url  = rpcUrl || chain.rpc;
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method:  'eth_call',
    params:  [{ to, data: '0x' + calldata }, 'latest'],
    id:      _callId++,
  });
  const resp = await request(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (resp.error) throw new Error(`RPC error: ${resp.error.message}`);
  return (resp.result || '').replace(/^0x/i, '');
}

/** GET a Lista REST API endpoint. */
async function apiGet(path) {
  const resp = await request(`${API_URL}${path}`);
  if (resp.code !== '000000000') throw new Error(`API error: ${resp.message}`);
  return resp.data;
}

// ── Commands ──────────────────────────────────────────────────────────────────

/**
 * position <marketId> <userAddr>
 * Reads a user's position in one market via Moolah.position(bytes32,address).
 */
async function cmdPosition(marketId, userAddr) {
  if (!marketId || !userAddr) throw new Error('Usage: position <marketId> <userAddr>');
  const calldata = SEL.position + encBytes32(marketId) + encAddress(userAddr);
  const raw = await ethCall(chain.moolah, calldata);
  if (!raw || raw.length < 192) throw new Error('Empty response — check marketId');

  const c = chunks(raw);
  const supplyShares = decUint(c[0]);
  const borrowShares = decUint(c[1]);
  const collateral   = decUint(c[2]);

  return {
    marketId,
    user:         userAddr.toLowerCase(),
    supplyShares: supplyShares.toString(),
    borrowShares: borrowShares.toString(),
    collateral:   collateral.toString(),
    hasSupply:    supplyShares > 0n,
    hasBorrow:    borrowShares > 0n,
    hasCollateral: collateral > 0n,
    hasPosition:  borrowShares > 0n || collateral > 0n,
  };
}

/**
 * market <marketId>
 * Reads current market state via Moolah.market(bytes32).
 */
async function cmdMarket(marketId) {
  if (!marketId) throw new Error('Usage: market <marketId>');
  const calldata = SEL.market + encBytes32(marketId);
  const raw = await ethCall(chain.moolah, calldata);
  if (!raw || raw.length < 384) throw new Error('Empty response — check marketId');

  const c = chunks(raw);
  const totalSupplyAssets = decUint(c[0]);
  const totalSupplyShares = decUint(c[1]);
  const totalBorrowAssets = decUint(c[2]);
  const totalBorrowShares = decUint(c[3]);
  const lastUpdate        = decUint(c[4]);
  const fee               = decUint(c[5]);

  const freeLiquidity = totalSupplyAssets - totalBorrowAssets;
  const utilization   = totalSupplyAssets > 0n
    ? Number(totalBorrowAssets * 10000n / totalSupplyAssets) / 10000
    : 0;

  return {
    marketId,
    totalSupplyAssets: totalSupplyAssets.toString(),
    totalSupplyShares: totalSupplyShares.toString(),
    totalBorrowAssets: totalBorrowAssets.toString(),
    totalBorrowShares: totalBorrowShares.toString(),
    lastUpdate:        Number(lastUpdate),
    lastUpdateIso:     new Date(Number(lastUpdate) * 1000).toISOString(),
    fee:               fee.toString(),
    freeLiquidity:     freeLiquidity.toString(),
    utilization,
    utilizationPct:   `${(utilization * 100).toFixed(2)}%`,
  };
}

/**
 * params <marketId>
 * Reads market parameters via Moolah.idToMarketParams(bytes32).
 * Returns loanToken, collateralToken, oracle, irm, lltv.
 */
async function cmdParams(marketId) {
  if (!marketId) throw new Error('Usage: params <marketId>');
  const calldata = SEL.idToMarketParams + encBytes32(marketId);
  const raw = await ethCall(chain.moolah, calldata);
  if (!raw || raw.length < 320) throw new Error(`Empty response — check marketId or selector 0x64e0b1a0 on ${chain.name}`);

  const c = chunks(raw);
  const lltv = decUint(c[4]);

  return {
    marketId,
    loanToken:       decAddr(c[0]),
    collateralToken: decAddr(c[1]),
    oracle:          decAddr(c[2]),
    irm:             decAddr(c[3]),
    lltv:            lltv.toString(),
    lltvPct:         `${(Number(lltv) / 1e16).toFixed(1)}%`,   // 1e18 scale → %
  };
}

/**
 * oracle-price <marketId>
 * Fetches the oracle price via the oracle contract's price() function.
 * The price is scaled 1e36: collateral_in_loan = collateral × price / 1e36
 */
async function cmdOraclePrice(marketId) {
  if (!marketId) throw new Error('Usage: oracle-price <marketId>');

  const params = await cmdParams(marketId);
  const oracleAddr = params.oracle;

  const raw = await ethCall(oracleAddr, SEL.oraclePrice);
  if (!raw || raw.length < 64) throw new Error(`price() failed on oracle ${oracleAddr}`);

  const price = decUint(chunks(raw)[0]);

  return {
    marketId,
    oracle:      oracleAddr,
    price:       price.toString(),
    note:        'collateral_in_loan_tokens = collateral_amount × price / 1e36',
    lltv:        params.lltv,
    lltvPct:     params.lltvPct,
  };
}

/**
 * user-positions <userAddr>
 * Scans all markets (via Lista API) and returns markets where this user
 * has an active position (borrowShares > 0 or collateral > 0).
 */
async function cmdUserPositions(userAddr) {
  if (!userAddr) throw new Error('Usage: user-positions <userAddr>');

  // 1. Collect all unique market IDs from vault allocations
  const vaultData = await apiGet('/vault/list?pageSize=100');
  const vaults    = vaultData.list;

  const markets = new Map(); // marketId → allocation info
  for (const vault of vaults) {
    const alloc = await apiGet(`/vault/allocation?address=${vault.address}&pageSize=100`);
    for (const m of alloc.list) {
      if (!markets.has(m.id)) markets.set(m.id, m);
    }
  }

  // 2. Check position in each market
  const positions = [];
  for (const [marketId, info] of markets) {
    let pos;
    try {
      pos = await cmdPosition(marketId, userAddr);
    } catch {
      continue; // skip unresponsive markets
    }
    if (!pos.hasPosition) continue;

    // 3. Fetch market state to compute current debt
    let marketState = null;
    try { marketState = await cmdMarket(marketId); } catch {}

    let currentDebt = '0';
    if (marketState && BigInt(pos.borrowShares) > 0n) {
      const borrowShares      = BigInt(pos.borrowShares);
      const totalBorrowAssets = BigInt(marketState.totalBorrowAssets);
      const totalBorrowShares = BigInt(marketState.totalBorrowShares);
      if (totalBorrowShares > 0n)
        currentDebt = (borrowShares * totalBorrowAssets / totalBorrowShares).toString();
    }

    positions.push({
      marketId,
      collateralSymbol: info.collateralSymbol ?? '?',
      loanSymbol:       info.loanSymbol       ?? '?',
      supplyShares:     pos.supplyShares,
      borrowShares:     pos.borrowShares,
      collateral:       pos.collateral,
      currentDebt,
      lastUpdate:       marketState?.lastUpdate ?? null,
      lastUpdateIso:    marketState?.lastUpdateIso ?? null,
    });
  }

  return {
    user:       userAddr.toLowerCase(),
    totalMarkets: markets.size,
    activePositions: positions.length,
    positions,
  };
}

// ── CLI entry point ───────────────────────────────────────────────────────────

const COMMANDS = {
  position:         cmdPosition,
  market:           cmdMarket,
  params:           cmdParams,
  'oracle-price':   cmdOraclePrice,
  'user-positions': cmdUserPositions,
};

const HELP = [
  'Moolah RPC tool — BSC + ETH Mainnet',
  '',
  'Usage: node moolah.js [--chain bsc|eth] <command> [args]',
  '',
  '  position       <marketId> <userAddr>   User position in one market',
  '  market         <marketId>              Market supply/borrow state',
  '  params         <marketId>              Market params (oracle, lltv)',
  '  oracle-price   <marketId>              Oracle price ratio (1e36 scale)',
  '  user-positions <userAddr>              All active positions (BSC only — uses Lista API)',
  '',
  'Chains:',
  '  --chain bsc   BSC Mainnet  — Moolah 0x8F73b65B4caAf64FBA2aF91cC5D4a2A1318E5D8C',
  '  --chain eth   Ethereum     — Moolah 0xf820fB4680712CD7263a0D3D024D5b5aEA82Fd70',
  '',
  'Default: --chain bsc',
  'Output: JSON on stdout. Errors on stderr.',
].join('\n');

// Parse --chain flag from argv, leaving remaining args for the command
const rawArgs = process.argv.slice(2);
let chainKey  = 'bsc';
const cmdArgs = [];

for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--chain' && rawArgs[i + 1]) {
    chainKey = rawArgs[++i].toLowerCase();
  } else {
    cmdArgs.push(rawArgs[i]);
  }
}

if (!CHAINS[chainKey]) {
  process.stderr.write(`Unknown chain "${chainKey}". Valid options: ${Object.keys(CHAINS).join(', ')}\n`);
  process.exit(1);
}

// Set the active chain (used by ethCall and all cmd* functions)
chain = CHAINS[chainKey];

const [cmd, ...args] = cmdArgs;

if (!cmd || !COMMANDS[cmd]) {
  process.stderr.write(HELP + '\n');
  process.exit(1);
}

COMMANDS[cmd](...args)
  .then(result => { console.log(JSON.stringify(result, null, 2)); })
  .catch(err   => { process.stderr.write(`Error: ${err.message}\n`); process.exit(1); });
