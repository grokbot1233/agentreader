// Single-fact EVM endpoints (/chain/*): one cheap answer per call, 5 chains, public RPC (zero marginal cost).
import { UserError } from "./core";
import { CHAINS, ADDR, HASH, chainOf, rpcBatch, ethGetLogs, pad, big, fmt, decStr } from "./onchain";

const S = (v: any) => (v == null ? "" : String(v).trim());
const call = (to: string, data: string, tag = "latest") => ["eth_call", [{ to, data }, tag]] as [string, any[]];
const CH = Object.keys(CHAINS);
const chainP = { type: "string", enum: CH, description: "EVM chain (default base)" };
const addrP = (d: string) => ({ type: "string", pattern: "^0x[0-9a-fA-F]{40}$", description: d });
const chainErr = (b: any) => { const x = S(b.chain).toLowerCase(); return !x || CH.includes(x) ? null : `unsupported chain "${x}"; use one of ${CH.join(", ")}`; };
const addrErr = (v: any, k: string) => (!S(v) ? `missing ${k}` : ADDR.test(S(v)) ? null : `${k} must be a 0x-prefixed 40-hex-char EVM address`);
const first = (...e: (string | null)[]) => e.find(Boolean) || null;
const blockTag = (v: any) => { const x = S(v) || "latest"; if (/^\d+$/.test(x)) return "0x" + BigInt(x).toString(16); if (/^0x[0-9a-f]+$/i.test(x) || /^(latest|safe|finalized|earliest|pending)$/i.test(x)) return x.toLowerCase(); throw new UserError("block must be decimal, 0x-hex, or latest|safe|finalized|pending", 400); };
const meta = (name: string, ch: any) => ({ chain: name, chain_id: ch.id });
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const topicAddr = (a: string) => "0x" + pad(a);

async function decimalsOf(rpc: string, token: string) { const [d, s] = await rpcBatch(rpc, [call(token, "0x313ce567"), call(token, "0x95d89b41")]); return { decimals: d && d !== "0x" ? Number(big(d)) : null, symbol: decStr(s) }; }

export type ChainRoute = { path: string; price: string; atomic: number; ttl: number; keys: string[]; desc: string; in: any; out: any; ex: any; validate: (b: any) => string | null; fn: (b: any) => Promise<any> };
const R: ChainRoute[] = [];
const add = (r: ChainRoute) => R.push(r);

add({ path: "/chain/erc20-balance", price: "$0.001", atomic: 1000, ttl: 15, keys: ["address", "token", "chain"],
  desc: "ERC20 token balance for any wallet on Base/Ethereum/Arbitrum/Optimism/Polygon via balanceOf (eth_call). Returns raw + decimal-formatted balance, symbol, decimals, block. Example: {address:\"0xd8dA…6045\", token:\"0x8335…2913\", chain:\"base\"}. $0.001.",
  in: { type: "object", properties: { address: addrP("Wallet address"), token: addrP("ERC20 contract"), chain: chainP }, required: ["address", "token"] },
  out: { type: "object", properties: { balance: { type: "string" }, balance_raw: { type: "string" }, symbol: { type: "string" }, decimals: { type: "number" }, block: { type: "number" } } },
  ex: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" },
  validate: (b) => first(addrErr(b.address, "address"), addrErr(b.token, "token"), chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const [bal, d, s, blk] = await rpcBatch(ch.rpc, [call(b.token, "0x70a08231" + pad(b.address)), call(b.token, "0x313ce567"), call(b.token, "0x95d89b41"), ["eth_blockNumber", []]]);
    if (bal == null || bal === "0x") throw new UserError(`balanceOf reverted — is ${b.token} an ERC20 on ${name}?`, 422);
    const dec = d && d !== "0x" ? Number(big(d)) : 18; return { ...meta(name, ch), address: b.address, token: b.token, symbol: decStr(s), decimals: dec, balance: fmt(big(bal), dec), balance_raw: big(bal).toString(), block: Number(big(blk)), source: "eth_call balanceOf" }; } });

add({ path: "/chain/balance", price: "$0.001", atomic: 1000, ttl: 15, keys: ["address", "chain", "block"],
  desc: "Native coin balance (ETH/POL) of any address via eth_getBalance, optionally at a historical block. Example: {address:\"0xd8dA…6045\", chain:\"ethereum\"} → {balance:\"…\", balance_wei, block}. Use /wallet ($0.003) for native + major tokens in one call. $0.001.",
  in: { type: "object", properties: { address: addrP("Address"), chain: chainP, block: { type: "string", description: "Block number or tag (default latest)" } }, required: ["address"] },
  out: { type: "object", properties: { balance: { type: "string" }, balance_wei: { type: "string" }, symbol: { type: "string" }, block: { type: "string" } } },
  ex: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "ethereum" },
  validate: (b) => first(addrErr(b.address, "address"), chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const tag = blockTag(b.block); const [bal, blk] = await rpcBatch(ch.rpc, [["eth_getBalance", [b.address, tag]], ["eth_blockNumber", []]]);
    return { ...meta(name, ch), address: b.address, symbol: ch.native, balance: fmt(big(bal), 18), balance_wei: big(bal).toString(), block: tag === "latest" ? Number(big(blk)) : tag, source: "eth_getBalance" }; } });

add({ path: "/chain/block-number", price: "$0.001", atomic: 1000, ttl: 2, keys: ["chain"],
  desc: "Latest block height (chain tip) plus safe/finalized heights and head age in seconds, via eth_blockNumber/eth_getBlockByNumber. Base/Ethereum/Arbitrum/Optimism/Polygon. Example: {chain:\"base\"}. $0.001.",
  in: { type: "object", properties: { chain: chainP } }, out: { type: "object", properties: { block: { type: "number" }, safe: { type: ["number", "null"] }, finalized: { type: ["number", "null"] }, head_age_s: { type: "number" } } },
  ex: { chain: "base" }, validate: chainErr,
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const [h, s, f] = await rpcBatch(ch.rpc, [["eth_getBlockByNumber", ["latest", false]], ["eth_getBlockByNumber", ["safe", false]], ["eth_getBlockByNumber", ["finalized", false]]]);
    return { ...meta(name, ch), block: Number(big(h?.number)), timestamp: new Date(Number(big(h?.timestamp)) * 1000).toISOString(), head_age_s: Math.max(0, Math.round(Date.now() / 1000 - Number(big(h?.timestamp)))), safe: s ? Number(big(s.number)) : null, finalized: f ? Number(big(f.number)) : null, source: "eth_getBlockByNumber" }; } });

add({ path: "/chain/nonce", price: "$0.001", atomic: 1000, ttl: 5, keys: ["address", "chain"],
  desc: "Next transaction nonce for any address (latest and pending) via eth_getTransactionCount — how many txs it has sent, and whether one is stuck in the mempool. Example: {address:\"0xd8dA…6045\", chain:\"base\"}. $0.001.",
  in: { type: "object", properties: { address: addrP("Address"), chain: chainP }, required: ["address"] }, out: { type: "object", properties: { nonce: { type: "number" }, pending_nonce: { type: "number" }, has_pending: { type: "boolean" } } },
  ex: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "base" }, validate: (b) => first(addrErr(b.address, "address"), chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const [l, p] = await rpcBatch(ch.rpc, [["eth_getTransactionCount", [b.address, "latest"]], ["eth_getTransactionCount", [b.address, "pending"]]]);
    const n = Number(big(l)), pn = Number(big(p)); return { ...meta(name, ch), address: b.address, nonce: n, pending_nonce: pn, has_pending: pn > n, txs_sent: n, source: "eth_getTransactionCount" }; } });

add({ path: "/chain/total-supply", price: "$0.001", atomic: 1000, ttl: 60, keys: ["token", "chain"],
  desc: "Total supply of an ERC20 or ERC721 token via totalSupply (eth_call), formatted with decimals and symbol. Example: {token:\"0x8335…2913\", chain:\"base\"} → {total_supply, symbol, decimals}. $0.001.",
  in: { type: "object", properties: { token: addrP("Token contract"), chain: chainP }, required: ["token"] }, out: { type: "object", properties: { total_supply: { type: "string" }, total_supply_raw: { type: "string" }, symbol: { type: "string" }, decimals: { type: ["number", "null"] } } },
  ex: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" }, validate: (b) => first(addrErr(b.token, "token"), chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const [s, d, sym] = await rpcBatch(ch.rpc, [call(b.token, "0x18160ddd"), call(b.token, "0x313ce567"), call(b.token, "0x95d89b41")]);
    if (s == null || s === "0x") throw new UserError(`totalSupply() reverted for ${b.token} on ${name}`, 422); const dec = d && d !== "0x" ? Number(big(d)) : null;
    return { ...meta(name, ch), token: b.token, symbol: decStr(sym), decimals: dec, total_supply: dec != null ? fmt(big(s), dec) : big(s).toString(), total_supply_raw: big(s).toString(), source: "eth_call totalSupply" }; } });

async function logs(b: any, topics: (string | null | string[])[], address?: string) {
  const [name, ch] = chainOf(b.chain); const [tipH] = await rpcBatch(ch.rpc, [["eth_blockNumber", []]]); const tip = Number(big(tipH));
  // Default 100 blocks: public free RPCs reject huge eth_getLogs windows (blastapi ~10 without address; publicnode needs contract address).
  const span = Math.min(Number(S(b.blocks) || 100), 5000); const to = S(b.to_block) ? Number(S(b.to_block)) : tip; const from = S(b.from_block) ? Number(S(b.from_block)) : Math.max(0, to - span);
  if (to - from > 5000) throw new UserError("block range max 5000", 400);
  if (!address) throw new UserError("contract address required for log queries on public RPCs — pass token= (ERC20) or address= (contract)", 400);
  let ls: any[];
  try { ls = await ethGetLogs(ch.rpc, { address, topics, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) }); }
  catch (e: any) {
    const msg = String(e?.message || e);
    if (/429|rate|compute units|request limit/i.test(msg)) throw new UserError("public RPC rate-limited for eth_getLogs — retry shortly or narrow blocks=", 503);
    if (/specify an address|address in your request/i.test(msg)) throw new UserError("public RPC requires a contract address filter for eth_getLogs — pass token=", 400);
    throw new UserError(`eth_getLogs failed: ${msg.slice(0, 160)} — try smaller blocks=`, 502);
  }
  if (ls == null) throw new UserError("eth_getLogs rejected the query (too many results?) — narrow blocks", 422);
  const limit = Math.min(Number(S(b.limit) || 50), 200);
  return { name, ch, from, to, all: ls as any[], items: (ls as any[]).slice(-limit).reverse(), limit };
}
add({ path: "/chain/erc20-transfers", price: "$0.003", atomic: 3000, ttl: 15, keys: ["token", "address", "direction", "blocks", "from_block", "to_block", "limit", "chain"],
  desc: "ERC20 Transfer events for a token and/or wallet via eth_getLogs, decoded (from, to, amount with decimals, tx hash, block). Default last 100 blocks, max 5000. Public RPCs need a contract filter: pass token=; if only wallet address is given, known chain tokens (USDC/WETH/…) are scanned. Example: {token:\"0x8335…2913\", address:\"0x88b1…3ff6\", chain:\"base\"}. $0.003.",
  in: { type: "object", properties: { token: addrP("ERC20 contract (recommended; required unless scanning known tokens for a wallet)"), address: addrP("Wallet to filter (optional if token given)"), direction: { type: "string", enum: ["in", "out", "any"] }, blocks: { type: "string", description: "Lookback blocks (default 100, max 5000)" }, from_block: { type: "string" }, to_block: { type: "string" }, limit: { type: "string", description: "Max items (default 50, max 200)" }, chain: chainP } },
  out: { type: "object", properties: { count: { type: "number" }, transfers: { type: "array" }, from_block: { type: "number" }, to_block: { type: "number" } } },
  ex: { token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", address: "0x88b1c747c33A5868A34057D8C57318E5602b3ff6", chain: "base", blocks: "100" },
  validate: (b) => first(!S(b.token) && !S(b.address) ? "missing token or address" : null, S(b.token) ? addrErr(b.token, "token") : null, S(b.address) ? addrErr(b.address, "address") : null, chainErr(b)),
  fn: async (b) => { const dir = S(b.direction) || "any"; const a = S(b.address) ? topicAddr(b.address) : null;
    const [name0, ch0] = chainOf(b.chain);
    const tokenList: string[] = S(b.token) ? [S(b.token)] : Object.values(ch0.tokens).map(([addr]) => addr).slice(0, 4);
    const scanned_known_tokens = !S(b.token) && !!S(b.address);
    if (!S(b.token) && !S(b.address)) throw new UserError("missing token or address", 400);
    if (!S(b.token) && !scanned_known_tokens) throw new UserError("token= required when not filtering a wallet", 400);
    const pull = async (token: string) => {
      if (a && dir === "any") {
        const [x, y] = await Promise.all([logs(b, [TRANSFER, a], token), logs(b, [TRANSFER, null, a], token)]);
        return { ...x, all: [...x.all, ...y.all] };
      }
      return logs(b, [TRANSFER, dir === "out" ? a : null, dir === "in" ? a : null], token);
    };
    const parts = [];
    for (const tok of tokenList) { try { parts.push(await pull(tok)); } catch (e: any) { if (tokenList.length === 1) throw e; } }
    if (!parts.length) throw new UserError("eth_getLogs failed for all known tokens — pass token= or retry", 502);
    const r = { ...parts[0], all: parts.flatMap((p) => p.all).sort((p, q) => Number(big(p.blockNumber) - big(q.blockNumber))) };
    r.items = r.all.slice(-r.limit).reverse();
    const toks = [...new Set(r.items.map((l: any) => l.address.toLowerCase()))].slice(0, 5); const dm: any = {}; await Promise.all(toks.map(async (t: any) => { dm[t] = await decimalsOf(r.ch.rpc, t).catch(() => ({ decimals: null, symbol: null })); }));
    const transfers = r.items.filter((l: any) => l.topics.length === 3).map((l: any) => { const m = dm[l.address.toLowerCase()] || {}; const v = big(l.data); return { token: l.address, symbol: m.symbol ?? null, from: "0x" + l.topics[1].slice(26), to: "0x" + l.topics[2].slice(26), amount: m.decimals != null ? fmt(v, m.decimals) : v.toString(), amount_raw: v.toString(), tx: l.transactionHash, block: Number(big(l.blockNumber)), log_index: Number(big(l.logIndex)) }; });
    return { ...meta(r.name, r.ch), token: S(b.token) || null, address: S(b.address) || null, direction: dir, from_block: r.from, to_block: r.to, total_matched: r.all.length, count: transfers.length, transfers, scanned_known_tokens: scanned_known_tokens || undefined, known_tokens_scanned: scanned_known_tokens ? tokenList.length : undefined, source: "eth_getLogs Transfer(address,address,uint256)" }; } });

add({ path: "/chain/events", price: "$0.003", atomic: 3000, ttl: 15, keys: ["address", "topic0", "topic1", "topic2", "topic3", "blocks", "from_block", "to_block", "limit", "chain"],
  desc: "Contract event logs via eth_getLogs filtered by contract and topics (topic0 = event signature hash). Raw logs, newest first; default last 100 blocks, max 5000 (auto-chunked for public RPC limits). Example: {address:\"0x8335…2913\", topic0:\"0xddf2…b3ef\", chain:\"base\", blocks:\"50\"}. $0.003.",
  in: { type: "object", properties: { address: addrP("Contract emitting the logs"), topic0: { type: "string", description: "Event signature hash (0x + 64 hex)" }, topic1: { type: "string" }, topic2: { type: "string" }, topic3: { type: "string" }, blocks: { type: "string" }, from_block: { type: "string" }, to_block: { type: "string" }, limit: { type: "string" }, chain: chainP }, required: ["address"] },
  out: { type: "object", properties: { count: { type: "number" }, logs: { type: "array" } } },
  ex: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", topic0: TRANSFER, blocks: "20", limit: "5", chain: "base" },
  validate: (b) => first(addrErr(b.address, "address"), ...["topic0", "topic1", "topic2", "topic3"].map((k) => S(b[k]) && !HASH.test(S(b[k])) ? `${k} must be 0x + 64 hex` : null), chainErr(b)),
  fn: async (b) => { const t = ["topic0", "topic1", "topic2", "topic3"].map((k) => S(b[k]) || null); while (t.length && t[t.length - 1] === null) t.pop();
    const r = await logs(b, t, b.address); return { ...meta(r.name, r.ch), address: b.address, from_block: r.from, to_block: r.to, total_matched: r.all.length, count: r.items.length,
      logs: r.items.map((l: any) => ({ block: Number(big(l.blockNumber)), tx: l.transactionHash, log_index: Number(big(l.logIndex)), topics: l.topics, data: l.data })), source: "eth_getLogs" }; } });

add({ path: "/chain/network-info", price: "$0.001", atomic: 1000, ttl: 5, keys: ["chain"],
  desc: "EVM network info in one call: chain ID, client version, block height, head age, gas price, base fee, native symbol. Confirms which chain an RPC is on before signing. Example: {chain:\"base\"}. $0.001.",
  in: { type: "object", properties: { chain: chainP } }, out: { type: "object", properties: { chain_id: { type: "number" }, block: { type: "number" }, gas_price_gwei: { type: "number" }, base_fee_gwei: { type: ["number", "null"] }, head_age_s: { type: "number" } } },
  ex: { chain: "base" }, validate: chainErr,
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const [cid, gp, h] = await rpcBatch(ch.rpc, [["eth_chainId", []], ["eth_gasPrice", []], ["eth_getBlockByNumber", ["latest", false]]]);
    return { ...meta(name, ch), chain_id_rpc: Number(big(cid)), native: ch.native, block: Number(big(h?.number)), head_age_s: Math.max(0, Math.round(Date.now() / 1000 - Number(big(h?.timestamp)))), gas_price_gwei: Number(big(gp)) / 1e9, base_fee_gwei: h?.baseFeePerGas ? Number(big(h.baseFeePerGas)) / 1e9 : null, gas_limit: Number(big(h?.gasLimit)), source: "eth_chainId/eth_gasPrice/eth_getBlockByNumber" }; } });

add({ path: "/chain/receipt", price: "$0.002", atomic: 2000, ttl: 30, keys: ["hash", "chain"],
  desc: "Transaction receipt via eth_getTransactionReceipt: success/revert status, gas used, effective gas price, fee in native coin, contract created, log count + raw logs. Example: {hash:\"0x…\", chain:\"base\"}. Use /tx ($0.003) for decoded transfers + confirmations. $0.002.",
  in: { type: "object", properties: { hash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" }, chain: chainP }, required: ["hash"] }, out: { type: "object", properties: { status: { type: "string" }, gas_used: { type: "number" }, fee: { type: "string" }, logs: { type: "array" } } },
  ex: { hash: "0x6f0d9bbb400eef11b67d1b9b41a5b9053b6790f254a3e9dea264dd1a8ded6a73", chain: "base" },
  validate: (b) => first(!S(b.hash) ? "missing hash" : HASH.test(S(b.hash)) ? null : "hash must be 0x + 64 hex chars", chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const [r] = await rpcBatch(ch.rpc, [["eth_getTransactionReceipt", [b.hash]]]);
    if (!r) throw new UserError(`no receipt on ${name} (pending, wrong chain, or unknown hash)`, 404); const fee = big(r.gasUsed) * big(r.effectiveGasPrice);
    return { ...meta(name, ch), hash: b.hash, status: big(r.status) === 1n ? "success" : "reverted", block: Number(big(r.blockNumber)), from: r.from, to: r.to, contract_created: r.contractAddress || null, gas_used: Number(big(r.gasUsed)), effective_gas_price_gwei: Number(big(r.effectiveGasPrice)) / 1e9, fee: fmt(fee, 18), fee_symbol: ch.native, log_count: r.logs.length, logs: r.logs.slice(0, 50).map((l: any) => ({ address: l.address, topics: l.topics, data: l.data, log_index: Number(big(l.logIndex)) })), source: "eth_getTransactionReceipt" }; } });

add({ path: "/chain/code", price: "$0.001", atomic: 1000, ttl: 600, keys: ["address", "chain"],
  desc: "Is this address a contract or a wallet (EOA)? eth_getCode → is_contract, bytecode size and prefix, EIP-7702 delegation detection. Example: {address:\"0x8335…2913\", chain:\"base\"}. Use /contract ($0.003) for proxy/owner/token detail. $0.001.",
  in: { type: "object", properties: { address: addrP("Address"), chain: chainP }, required: ["address"] }, out: { type: "object", properties: { is_contract: { type: "boolean" }, code_size: { type: "number" }, eip7702_delegate: { type: ["string", "null"] } } },
  ex: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" }, validate: (b) => first(addrErr(b.address, "address"), chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const [c] = await rpcBatch(ch.rpc, [["eth_getCode", [b.address, "latest"]]]); const code = c || "0x";
    const d7702 = /^0xef0100[0-9a-f]{40}$/i.test(code) ? "0x" + code.slice(8) : null;
    return { ...meta(name, ch), address: b.address, is_contract: code.length > 2 && !d7702, is_eoa: code.length <= 2 || !!d7702, eip7702_delegate: d7702, code_size: (code.length - 2) / 2, code_prefix: code.slice(0, 66), source: "eth_getCode" }; } });

add({ path: "/chain/call", price: "$0.002", atomic: 2000, ttl: 10, keys: ["to", "data", "from", "block", "chain"],
  desc: "Read-only contract call via eth_call (no transaction sent): pass to + ABI-encoded data, get the raw return hex plus best-effort uint/address/string decodes and revert reason. Example: {to:\"0x8335…2913\", data:\"0x18160ddd\", chain:\"base\"}. $0.002.",
  in: { type: "object", properties: { to: addrP("Contract"), data: { type: "string", description: "0x calldata" }, from: addrP("Optional caller"), block: { type: "string" }, chain: chainP }, required: ["to", "data"] },
  out: { type: "object", properties: { result: { type: "string" }, reverted: { type: "boolean" }, as_uint: { type: ["string", "null"] }, as_address: { type: ["string", "null"] }, as_string: { type: ["string", "null"] } } },
  ex: { to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", data: "0x18160ddd", chain: "base" },
  validate: (b) => first(addrErr(b.to, "to"), !/^0x([0-9a-fA-F]{2}){4,}$/.test(S(b.data)) ? "data must be 0x calldata (>=4 bytes)" : null, S(b.from) ? addrErr(b.from, "from") : null, chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const tag = blockTag(b.block);
    const res = await fetch(ch.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: b.to, data: b.data, ...(S(b.from) ? { from: b.from } : {}) }, tag] }) });
    const j: any = await res.json(); if (j.error) return { ...meta(name, ch), to: b.to, reverted: true, error: String(j.error.message).slice(0, 300), revert_data: j.error.data ?? null, source: "eth_call" };
    const r: string = j.result || "0x"; const w = r.slice(2, 66);
    return { ...meta(name, ch), to: b.to, block: tag, reverted: false, result: r, as_uint: w.length === 64 ? BigInt("0x" + w).toString() : null, as_address: w.length === 64 && /^0{24}/.test(w) ? "0x" + w.slice(24) : null, as_string: decStr(r), source: "eth_call" }; } });

add({ path: "/chain/estimate-gas", price: "$0.002", atomic: 2000, ttl: 5, keys: ["to", "from", "data", "value", "chain"],
  desc: "Estimate gas for a transaction before signing (eth_estimateGas) plus current fee → cost in native coin; returns the revert reason if it would fail. Example: {from:\"0xd8dA…6045\", to:\"0x8335…2913\", data:\"0xa9059cbb…\", chain:\"base\"}. $0.002.",
  in: { type: "object", properties: { to: addrP("Recipient/contract"), from: addrP("Sender"), data: { type: "string" }, value: { type: "string", description: "Wei (decimal)" }, chain: chainP }, required: ["to"] },
  out: { type: "object", properties: { gas: { type: "number" }, would_revert: { type: "boolean" }, est_fee: { type: "string" } } },
  ex: { from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", to: "0x88b1c747c33A5868A34057D8C57318E5602b3ff6", value: "1000000000000", chain: "base" },
  validate: (b) => first(addrErr(b.to, "to"), S(b.from) ? addrErr(b.from, "from") : null, S(b.data) && !/^0x([0-9a-fA-F]{2})*$/.test(S(b.data)) ? "data must be 0x hex" : null, S(b.value) && !/^\d{1,78}$/.test(S(b.value)) ? "value must be decimal wei" : null, chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const tx: any = { to: b.to, ...(S(b.from) ? { from: b.from } : {}), ...(S(b.data) ? { data: b.data } : {}), ...(S(b.value) ? { value: "0x" + BigInt(b.value).toString(16) } : {}) };
    const res = await fetch(ch.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify([{ jsonrpc: "2.0", id: 0, method: "eth_estimateGas", params: [tx] }, { jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] }]) });
    const j: any[] = await res.json(); const e = j.find((x) => x.id === 0), g = j.find((x) => x.id === 1);
    if (e?.error) return { ...meta(name, ch), would_revert: true, error: String(e.error.message).slice(0, 300), source: "eth_estimateGas" };
    const gas = big(e?.result), gp = big(g?.result); return { ...meta(name, ch), would_revert: false, gas: Number(gas), gas_price_gwei: Number(gp) / 1e9, est_fee: fmt(gas * gp, 18), fee_symbol: ch.native, source: "eth_estimateGas/eth_gasPrice" }; } });

add({ path: "/chain/nft-owner", price: "$0.001", atomic: 1000, ttl: 30, keys: ["contract", "token_id", "chain"],
  desc: "Current owner of an ERC721 token_id via ownerOf (eth_call), plus collection name/symbol. Example: {contract:\"0xBC4C…f13D\", token_id:\"1\", chain:\"ethereum\"} → {owner}. Use /nft ($0.002) for metadata. $0.001.",
  in: { type: "object", properties: { contract: addrP("ERC721 contract"), token_id: { type: "string" }, chain: chainP }, required: ["contract", "token_id"] }, out: { type: "object", properties: { owner: { type: ["string", "null"] }, name: { type: ["string", "null"] } } },
  ex: { contract: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D", token_id: "1", chain: "ethereum" },
  validate: (b) => first(addrErr(b.contract, "contract"), !/^\d{1,78}$/.test(S(b.token_id)) ? "token_id must be a decimal integer" : null, chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const id = BigInt(b.token_id).toString(16).padStart(64, "0"); const [o, n, s] = await rpcBatch(ch.rpc, [call(b.contract, "0x6352211e" + id), call(b.contract, "0x06fdde03"), call(b.contract, "0x95d89b41")]);
    if (!o || o === "0x") throw new UserError(`ownerOf(${b.token_id}) reverted — token not minted, burned, or not ERC721 on ${name}`, 404);
    return { ...meta(name, ch), contract: b.contract, token_id: b.token_id, owner: "0x" + o.slice(26), name: decStr(n), symbol: decStr(s), source: "eth_call ownerOf" }; } });

add({ path: "/chain/erc1155-balance", price: "$0.001", atomic: 1000, ttl: 15, keys: ["contract", "address", "token_id", "chain"],
  desc: "ERC1155 balance: how many copies of token_id a wallet holds, via balanceOf(address,uint256) (eth_call). Example: {contract:\"0x…\", address:\"0x…\", token_id:\"1\", chain:\"base\"}. $0.001.",
  in: { type: "object", properties: { contract: addrP("ERC1155 contract"), address: addrP("Holder"), token_id: { type: "string" }, chain: chainP }, required: ["contract", "address", "token_id"] }, out: { type: "object", properties: { balance: { type: "string" } } },
  ex: { contract: "0x76be3b62873462d2142405439777e971754e8e77", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", token_id: "10229", chain: "ethereum" },
  validate: (b) => first(addrErr(b.contract, "contract"), addrErr(b.address, "address"), !/^\d{1,78}$/.test(S(b.token_id)) ? "token_id must be a decimal integer" : null, chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const [r] = await rpcBatch(ch.rpc, [call(b.contract, "0x00fdd58e" + pad(b.address) + BigInt(b.token_id).toString(16).padStart(64, "0"))]);
    if (r == null || r === "0x") throw new UserError(`balanceOf reverted — is ${b.contract} ERC1155 on ${name}?`, 422);
    return { ...meta(name, ch), contract: b.contract, address: b.address, token_id: b.token_id, balance: big(r).toString(), source: "eth_call balanceOf(address,uint256)" }; } });

add({ path: "/chain/storage", price: "$0.001", atomic: 1000, ttl: 15, keys: ["address", "slot", "block", "chain"],
  desc: "Read a raw storage slot of any contract via eth_getStorageAt, with uint and address decodes. Example: {address:\"0x8335…2913\", slot:\"0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc\", chain:\"base\"} (EIP-1967 implementation slot). $0.001.",
  in: { type: "object", properties: { address: addrP("Contract"), slot: { type: "string", description: "Slot (decimal or 0x hex)" }, block: { type: "string" }, chain: chainP }, required: ["address", "slot"] }, out: { type: "object", properties: { value: { type: "string" }, as_uint: { type: "string" }, as_address: { type: ["string", "null"] } } },
  ex: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", slot: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", chain: "base" },
  validate: (b) => first(addrErr(b.address, "address"), !/^(\d{1,78}|0x[0-9a-fA-F]{1,64})$/.test(S(b.slot)) ? "slot must be decimal or 0x hex (<=32 bytes)" : null, chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const slot = "0x" + BigInt(b.slot).toString(16).padStart(64, "0"); const [v] = await rpcBatch(ch.rpc, [["eth_getStorageAt", [b.address, slot, blockTag(b.block)]]]);
    const w = (v || "0x").slice(2).padStart(64, "0"); return { ...meta(name, ch), address: b.address, slot, value: "0x" + w, as_uint: BigInt("0x" + w).toString(), as_address: /^0{24}/.test(w) && BigInt("0x" + w) !== 0n ? "0x" + w.slice(24) : null, source: "eth_getStorageAt" }; } });

const IMPL = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", ADMIN = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103", BEACON = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50", ZOS = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3";
add({ path: "/chain/proxy", price: "$0.002", atomic: 2000, ttl: 600, keys: ["address", "chain"],
  desc: "Detect upgradeable proxies (EIP-1967 transparent/UUPS, beacon, legacy OZ, EIP-1167 minimal clones, EIP-7702) via eth_getStorageAt/eth_getCode: implementation, admin, beacon, and whether the implementation is a live contract. Example: {address:\"0x8335…2913\", chain:\"base\"}. $0.002.",
  in: { type: "object", properties: { address: addrP("Contract"), chain: chainP }, required: ["address"] }, out: { type: "object", properties: { is_proxy: { type: "boolean" }, pattern: { type: ["string", "null"] }, implementation: { type: ["string", "null"] }, admin: { type: ["string", "null"] } } },
  ex: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain: "base" }, validate: (b) => first(addrErr(b.address, "address"), chainErr(b)),
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const [code, i, a, be, z] = await rpcBatch(ch.rpc, [["eth_getCode", [b.address, "latest"]], ["eth_getStorageAt", [b.address, IMPL, "latest"]], ["eth_getStorageAt", [b.address, ADMIN, "latest"]], ["eth_getStorageAt", [b.address, BEACON, "latest"]], ["eth_getStorageAt", [b.address, ZOS, "latest"]]]);
    const sl = (h: any) => (h && big(h) !== 0n ? "0x" + h.slice(26) : null); const c = code || "0x";
    const clone = /^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/i.exec(c); const d7702 = /^0xef0100([0-9a-f]{40})$/i.exec(c);
    let pattern: string | null = null, impl: string | null = null;
    if (sl(i)) { pattern = sl(a) ? "eip1967-transparent" : "eip1967-uups"; impl = sl(i); } else if (sl(be)) { pattern = "eip1967-beacon"; } else if (sl(z)) { pattern = "openzeppelin-legacy"; impl = sl(z); } else if (clone) { pattern = "eip1167-minimal-clone"; impl = "0x" + clone[1]; } else if (d7702) { pattern = "eip7702-delegation"; impl = "0x" + d7702[1]; }
    let beaconImpl: string | null = null; if (sl(be)) { const [bi] = await rpcBatch(ch.rpc, [call(sl(be)!, "0x5c60da1b")]); beaconImpl = bi && bi.length >= 66 ? "0x" + bi.slice(26) : null; impl = beaconImpl; }
    let implLive: boolean | null = null; if (impl) { const [ic] = await rpcBatch(ch.rpc, [["eth_getCode", [impl, "latest"]]]); implLive = !!ic && ic.length > 2; }
    return { ...meta(name, ch), address: b.address, is_contract: c.length > 2, is_proxy: !!pattern, pattern, implementation: impl, implementation_is_contract: implLive, admin: sl(a), beacon: sl(be), source: "eth_getStorageAt EIP-1967 slots + eth_getCode" }; } });

add({ path: "/chain/chain-id", price: "$0.001", atomic: 1000, ttl: 3600, keys: ["chain"],
  desc: "EIP-155 chain ID straight from the RPC (eth_chainId + net_version) — confirm which network you are about to sign on. Example: {chain:\"base\"} → {chain_id:8453}. $0.001.",
  in: { type: "object", properties: { chain: chainP } }, out: { type: "object", properties: { chain_id: { type: "number" }, hex: { type: "string" } } },
  ex: { chain: "base" }, validate: chainErr,
  fn: async (b) => { const [name, ch] = chainOf(b.chain); const [cid] = await rpcBatch(ch.rpc, [["eth_chainId", []]]); return { chain: name, chain_id: Number(big(cid)), hex: cid, matches_expected: Number(big(cid)) === ch.id, caip2: `eip155:${Number(big(cid))}`, source: "eth_chainId" }; } });

export const CHAIN_ROUTES = R;
