import { UserError } from "./core";

export const CHAINS: Record<string, { id: number; rpc: string; native: string; tokens: Record<string, [string, number]> }> = {
  base: { id: 8453, rpc: "https://base-rpc.publicnode.com", native: "ETH", tokens: {
    USDC: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6], USDbC: ["0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", 6], WETH: ["0x4200000000000000000000000000000000000006", 18],
    DAI: ["0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", 18], cbBTC: ["0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", 8], EURC: ["0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42", 6], AERO: ["0x940181a94A35A4569E4529A3CDfB74e38FD98631", 18] } },
  ethereum: { id: 1, rpc: "https://ethereum-rpc.publicnode.com", native: "ETH", tokens: {
    USDC: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6], USDT: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", 6], DAI: ["0x6B175474E89094C44Da98b954EedeAC495271d0F", 18],
    WETH: ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 18], WBTC: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", 8], EURC: ["0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c", 6] } },
  arbitrum: { id: 42161, rpc: "https://arbitrum-one-rpc.publicnode.com", native: "ETH", tokens: {
    USDC: ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 6], USDT: ["0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", 6], WETH: ["0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", 18], ARB: ["0x912CE59144191C1204E64559FE8253a0e49E6548", 18] } },
  optimism: { id: 10, rpc: "https://optimism-rpc.publicnode.com", native: "ETH", tokens: {
    USDC: ["0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", 6], USDT: ["0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", 6], WETH: ["0x4200000000000000000000000000000000000006", 18], OP: ["0x4200000000000000000000000000000000000042", 18] } },
  polygon: { id: 137, rpc: "https://polygon-bor-rpc.publicnode.com", native: "POL", tokens: {
    USDC: ["0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", 6], USDT: ["0xc2132D05D31c914a87C6611C10748AEb04B58e8F", 6], WETH: ["0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", 18] } },
};
export const ADDR = /^0x[0-9a-fA-F]{40}$/; export const HASH = /^0x[0-9a-fA-F]{64}$/;
export function chainOf(c?: string) { const k = (c || "base").toLowerCase(); const ch = CHAINS[k]; if (!ch) throw new UserError(`unsupported chain; use one of ${Object.keys(CHAINS).join(",")}`, 400); return [k, ch] as const; }

const POOL: Record<string, string[]> = {
  base: ["https://base-mainnet.public.blastapi.io", "https://gateway.tenderly.co/public/base", "https://base-pokt.nodies.app", "https://api.zan.top/base-mainnet", "https://base-rpc.publicnode.com", "https://mainnet.base.org"],
  ethereum: ["https://eth-mainnet.public.blastapi.io", "https://gateway.tenderly.co/public/mainnet", "https://eth-pokt.nodies.app", "https://api.zan.top/eth-mainnet", "https://ethereum-rpc.publicnode.com"],
  arbitrum: ["https://arbitrum-one.public.blastapi.io", "https://gateway.tenderly.co/public/arbitrum", "https://arb-pokt.nodies.app", "https://api.zan.top/arb-one", "https://arb1.arbitrum.io/rpc"],
  optimism: ["https://optimism-mainnet.public.blastapi.io", "https://gateway.tenderly.co/public/optimism", "https://op-pokt.nodies.app", "https://api.zan.top/opt-mainnet", "https://mainnet.optimism.io"],
  polygon: ["https://polygon-mainnet.public.blastapi.io", "https://gateway.tenderly.co/public/polygon", "https://polygon-pokt.nodies.app", "https://api.zan.top/polygon-mainnet", "https://polygon-rpc.com"],
};
const FALLBACK: Record<string, string[]> = {};
for (const [k, ch] of Object.entries(CHAINS)) { FALLBACK[ch.rpc] = POOL[k]; }
export async function rpcBatch(url: string, calls: [string, any[]][]) {
  let last: any; const errs: string[] = [];
  for (const u of (FALLBACK[url] || [url])) { try { const out = await rpcOnce(u, calls); if (out.filter((x) => x !== undefined).length === calls.length) return out; last = new Error("partial batch"); } catch (e: any) { last = e; errs.push(`${new URL(u).host}: ${String(e?.message || e).slice(0, 60)}`); } }
  throw new Error(`all RPCs failed: ${errs.join("; ")}`);
}
async function rpcOnce(url: string, calls: [string, any[]][]) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(calls.map(([method, params], id) => ({ jsonrpc: "2.0", id, method, params }))) });
  if (!r.ok) throw new Error(`rpc ${r.status}`);
  const j: any = await r.json(); if (!Array.isArray(j)) throw new Error("no batch support");
  const out: any[] = new Array(calls.length).fill(undefined);
  for (const x of j) { if (x.error && x.error.code !== 3 && !/revert/i.test(x.error.message || "")) throw new Error(`rpc error ${String(x.error.message).slice(0, 40)}`); out[x.id] = x.error ? null : x.result; }
  return out;
}
export const pad = (a: string) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
export const big = (h: any) => (h && h !== "0x" ? BigInt(h) : 0n);
export const fmt = (v: bigint, d: number) => { const s = v.toString().padStart(d + 1, "0"); const i = s.slice(0, s.length - d), f = s.slice(s.length - d).replace(/0+$/, ""); return f ? `${i}.${f}` : i; };
export function decStr(hex: string | null) {
  if (!hex || hex === "0x") return null;
  try { const b = hex.slice(2); if (b.length >= 128) { const len = Number(BigInt("0x" + b.slice(64, 128))); const data = b.slice(128, 128 + len * 2);
      return new TextDecoder().decode(Uint8Array.from(data.match(/../g) || [], (x) => parseInt(x, 16))).replace(/\0/g, "") || null; }
    return new TextDecoder().decode(Uint8Array.from(b.match(/../g) || [], (x) => parseInt(x, 16))).replace(/\0/g, "").trim() || null; } catch { return null; }
}

export async function wallet(p: { address: string; chain?: string; tokens?: string }) {
  if (!ADDR.test(p.address || "")) throw new UserError("address must be a 0x… 40-hex EVM address", 400);
  const [name, ch] = chainOf(p.chain);
  const toks: [string, string, number][] = Object.entries(ch.tokens).map(([s, [a, d]]) => [s, a, d]);
  for (const t of (p.tokens || "").split(",").map((s) => s.trim()).filter((s) => ADDR.test(s)).slice(0, 10)) toks.push(["custom", t, -1]);
  const calls: [string, any[]][] = [["eth_getBalance", [p.address, "latest"]], ["eth_getTransactionCount", [p.address, "latest"]], ["eth_getCode", [p.address, "latest"]], ["eth_blockNumber", []]];
  for (const [, a] of toks) calls.push(["eth_call", [{ to: a, data: "0x70a08231" + pad(p.address) }, "latest"]]);
  const extra: [string, any[]][] = toks.filter((t) => t[2] < 0).flatMap(([, a]) => [["eth_call", [{ to: a, data: "0x313ce567" }, "latest"]], ["eth_call", [{ to: a, data: "0x95d89b41" }, "latest"]]] as [string, any[]][]);
  const res = await rpcBatch(ch.rpc, [...calls, ...extra]);
  let ei = calls.length; const balances: any[] = [];
  toks.forEach(([sym, a, d], i) => { let dec = d, s = sym; if (d < 0) { dec = Number(big(res[ei++])) || 18; s = decStr(res[ei++]) || "UNKNOWN"; }
    const raw = big(res[4 + i]); if (raw > 0n || d < 0) balances.push({ symbol: s, token: a, balance: fmt(raw, dec), raw: raw.toString(), decimals: dec }); });
  const code = res[2] || "0x";
  return { chain: name, chain_id: ch.id, address: p.address, block: Number(big(res[3])), native: { symbol: ch.native, balance: fmt(big(res[0]), 18), raw: big(res[0]).toString() },
    nonce: Number(big(res[1])), is_contract: code.length > 2, code_bytes: (code.length - 2) / 2, tokens: balances, tokens_checked: toks.map((t) => t[0]),
    source: "public EVM JSON-RPC (single batch request)" };
}

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export async function tx(p: { hash: string; chain?: string }) {
  if (!HASH.test(p.hash || "")) throw new UserError("hash must be a 0x… 64-hex transaction hash", 400);
  const [name, ch] = chainOf(p.chain);
  const [t, r, head] = await rpcBatch(ch.rpc, [["eth_getTransactionByHash", [p.hash]], ["eth_getTransactionReceipt", [p.hash]], ["eth_blockNumber", []]]);
  if (!t) throw new UserError(`transaction not found on ${name}; try chain=${Object.keys(CHAINS).filter((k) => k !== name).join("|")}`, 404);
  const known: Record<string, [string, number]> = {}; for (const [s, [a, d]] of Object.entries(ch.tokens)) known[a.toLowerCase()] = [s, d];
  const transfers = (r?.logs || []).filter((l: any) => l.topics?.[0] === TRANSFER && l.topics.length === 3).slice(0, 50).map((l: any) => {
    const k = known[l.address.toLowerCase()]; const raw = big(l.data);
    return { token: l.address, symbol: k?.[0] || null, from: "0x" + l.topics[1].slice(26), to: "0x" + l.topics[2].slice(26), amount: k ? fmt(raw, k[1]) : null, raw: raw.toString() }; });
  const gasUsed = big(r?.gasUsed), price = big(r?.effectiveGasPrice || t.gasPrice);
  const bn = t.blockNumber ? Number(big(t.blockNumber)) : null;
  let ts: string | null = null;
  if (bn !== null) { try { const [b] = await rpcBatch(ch.rpc, [["eth_getBlockByNumber", [t.blockNumber, false]]]); ts = b ? new Date(Number(big(b.timestamp)) * 1000).toISOString() : null; } catch {} }
  return { chain: name, chain_id: ch.id, hash: p.hash, status: !r ? "pending" : r.status === "0x1" ? "success" : "reverted", block: bn, timestamp: ts,
    confirmations: bn !== null ? Number(big(head)) - bn + 1 : 0, from: t.from, to: t.to, contract_created: r?.contractAddress || null,
    value_native: fmt(big(t.value), 18), method_selector: t.input && t.input.length >= 10 ? t.input.slice(0, 10) : null, nonce: Number(big(t.nonce)),
    gas_used: gasUsed.toString(), effective_gas_price_gwei: fmt(price, 9), fee_native: fmt(gasUsed * price, 18), logs_count: r?.logs?.length || 0, erc20_transfers: transfers,
    source: "public EVM JSON-RPC" };
}

const IMPL = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", ADMIN = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
export async function tokenCheck(p: { address: string; chain?: string }) {
  if (!ADDR.test(p.address || "")) throw new UserError("address must be a 0x… token contract address", 400);
  const [name, ch] = chainOf(p.chain);
  const sel = (s: string) => ["eth_call", [{ to: p.address, data: s }, "latest"]] as [string, any[]];
  const [code, nm, sym, dec, sup, owner, impl0, admin, zos, dead] = await rpcBatch(ch.rpc, [["eth_getCode", [p.address, "latest"]], sel("0x06fdde03"), sel("0x95d89b41"), sel("0x313ce567"), sel("0x18160ddd"), sel("0x8da5cb5b"),
    ["eth_getStorageAt", [p.address, IMPL, "latest"]], ["eth_getStorageAt", [p.address, ADMIN, "latest"]], ["eth_getStorageAt", [p.address, "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3", "latest"]], ["eth_call", [{ to: p.address, data: "0x70a08231" + pad("0x000000000000000000000000000000000000dEaD") }, "latest"]]]);
  if (!code || code === "0x") throw new UserError(`no contract at ${p.address} on ${name}`, 404);
  const decimals = dec ? Number(big(dec)) : null; const supply = big(sup);
  const ownerAddr = owner && owner.length >= 66 ? "0x" + owner.slice(26, 66) : null;
  const impl = impl0 && big(impl0) !== 0n ? impl0 : zos;
  const implAddr = impl && big(impl) !== 0n ? "0x" + impl.slice(26) : null;
  let market: any = null; let marketErr: string | null = null;
  try {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/${name}/${p.address}`, { headers: { accept: "application/json", "user-agent": "AgentReader/1.3 (+https://api.axiomworks.co.uk)" } });
    if (!r.ok) throw new Error(`dexscreener ${r.status}`);
    const j: any = await r.json();
    const pairs = (Array.isArray(j) ? j : []).sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    if (pairs.length) { const top = pairs[0]; market = { price_usd: top.priceUsd ? Number(top.priceUsd) : null, liquidity_usd_top_pair: top.liquidity?.usd ?? null,
      liquidity_usd_total: Math.round(pairs.reduce((s: number, x: any) => s + (x.liquidity?.usd || 0), 0)), volume_24h_usd: top.volume?.h24 ?? null, fdv_usd: top.fdv ?? null,
      price_change_24h_pct: top.priceChange?.h24 ?? null, pairs_count: pairs.length, top_dex: top.dexId, top_pair: top.pairAddress,
      pair_created: top.pairCreatedAt ? new Date(top.pairCreatedAt).toISOString() : null, txns_24h: top.txns?.h24 || null, url: top.url, source: "dexscreener" } }
  } catch (e: any) { marketErr = String(e?.message || e); }
  if (!market) { try {
    const gt: Record<string, string> = { base: "base", ethereum: "eth", arbitrum: "arbitrum", optimism: "optimism", polygon: "polygon_pos" };
    const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/${gt[name]}/tokens/${p.address}?include=top_pools`, { headers: { accept: "application/json" } });
    if (r.ok) { const j: any = await r.json(); const a = j.data?.attributes || {}; const pools = (j.included || []).map((x: any) => x.attributes);
      if (a.total_reserve_in_usd || pools.length) { const top = pools[0] || {}; market = { price_usd: a.price_usd ? Number(a.price_usd) : null, liquidity_usd_total: Math.round(Number(a.total_reserve_in_usd || 0)),
        liquidity_usd_top_pair: top.reserve_in_usd ? Number(top.reserve_in_usd) : null, volume_24h_usd: a.volume_usd?.h24 ? Number(a.volume_usd.h24) : null, fdv_usd: a.fdv_usd ? Number(a.fdv_usd) : null,
        price_change_24h_pct: top.price_change_percentage?.h24 ? Number(top.price_change_percentage.h24) : null, pairs_count: pools.length, top_pair: top.address || null,
        pair_created: top.pool_created_at || null, txns_24h: top.transactions?.h24 || null, source: "geckoterminal" }; marketErr = null; }
      else if (marketErr) { /* dexscreener failed, gecko says no pools */ marketErr = null; } }
    else marketErr = `${marketErr}; geckoterminal ${r.status}`;
  } catch (e: any) { marketErr = `${marketErr}; geckoterminal ${String(e?.message || e)}`; } }
  // On-chain fallback/complement: Uniswap V3 pools vs WETH & USDC (independent of rate-limited market APIs)
  let onchain_pools: any[] = [];
  try {
    const FACT: Record<string, string> = { base: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD", ethereum: "0x1F98431c8aD98523631AE4a59f267346ea31F984", arbitrum: "0x1F98431c8aD98523631AE4a59f267346ea31F984", optimism: "0x1F98431c8aD98523631AE4a59f267346ea31F984", polygon: "0x1F98431c8aD98523631AE4a59f267346ea31F984" };
    const quotes = (["WETH", "USDC"] as const).map((q) => [q, ...(ch.tokens[q] || [])] as [string, string, number]).filter((q) => q[1] && q[1].toLowerCase() !== p.address.toLowerCase());
    const combos: [string, string, number, number][] = []; for (const q of quotes) for (const fee of [500, 3000, 10000]) combos.push([q[0], q[1], q[2], fee]);
    const gp = await rpcBatch(ch.rpc, combos.map(([, qa, , fee]) => ["eth_call", [{ to: FACT[name], data: "0x1698ee82" + pad(p.address) + pad(qa) + fee.toString(16).padStart(64, "0") }, "latest"]] as [string, any[]]));
    const found = combos.map((c, i) => ({ c, pool: gp[i] && big(gp[i]) !== 0n ? "0x" + gp[i].slice(26) : null })).filter((x) => x.pool);
    if (found.length) { const bal = await rpcBatch(ch.rpc, found.map((f) => ["eth_call", [{ to: f.c[1], data: "0x70a08231" + pad(f.pool!) }, "latest"]] as [string, any[]]));
      onchain_pools = found.map((f, i) => ({ dex: "uniswap-v3", pool: f.pool, quote: f.c[0], fee_bps: f.c[3] / 100, quote_reserve: fmt(big(bal[i]), f.c[2]) })).sort((a, b) => Number(b.quote_reserve) - Number(a.quote_reserve)); }
  } catch {}
  const flags: { level: string; flag: string }[] = [];
  if (implAddr) flags.push({ level: "medium", flag: "upgradeable proxy (EIP-1967/ZeppelinOS slot): logic can be changed by admin" });
  if (ownerAddr && big(ownerAddr) !== 0n) flags.push({ level: "medium", flag: `has active owner ${ownerAddr} (not renounced)` });
  if (ownerAddr && big(ownerAddr) === 0n) flags.push({ level: "info", flag: "ownership renounced (owner = 0x0)" });
  if (!nm && !sym) flags.push({ level: "high", flag: "no ERC20 name/symbol — may not be a token" });
  const usdcRes = onchain_pools.filter((x) => x.quote === "USDC").reduce((s, x) => s + Number(x.quote_reserve), 0), wethRes = onchain_pools.filter((x) => x.quote === "WETH").reduce((s, x) => s + Number(x.quote_reserve), 0);
  if (!market && onchain_pools.length) { if (usdcRes < 5000 && wethRes < 2) flags.push({ level: "high", flag: `thin on-chain Uniswap v3 liquidity (${usdcRes.toFixed(0)} USDC, ${wethRes.toFixed(2)} WETH)` }); }
  else if (!market && marketErr) flags.push({ level: "info", flag: `market data unavailable right now (${marketErr}); liquidity not assessed` });
  else if (!market) flags.push({ level: "high", flag: "no DEX liquidity found (DexScreener + GeckoTerminal)" });
  else { if ((market.liquidity_usd_total || 0) < 10000) flags.push({ level: "high", flag: `thin liquidity ($${market.liquidity_usd_total})` });
    if (market.pair_created && Date.now() - Date.parse(market.pair_created) < 7 * 864e5) flags.push({ level: "high", flag: "top pair < 7 days old" });
    const t = market.txns_24h; if (t && t.buys > 20 && t.sells === 0) flags.push({ level: "high", flag: "buys but zero sells in 24h (possible honeypot)" }); }
  const score = Math.max(0, 100 - flags.reduce((s, f) => s + (f.level === "high" ? 30 : f.level === "medium" ? 12 : 0), 0));
  return { chain: name, chain_id: ch.id, address: p.address, name: decStr(nm), symbol: decStr(sym), decimals, total_supply: decimals !== null ? fmt(supply, decimals) : supply.toString(),
    burned_dead_balance: decimals !== null ? fmt(big(dead), decimals) : null, code_bytes: (code.length - 2) / 2, owner: ownerAddr, proxy: { is_proxy: !!implAddr, implementation: implAddr, admin: admin && big(admin) !== 0n ? "0x" + admin.slice(26) : null },
    market, onchain_pools, risk_flags: flags, risk_score: score, verdict: score >= 75 ? "lower-risk" : score >= 45 ? "caution" : "high-risk",
    note: "Rule-based on-chain + DEX facts, not financial advice.", sources: { rpc: "public EVM JSON-RPC", dex: market?.source || null, market_error: marketErr } };
}

export async function fx(p: { base?: string; symbols?: string; date?: string; amount?: string }) {
  const b = (p.base || "USD").toUpperCase(); if (!/^[A-Z]{3}$/.test(b)) throw new UserError("base must be a 3-letter ISO currency", 400);
  const d = p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : "latest";
  const qs = new URLSearchParams({ base: b }); if (p.symbols) qs.set("symbols", p.symbols.toUpperCase().replace(/\s/g, ""));
  const r = await fetch(`https://api.frankfurter.dev/v1/${d}?${qs}`); if (!r.ok) throw new UserError(`fx source error ${r.status} (check currency codes/date)`, r.status === 404 ? 404 : 502);
  const j: any = await r.json(); const amt = p.amount ? Number(p.amount) : null;
  return { base: j.base, date: j.date, rates: j.rates, ...(amt && isFinite(amt) ? { amount: amt, converted: Object.fromEntries(Object.entries(j.rates).map(([k, v]: any) => [k, Math.round(v * amt * 1e6) / 1e6])) } : {}),
    count: Object.keys(j.rates || {}).length, source: "European Central Bank reference rates via frankfurter.dev (published ~16:00 CET on TARGET days)" };
}
