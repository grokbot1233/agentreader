// Free input validation that runs BEFORE x402 payment, so bad input never costs the caller.
import { PC } from "./ukdata";
const CH = ["base", "ethereum", "arbitrum", "optimism", "polygon"];
const ADDR = /^0x[0-9a-fA-F]{40}$/, HASH = /^0x[0-9a-fA-F]{64}$/;
const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const CHNUM = /^(?:\d{1,8}|[A-Z]\d{7}|[A-Z]{2}\d{6}|[A-Z]{2}\d{5}[A-Z])$/i;
const s = (v: any) => (v == null ? "" : String(v).trim());
const url = (v: any, k = "url") => { const x = s(v); if (!x) return `missing ${k}`; try { const u = new URL(x); if (!/^https?:$/.test(u.protocol)) return `${k} must be http(s)`; if (!u.hostname.includes(".")) return `${k} needs a public hostname`; } catch { return `${k} is not a valid URL (include https://)`; } return null; };
const addr = (v: any, k: string, req = true) => { const x = s(v); if (!x) return req ? `missing ${k}` : null; return ADDR.test(x) ? null : `${k} must be a 0x-prefixed 40-hex-char EVM address`; };
const chain = (v: any) => { const x = s(v).toLowerCase(); return !x || CH.includes(x) ? null : `unsupported chain "${x}"; use one of ${CH.join(", ")}`; };
const domainish = (v: any, k = "domain") => { const x = s(v).replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, ""); if (!x) return `missing ${k}`; return DOMAIN.test(x) ? null : `${k} must be a hostname like example.com`; };
const first = (...e: (string | null)[]) => e.find(Boolean) || null;
const ISO = /^[A-Z]{3}$/i;

export const VALIDATE: Record<string, (b: any) => string | null> = {
  "/read": (b) => url(b.url), "/links": (b) => url(b.url), "/convert": (b) => first(url(b.url), b.format && !["markdown", "text"].includes(b.format) ? "format must be markdown or text" : null),
  "/check": (b) => domainish(b.domain),
  "/company": (b) => domainish(b.domain || b.name || b.url), "/company-full": (b) => domainish(b.domain || b.name || b.url),
  "/uk-company": (b) => uk(b), "/uk-company-lite": (b) => uk(b),
  "/monitor": (b) => first(url(b.url), url(b.webhook, "webhook"), s(b.webhook) && !s(b.webhook).startsWith("https://") ? "webhook must be https" : null),
  "/wallet": (b) => first(addr(b.address, "address"), chain(b.chain), s(b.tokens) && s(b.tokens).split(",").some((t) => !ADDR.test(t.trim())) ? "tokens must be comma-separated 0x addresses" : null, s(b.tokens).split(",").length > 10 ? "max 10 tokens" : null),
  "/tx": (b) => first(!s(b.hash) ? "missing hash" : HASH.test(s(b.hash)) ? null : "hash must be 0x + 64 hex chars", chain(b.chain)),
  "/token-check": (b) => first(addr(b.address, "address"), chain(b.chain)), "/token": (b) => first(addr(b.address, "address"), chain(b.chain)),
  "/contract": (b) => first(addr(b.address, "address"), chain(b.chain)),
  "/fx": (b) => first(s(b.base) && !ISO.test(s(b.base)) ? "base must be a 3-letter ISO currency, e.g. GBP" : null,
    s(b.symbols) && s(b.symbols).split(",").some((x) => !ISO.test(x.trim())) ? "symbols must be comma-separated ISO codes, e.g. USD,EUR" : null,
    s(b.date) && !/^\d{4}-\d{2}-\d{2}$/.test(s(b.date)) ? "date must be YYYY-MM-DD" : null, s(b.amount) && !(Number(b.amount) >= 0) ? "amount must be a positive number" : null),
  "/ens": (b) => { const n = s(b.name), a = s(b.address); if (!n && !a) return "missing name or address"; if (a) return addr(a, "address"); return /^[^\s.]+(\.[^\s.]+)+$/.test(n) ? null : "name must be an ENS name like vitalik.eth"; },
  "/allowance": (b) => first(addr(b.token, "token"), addr(b.owner, "owner"), addr(b.spender, "spender"), chain(b.chain)),
  "/gas": (b) => chain(b.chain),
  "/block": (b) => first(s(b.number) && !/^(\d+|0x[0-9a-f]+|latest|safe|finalized|earliest|pending)$/i.test(s(b.number)) ? "number must be decimal, 0x-hex, or latest|safe|finalized" : null,
    s(b.timestamp) && !/^\d{9,11}$/.test(s(b.timestamp)) && isNaN(Date.parse(s(b.timestamp))) ? "timestamp must be unix seconds or an ISO date" : null, chain(b.chain)),
  "/nft": (b) => first(addr(b.contract, "contract"), !s(b.token_id) ? "missing token_id" : /^\d{1,78}$/.test(s(b.token_id)) ? null : "token_id must be a decimal integer", chain(b.chain)),
  "/search": (b) => { const q = s(b.q); if (q.length < 2) return "missing q (2-300 chars)"; if (q.length > 300) return "q max 300 chars";
    if (s(b.sources) && s(b.sources).split(",").some((x) => !["wikipedia", "openalex", "arxiv", "crossref"].includes(x.trim().toLowerCase()))) return "sources must be a comma list of wikipedia,openalex,arxiv,crossref";
    if (s(b.limit) && !(Number(b.limit) >= 1 && Number(b.limit) <= 30)) return "limit must be 1-30"; return null; },
  "/uk-property": (b) => first(!s(b.postcode) ? "missing postcode" : PC.test(s(b.postcode)) ? null : "postcode must be a full UK postcode, e.g. CB1 2AB",
    s(b.radius) && !(Number(b.radius) >= 50 && Number(b.radius) <= 1000) ? "radius must be 50-1000 metres" : null, s(b.limit) && !(Number(b.limit) >= 5 && Number(b.limit) <= 200) ? "limit must be 5-200" : null),
  "/uk-area": (b) => (!s(b.postcode) ? "missing postcode" : PC.test(s(b.postcode)) ? null : "postcode must be a full UK postcode, e.g. SW1A 2AA"),
};
function uk(b: any) { const n = s(b.number), m = s(b.name); if (!n && !m) return "missing number or name"; if (n && !CHNUM.test(n)) return "number must be a Companies House number: 8 digits (e.g. 00445790) or 2 letters + 6 digits (e.g. SC123456)"; if (!n && m.length < 2) return "name too short"; return null; }

export const TOOL_PATH: Record<string, string> = { read_url: "/read", extract_links: "/links", check_domain: "/check", company_research: "/company", uk_company: "/uk-company", uk_company_lite: "/uk-company-lite",
  company_full: "/company-full", convert_document: "/convert", create_monitor: "/monitor", wallet_balances: "/wallet", tx_status: "/tx", token_check: "/token-check", fx_rates: "/fx",
  ens_lookup: "/ens", token_metadata: "/token", token_allowance: "/allowance", contract_info: "/contract", gas_fees: "/gas", block_lookup: "/block", nft_lookup: "/nft", web_search: "/search", uk_property_prices: "/uk-property", uk_area_profile: "/uk-area" };
