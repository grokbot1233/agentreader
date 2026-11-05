import { UserError } from "./core";
import { CHAINS, ADDR, chainOf, rpcBatch, pad, big, fmt, decStr } from "./onchain";
import { createPublicClient, http, fallback } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const ETH_POOL = ["https://eth-mainnet.public.blastapi.io", "https://gateway.tenderly.co/public/mainnet", "https://eth-pokt.nodies.app", "https://api.zan.top/eth-mainnet", "https://ethereum-rpc.publicnode.com"];
let ensClient: any = null;
const eth = () => (ensClient ??= createPublicClient({ chain: mainnet, transport: fallback(ETH_POOL.map((u) => http(u, { timeout: 8000, retryCount: 0 }))) }));

// Small per-isolate memo to absorb bursts on top of the edge cache
const memo = new Map<string, { t: number; v: any }>();
async function remember<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const h = memo.get(key); if (h && Date.now() - h.t < ttlMs) return h.v;
  const v = await fn(); memo.set(key, { t: Date.now(), v }); if (memo.size > 500) memo.delete(memo.keys().next().value!); return v;
}
const call = (to: string, data: string) => ["eth_call", [{ to, data }, "latest"]] as [string, any[]];
const addrIn = (a: string, what = "address") => { if (!ADDR.test(a || "")) throw new UserError(`${what} must be a 0x… 40-hex EVM address`, 400); return a; };

export async function ens(p: { name?: string; address?: string }) {
  const c = eth();
  if (p.address) { addrIn(p.address);
    const name = await c.getEnsName({ address: p.address as any });
    let verified = false; if (name) { try { verified = ((await c.getEnsAddress({ name: normalize(name) })) || "").toLowerCase() === p.address.toLowerCase(); } catch {} }
    return { direction: "reverse", address: p.address, name: name || null, forward_verified: verified, source: "ENS Universal Resolver on Ethereum mainnet" };
  }
  if (!p.name || !p.name.includes(".")) throw new UserError("pass name=vitalik.eth (forward) or address=0x… (reverse)", 400);
  let n: string; try { n = normalize(p.name.trim()); } catch { throw new UserError("invalid ENS name", 400); }
  const [address, avatar, url, twitter, github, description] = await Promise.all([c.getEnsAddress({ name: n }),
    ...["avatar", "url", "com.twitter", "com.github", "description"].map((key) => c.getEnsText({ name: n, key }).catch(() => null))]);
  return { direction: "forward", name: n, address: address || null, records: { avatar, url, "com.twitter": twitter, "com.github": github, description }, source: "ENS Universal Resolver on Ethereum mainnet" };
}

export async function tokenMeta(p: { address: string; chain?: string }) {
  addrIn(p.address); const [name, ch] = chainOf(p.chain);
  const [code, nm, sym, dec, sup] = await rpcBatch(ch.rpc, [["eth_getCode", [p.address, "latest"]], call(p.address, "0x06fdde03"), call(p.address, "0x95d89b41"), call(p.address, "0x313ce567"), call(p.address, "0x18160ddd")]);
  if (!code || code === "0x") throw new UserError(`no contract at ${p.address} on ${name}`, 404);
  const decimals = dec && dec !== "0x" ? Number(big(dec)) : null;
  return { chain: name, chain_id: ch.id, address: p.address, name: decStr(nm), symbol: decStr(sym), decimals, total_supply: sup ? (decimals !== null ? fmt(big(sup), decimals) : big(sup).toString()) : null,
    total_supply_raw: sup ? big(sup).toString() : null, is_erc20_like: !!(sym && dec && sup), source: "eth_call name/symbol/decimals/totalSupply" };
}

export async function allowance(p: { token: string; owner: string; spender: string; chain?: string }) {
  addrIn(p.token, "token"); addrIn(p.owner, "owner"); addrIn(p.spender, "spender"); const [name, ch] = chainOf(p.chain);
  const [al, dec, sym, bal, blk] = await rpcBatch(ch.rpc, [call(p.token, "0xdd62ed3e" + pad(p.owner) + pad(p.spender)), call(p.token, "0x313ce567"), call(p.token, "0x95d89b41"), call(p.token, "0x70a08231" + pad(p.owner)), ["eth_blockNumber", []]]);
  if (al === null || al === undefined) throw new UserError("allowance() reverted — is this an ERC20 token on this chain?", 422);
  const d = dec ? Number(big(dec)) : 18; const raw = big(al);
  return { chain: name, chain_id: ch.id, token: p.token, symbol: decStr(sym), owner: p.owner, spender: p.spender, allowance: fmt(raw, d), allowance_raw: raw.toString(),
    unlimited: raw >= 2n ** 255n, owner_balance: bal ? fmt(big(bal), d) : null, spendable_now: bal ? fmt(raw < big(bal) ? raw : big(bal), d) : null, decimals: d, block: Number(big(blk)), source: "eth_call allowance/balanceOf" };
}

const ZOS = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3";
const IMPL = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", ADMIN = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103", BEACON = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
export async function contractInfo(p: { address: string; chain?: string }) {
  addrIn(p.address); const [name, ch] = chainOf(p.chain);
  const [code, impl, admin, beacon, nonce, e721, e1155, sym, dec, owner, zos] = await rpcBatch(ch.rpc, [["eth_getCode", [p.address, "latest"]], ["eth_getStorageAt", [p.address, IMPL, "latest"]], ["eth_getStorageAt", [p.address, ADMIN, "latest"]],
    ["eth_getStorageAt", [p.address, BEACON, "latest"]], ["eth_getTransactionCount", [p.address, "latest"]], call(p.address, "0x01ffc9a780ac58cd00000000000000000000000000000000000000000000000000000000"),
    call(p.address, "0x01ffc9a7d9b67a2600000000000000000000000000000000000000000000000000000000"), call(p.address, "0x95d89b41"), call(p.address, "0x313ce567"), call(p.address, "0x8da5cb5b"), ["eth_getStorageAt", [p.address, ZOS, "latest"]]]);
  const c = code || "0x"; const isContract = c.length > 2;
  const slot = (h: any) => (h && big(h) !== 0n ? "0x" + h.slice(26) : null);
  const m1167 = c.toLowerCase().match(/^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/);
  const delegated7702 = c.toLowerCase().startsWith("0xef0100") ? "0x" + c.slice(8, 48) : null;
  const isTrue = (h: any) => !!h && h !== "0x" && big(h) === 1n;
  const kinds = [isTrue(e721) && "ERC721", isTrue(e1155) && "ERC1155", !isTrue(e721) && sym && dec && "ERC20"].filter(Boolean);
  let verified: any = null;
  const lookup = slot(impl) || slot(zos) || (m1167 ? "0x" + m1167[1] : null);
  for (const a of [p.address, lookup].filter(Boolean) as string[]) {
    try { const r = await fetch(`https://sourcify.dev/server/v2/contract/${ch.id}/${a}?fields=compilation`, { headers: { accept: "application/json" } });
      if (r.ok) { const j: any = await r.json(); if (j.match) { (verified ??= {})[a.toLowerCase() === p.address.toLowerCase() ? "contract" : "implementation"] = { name: j.compilation?.name || null, match: j.match, compiler: j.compilation?.compilerVersion || null, source: "sourcify" }; } } } catch {}
  }
  return { chain: name, chain_id: ch.id, address: p.address, is_contract: isContract && !delegated7702, eip7702_delegate: delegated7702, bytecode_bytes: (c.length - 2) / 2,
    nonce: Number(big(nonce)), proxy: { eip1967_implementation: slot(impl), eip1967_admin: slot(admin), eip1967_beacon: slot(beacon), legacy_zos_implementation: slot(zos), eip1167_clone_of: m1167 ? "0x" + m1167[1] : null },
    owner: owner && owner.length >= 66 ? "0x" + owner.slice(26, 66) : null, standards: kinds, verified, source: "eth_getCode/getStorageAt + ERC165 + Sourcify" };
}

const FEED_ETH = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", FEED_POL = "0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676";
async function feed(addr: string) { const [r] = await rpcBatch(CHAINS.ethereum.rpc, [call(addr, "0xfeaf968c")]); return r ? Number(big("0x" + r.slice(66, 130))) / 1e8 : null; }
export async function gas(p: { chain?: string }) {
  const [name, ch] = chainOf(p.chain);
  return remember(`gas:${name}`, 8000, async () => {
    const [gp, tip, blk, hist] = await rpcBatch(ch.rpc, [["eth_gasPrice", []], ["eth_maxPriorityFeePerGas", []], ["eth_getBlockByNumber", ["latest", false]], ["eth_feeHistory", ["0xa", "latest", [10, 50, 90]]]]);
    const usd = await remember(`px:${ch.native}`, 60000, () => feed(ch.native === "POL" ? FEED_POL : FEED_ETH)).catch(() => null);
    const base = big(blk?.baseFeePerGas), t = big(tip), g = big(gp), max = base * 2n + t;
    const gwei = (v: bigint) => Number(fmt(v, 9));
    const cost = (units: bigint) => { const n = Number(fmt(units * (base + t || g), 18)); return { native: n, usd: usd ? Math.round(n * usd * 1e6) / 1e6 : null }; };
    const pct = (i: number) => (hist?.reward || []).map((r: any) => Number(big(r[i]))).sort((a: number, b: number) => a - b)[Math.floor((hist?.reward?.length || 1) / 2)] / 1e9 || null;
    return { chain: name, chain_id: ch.id, block: Number(big(blk?.number)), timestamp: blk ? new Date(Number(big(blk.timestamp)) * 1000).toISOString() : null,
      base_fee_gwei: gwei(base), priority_fee_gwei: { suggested: gwei(t), p10: pct(0), p50: pct(1), p90: pct(2) }, gas_price_gwei: gwei(g),
      suggested_eip1559: { maxFeePerGas_gwei: gwei(max), maxPriorityFeePerGas_gwei: gwei(t) }, block_utilization_pct: blk ? Math.round(Number(big(blk.gasUsed)) / Number(big(blk.gasLimit)) * 1000) / 10 : null,
      native_usd: usd, est_cost: { eth_transfer_21k: cost(21000n), erc20_transfer_65k: cost(65000n), swap_180k: cost(180000n) },
      note: name === "ethereum" || name === "polygon" ? null : "L2 execution fee only; the L1 data fee is extra", source: "eth_feeHistory/gasPrice + Chainlink price feed (Ethereum)" };
  });
}

export async function block(p: { number?: string; timestamp?: string; chain?: string }) {
  const [name, ch] = chainOf(p.chain);
  const get = async (tag: string) => { const [b] = await rpcBatch(ch.rpc, [["eth_getBlockByNumber", [tag, false]]]); if (!b) throw new UserError("block not found", 404); return b; };
  const shape = (b: any, extra: any = {}) => ({ chain: name, chain_id: ch.id, number: Number(big(b.number)), hash: b.hash, timestamp: Number(big(b.timestamp)), time_iso: new Date(Number(big(b.timestamp)) * 1000).toISOString(),
    tx_count: b.transactions?.length ?? null, gas_used: Number(big(b.gasUsed)), gas_limit: Number(big(b.gasLimit)), base_fee_gwei: b.baseFeePerGas ? Number(fmt(big(b.baseFeePerGas), 9)) : null, miner: b.miner, ...extra });
  if (p.timestamp) {
    const ts = /^\d+$/.test(p.timestamp) ? Number(p.timestamp) : Math.floor(Date.parse(p.timestamp) / 1000); if (!isFinite(ts)) throw new UserError("timestamp must be unix seconds or ISO date", 400);
    const head = await get("latest"); let hi = Number(big(head.number)), hiT = Number(big(head.timestamp));
    if (ts >= hiT) return shape(head, { query_timestamp: ts, match: "latest (timestamp in future)" });
    let lo = Math.max(0, hi - Math.ceil((hiT - ts) / 0.2) - 10), loB = await get("0x" + lo.toString(16)), loT = Number(big(loB.timestamp));
    if (loT > ts) { lo = 0; loB = await get("0x0"); loT = Number(big(loB.timestamp)); }
    for (let i = 0; i < 40 && hi - lo > 1; i++) {
      let mid = Math.floor(lo + (hi - lo) * ((ts - loT) / Math.max(1, hiT - loT))); mid = Math.min(hi - 1, Math.max(lo + 1, mid));
      if (i % 2) mid = Math.floor((lo + hi) / 2);
      const b = await get("0x" + mid.toString(16)); const t = Number(big(b.timestamp));
      if (t <= ts) { lo = mid; loB = b; loT = t; } else { hi = mid; hiT = t; }
    }
    return shape(loB, { query_timestamp: ts, match: "last block at or before timestamp" });
  }
  const n = (p.number || "latest").trim(); const tag = /^\d+$/.test(n) ? "0x" + Number(n).toString(16) : /^0x[0-9a-f]+$/i.test(n) ? n : ["latest", "finalized", "safe"].includes(n) ? n : null;
  if (!tag) throw new UserError("number must be decimal, hex, latest, safe or finalized", 400);
  return shape(await get(tag));
}

export async function nft(p: { contract: string; token_id: string; chain?: string }) {
  addrIn(p.contract, "contract"); const [name, ch] = chainOf(p.chain);
  if (!/^\d+$/.test(p.token_id || "")) throw new UserError("token_id must be a decimal integer", 400);
  const id = BigInt(p.token_id).toString(16).padStart(64, "0");
  const [owner, uri721, uri1155, nm, sym] = await rpcBatch(ch.rpc, [call(p.contract, "0x6352211e" + id), call(p.contract, "0xc87b56dd" + id), call(p.contract, "0x0e89341c" + id), call(p.contract, "0x06fdde03"), call(p.contract, "0x95d89b41")]);
  let uri = decStr(uri721) || decStr(uri1155); if (uri && uri1155 && !uri721) uri = uri.replace("{id}", id);
  let metadata: any = null, metaErr: string | null = null;
  if (uri) { try {
      const ipfs = uri.startsWith("ipfs://") ? uri.slice(7).replace(/^ipfs\//, "") : null;
      const urls = ipfs ? ["https://ipfs.filebase.io/ipfs/", "https://4everland.io/ipfs/", "https://nftstorage.link/ipfs/", "https://dweb.link/ipfs/", "https://w3s.link/ipfs/", "https://ipfs.io/ipfs/", "https://gateway.pinata.cloud/ipfs/"].map((g) => g + ipfs) : [uri.startsWith("ar://") ? "https://arweave.net/" + uri.slice(5) : uri];
      const u = urls[0];
      if (u.startsWith("data:application/json;base64,")) metadata = JSON.parse(atob(u.split(",")[1]));
      else if (u.startsWith("data:application/json")) metadata = JSON.parse(decodeURIComponent(u.split(",").slice(1).join(",")));
      else if (/^https?:\/\//.test(u)) { for (const x of urls) { try { const r = await fetch(x, { signal: AbortSignal.timeout(5000) }); if (r.ok) { metadata = JSON.parse((await r.text()).slice(0, 200000)); metaErr = null; break; } metaErr = `metadata HTTP ${r.status} (${new URL(x).host})`; } catch (e: any) { metaErr = String(e?.message || e).slice(0, 60); } } }
    } catch (e: any) { metaErr = String(e?.message || e).slice(0, 80); } }
  if (metadata && typeof metadata.image === "string" && metadata.image.length > 2000) metadata.image = metadata.image.slice(0, 200) + "…(truncated data URI)";
  return { chain: name, chain_id: ch.id, contract: p.contract, token_id: p.token_id, collection: { name: decStr(nm), symbol: decStr(sym) }, standard: owner ? "ERC721" : uri1155 ? "ERC1155" : null,
    owner: owner && owner.length >= 66 ? "0x" + owner.slice(26, 66) : null, token_uri: uri, metadata, metadata_error: metaErr, source: "eth_call ownerOf/tokenURI/uri + IPFS/Arweave/HTTP gateway" };
}
