// Free input validation that runs BEFORE x402 payment, so bad input never costs the caller.
import { PC } from "./ukdata";
import { isPhoneCountry, PHONE_ISO_CODES } from "./phone";
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

/** Map common agent aliases onto canonical input keys (mutates b). */
export function aliasInput(path: string, b: any) {
  if (!b || typeof b !== "object") return b;
  if (["/uk-dd", "/uk-company", "/uk-company-lite", "/uk-watch", "/kyb"].includes(path)) {
    if (!s(b.number) && s(b.company_number)) b.number = s(b.company_number);
  }
  const chainish = path.startsWith("/chain/") || ["/wallet", "/nft", "/token", "/allowance", "/contract"].includes(path);
  if (chainish) {
    if (!s(b.chain) && s(b.network)) b.chain = s(b.network);
    // Agents often send wallet= for the owner; map even when empty so ?wallet= is free 400 (via address).
    if (!s(b.address) && Object.prototype.hasOwnProperty.call(b, "wallet")) b.address = s(b.wallet);
  }
  // Agents often send domain= (like /domain|/check) for DNS; map even when empty so ?domain= is free 400.
  if (path === "/dns") {
    if (!s(b.name) && Object.prototype.hasOwnProperty.call(b, "domain")) b.name = s(b.domain);
  }
  // Agents often send number= for registry-style IDs; map even when empty so ?number= is free 400.
  if (path === "/partita-iva") {
    if (!s(b.vat) && !s(b.partita_iva) && Object.prototype.hasOwnProperty.call(b, "number")) b.vat = s(b.number);
    if (!s(b.vat) && Object.prototype.hasOwnProperty.call(b, "partita")) b.vat = s(b.partita);
  }
  if (path === "/orgnr") {
    if (!s(b.orgnr) && Object.prototype.hasOwnProperty.call(b, "number")) b.orgnr = s(b.number);
  }
  if (path === "/bn-ca") {
    if (!s(b.bn) && Object.prototype.hasOwnProperty.call(b, "number")) b.bn = s(b.number);
    if (!s(b.bn) && Object.prototype.hasOwnProperty.call(b, "business_number")) b.bn = s(b.business_number);
  }
  if (path === "/cvr") {
    if (!s(b.cvr) && Object.prototype.hasOwnProperty.call(b, "number")) b.cvr = s(b.number);
    if (!s(b.cvr) && Object.prototype.hasOwnProperty.call(b, "vat")) b.cvr = s(b.vat);
  }
  if (path === "/fn-at") {
    if (!s(b.fn) && Object.prototype.hasOwnProperty.call(b, "number")) b.fn = s(b.number);
    if (!s(b.fn) && Object.prototype.hasOwnProperty.call(b, "firmenbuch")) b.fn = s(b.firmenbuch);
  }
  if (path === "/kvk-nl") {
    if (!s(b.kvk) && Object.prototype.hasOwnProperty.call(b, "number")) b.kvk = s(b.number);
  }
  if (path === "/hr-de") {
    if (!s(b.hr) && Object.prototype.hasOwnProperty.call(b, "number")) b.hr = s(b.number);
  }
  if (path === "/nif-es") {
    if (!s(b.nif) && Object.prototype.hasOwnProperty.call(b, "number")) b.nif = s(b.number);
    if (!s(b.nif) && Object.prototype.hasOwnProperty.call(b, "vat")) b.nif = s(b.vat);
  }
  if (path === "/cin-in") {
    if (!s(b.cin) && Object.prototype.hasOwnProperty.call(b, "number")) b.cin = s(b.number);
  }
  return b;
}

export const VALIDATE: Record<string, (b: any) => string | null> = {
  "/read": (b) => url(b.url), "/links": (b) => url(b.url), "/meta": (b) => url(b.url),
  "/headers": (b) => {
    let x = s(b.url || b.domain); if (!x) return "missing url or domain"; if (!/^https?:\/\//i.test(x)) x = `https://${x}`; return url(x);
  },
  "/iban": (b) => {
    const x = s(b.iban).replace(/[\s\-]+/g, "").toUpperCase();
    if (!x) return "missing iban";
    if (x.length < 15 || x.length > 34) return "iban length must be 15-34";
    return /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(x) ? null : "iban must look like GB82WEST12345698765432";
  },
  "/phone": (b) => {
    const ph = s(b.phone); if (!ph) return "missing phone";
    const c = s(b.country).toUpperCase();
    if (c && !/^[A-Z]{2}$/.test(c)) return "country must be ISO 3166-1 alpha-2";
    if (c && !isPhoneCountry(c)) return `unsupported country=${c}; use one of ${PHONE_ISO_CODES.join(",")} or pass +E.164 / 00…`;
    const dig = ph.replace(/\D/g, "");
    if (ph.startsWith("+") || ph.startsWith("00")) {
      if (dig.length < 8 || dig.length > 15) return "phone E.164 must be 8-15 digits";
      return null;
    }
    if (!c) return "national phone requires country= (ISO alpha-2) or pass +E.164 / 00…";
    if (dig.length < 4 || dig.length > 15) return "phone digits length looks invalid";
    return null;
  },
  "/uk-postcode": (b) => {
    const x = s(b.postcode); if (!x) return "missing postcode";
    if (x.length > 16) return "postcode too long";
    return null;
  },
  "/siren": (b) => {
    const x = s(b.siren).replace(/\D/g, "");
    if (!s(b.siren)) return "missing siren";
    if (!x) return "siren must contain digits";
    return x.length === 9 ? null : "siren must be exactly 9 digits";
  },
  "/siret": (b) => {
    const x = s(b.siret).replace(/\D/g, "");
    if (!s(b.siret)) return "missing siret";
    if (!x) return "siret must contain digits";
    return x.length === 14 ? null : "siret must be exactly 14 digits";
  },
  "/partita-iva": (b) => {
    const raw = s(b.vat) || s(b.partita_iva) || s(b.number) || s(b.partita);
    if (!raw) return "missing vat";
    let cleaned = raw.replace(/[\s\-]/g, "").toUpperCase();
    if (cleaned.startsWith("IT")) cleaned = cleaned.slice(2);
    const x = cleaned.replace(/\D/g, "");
    if (!x) return "vat must contain digits";
    return x.length === 11 ? null : "partita IVA must be exactly 11 digits (optional IT prefix)";
  },
  "/orgnr": (b) => {
    const raw = s(b.orgnr) || s(b.number);
    const x = raw.replace(/\D/g, "");
    if (!raw) return "missing orgnr";
    if (!x) return "orgnr must contain digits";
    if (x.length === 10 || x.length === 12) return null;
    return "orgnr must be 10 digits (or 12-digit YYYY+orgnr form)";
  },
  "/bn-ca": (b) => {
    const raw = s(b.bn) || s(b.number) || s(b.business_number);
    if (!raw) return "missing bn";
    const cleaned = raw.replace(/[\s\-]/g, "").toUpperCase();
    if (/^\d{9}$/.test(cleaned) || /^\d{9}[A-Z]{2}\d{4}$/.test(cleaned)) return null;
    return "bn must be 9 digits or 15-char program account (BN9 + 2-letter program + 4-digit ref)";
  },
  "/cvr": (b) => {
    const raw = s(b.cvr) || s(b.number) || s(b.vat);
    if (!raw) return "missing cvr";
    let cleaned = raw.replace(/[\s\-.]/g, "").toUpperCase();
    if (cleaned.startsWith("DK")) cleaned = cleaned.slice(2);
    const x = cleaned.replace(/\D/g, "");
    if (!x) return "cvr must contain digits";
    if (x.length !== 8) return "cvr must be exactly 8 digits (optional DK prefix)";
    return null;
  },
  "/fn-at": (b) => {
    const raw = s(b.fn) || s(b.number) || s(b.firmenbuch);
    if (!raw) return "missing fn";
    let cleaned = raw.replace(/\s+/g, "").toUpperCase();
    if (cleaned.startsWith("FN")) cleaned = cleaned.slice(2);
    if (!/^\d{1,6}[A-Z]\d{0,3}$/.test(cleaned)) return "fn must be 1–6 digits + check letter (optional FN prefix; optional ≤3 branch digits)";
    return null;
  },
  "/kvk-nl": (b) => (s(b.kvk) || s(b.number)) ? null : "missing kvk",
  "/hr-de": (b) => (s(b.hr) || s(b.number)) ? null : "missing hr",
  "/nif-es": (b) => (s(b.nif) || s(b.number) || s(b.vat)) ? null : "missing nif",
  "/cin-in": (b) => {
    const raw = s(b.cin) || s(b.number);
    if (!raw) return "missing cin";
    const cleaned = raw.replace(/[\s\-]/g, "").toUpperCase();
    if (cleaned.length !== 21) return "cin must be exactly 21 characters";
    if (!/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(cleaned)) return "cin must match [LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}";
    return null;
  },
  "/redirects": (b) => {
    let x = s(b.url); if (!x) return "missing url"; if (!/^https?:\/\//i.test(x)) x = `https://${x}`; return url(x);
  }, "/convert": (b) => first(url(b.url), b.format && !["markdown", "text"].includes(b.format) ? "format must be markdown or text" : null),
  "/email-check": (b) => { const e = s(b.email); if (!e) return "email required"; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? null : "email must look like name@domain.tld"; },
  "/domain": (b) => domainish(b.domain),
  "/dns": (b) => {
    const n = domainish(b.name, "name"); if (n) return n;
    const ty = s(b.type); if (!ty) return null;
    const allow = new Set(["A","AAAA","MX","TXT","NS","CNAME","SOA","PTR","CAA"]);
    const bad = ty.split(/[\s,|]+/).map((x) => x.trim().toUpperCase()).filter(Boolean).filter((x) => !allow.has(x));
    return bad.length ? `unsupported DNS type(s): ${bad.join(",")}` : null;
  },
  "/check": (b) => domainish(b.domain),
  "/company": (b) => {
    if (!s(b.domain || b.name || b.url) && s(b.number)) return "domain required (got number= — for UK Companies House use /uk-company?number=)";
    return domainish(b.domain || b.name || b.url);
  },
  "/company-full": (b) => {
    if (!s(b.domain || b.name || b.url) && s(b.number)) return "domain required (got number= — for UK Companies House use /uk-company?number=, or pass domain= for /company-full)";
    return domainish(b.domain || b.name || b.url);
  },
  "/uk-company": (b) => uk(b), "/uk-company-lite": (b) => uk(b),
  "/uk-charity": (b) => charity(b), "/uk-charity-full": (b) => charity(b),
  "/us-sec": (b) => sec(b), "/us-sec-full": (b) => sec(b),
  "/eu-vat": (b) => vat(b),
  "/lei": (b) => lei(b),
  "/lei-full": (b) => leiFull(b),
  "/read-batch": (b) => readBatch(b),
  "/registry-batch": (b) => { const n = (s(b.uk) + "," + s(b.au) + "," + s(b.ca)).split(/[\s,;]+/).filter((x) => /\d/.test(x)).length; return n === 0 ? "uk, au or ca ids required" : n > 25 ? "max 25 ids total" : null; },
  "/ca-company": (b) => { const n = s(b.number).replace(/\D/g, ""), bn = s(b.bn).replace(/\D/g, ""); return (n && n.length <= 8) || bn.length >= 9 ? null : "number (up to 8 digits) or bn (9 digits) required"; },
  "/au-company": (b) => { const r = s(b.acn || b.abn).replace(/\s/g, ""); return /^(\d{9}|\d{11})$/.test(r) ? null : "acn must be 9 digits (or abn 11 digits)"; },
  "/monitor": (b) => first(url(b.url), url(b.webhook, "webhook"), s(b.webhook) && !s(b.webhook).startsWith("https://") ? "webhook must be https" : null),
  "/wallet": (b) => first(addr(b.address, "address"), chain(b.chain), s(b.tokens) && s(b.tokens).split(",").some((t) => !ADDR.test(t.trim())) ? "tokens must be comma-separated 0x addresses" : null, s(b.tokens).split(",").length > 10 ? "max 10 tokens" : null),
  "/tx": (b) => first(!s(b.hash) ? "missing hash" : HASH.test(s(b.hash)) ? null : "hash must be 0x + 64 hex chars", chain(b.chain)),
  "/token-check": (b) => first(addr(b.address, "address"), chain(b.chain)), "/token": (b) => first(addr(b.address, "address"), chain(b.chain)),
  "/contract": (b) => first(addr(b.address, "address"), chain(b.chain)),
  "/fx": (b) => first(
    s(b.from) && !s(b.base) ? "use base= (not from=), e.g. base=USD" : null,
    s(b.to) && !s(b.symbols) ? "use symbols= (not to=), e.g. symbols=GBP,EUR" : null,
    s(b.base) && !ISO.test(s(b.base)) ? "base must be a 3-letter ISO currency, e.g. GBP" : null,
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
  "/uk-leads": (b) => leads(b), "/uk-leads-lite": (b) => leads(b),
  "/uk-leads-feed": (b) => first(leadsFilter(b), url(b.webhook, "webhook"), s(b.webhook) && !s(b.webhook).startsWith("https://") ? "webhook must be https" : null),
  "/uk-watch": (b) => { aliasInput("/uk-watch", b); return first(!s(b.number) ? "missing number" : CHNUM.test(s(b.number)) ? null : "number must be a Companies House number", url(b.webhook, "webhook"), s(b.webhook) && !s(b.webhook).startsWith("https://") ? "webhook must be https" : null); },
  "/uk-dd": (b) => ukDd(b),
  "/kyb": (b) => kyb(b),
  "/sanctions": (b) => sanctions(b),
  "/sanctions-batch": (b) => sanctionsBatch(b),
  "/uk-officer": (b) => officer(b),
};

function sec(b: any) {
  const t = s(b.ticker), c = s(b.cik);
  if (!t && !c) return "missing ticker or cik";
  if (t && !/^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(t)) return "ticker must look like AAPL or BRK.B";
  if (c && !/^\d{1,10}$/.test(c)) return "cik must be 1-10 digits";
  return null;
}
function vat(b: any) {
  const v = s(b.vat).toUpperCase().replace(/[\s.-]/g, "");
  const country = s(b.country).toUpperCase();
  const number = s(b.number).toUpperCase().replace(/[\s.-]/g, "");
  if (v) {
    if (!/^(?:GR|[A-Z]{2})[A-Z0-9]{2,12}$/.test(v) || !/\d/.test(v.slice(2))) return "vat must look like DE123456789 or IE6388047V";
    return null;
  }
  if (!country || !number) return "missing vat (e.g. IE6388047V) or country+number";
  if (!/^[A-Z]{2}$/.test(country)) return "country must be a 2-letter code (EL for Greece)";
  if (!/^[A-Z0-9]{2,12}$/.test(number) || !/\d/.test(number)) return "number must be 2-12 alphanumeric with at least one digit";
  return null;
}
function uk(b: any) { aliasInput("/uk-company", b); const n = s(b.number), m = s(b.name); if (!n && !m) return "missing number or name"; if (n && !CHNUM.test(n)) return "number must be a Companies House number: 8 digits (e.g. 00445790) or 2 letters + 6 digits (e.g. SC123456)"; if (!n && m.length < 2) return "name too short"; return null; }
const CNUM = /^\d{5,8}(?:[-\/]\d{1,2})?$/;
function charity(b: any) { const n = s(b.number), m = s(b.name); if (!n && !m) return "missing number or name"; if (n && !CNUM.test(n)) return "number must be a Charity Commission registered number, e.g. 1089464 or 1089464/0"; if (s(b.suffix) && !/^\d{1,2}$/.test(s(b.suffix))) return "suffix must be 0-99"; if (!n && m.length < 2) return "name too short"; return null; }


function leadsFilter(b: any) {
  const sic = s(b.sic), loc = s(b.location), pa = s(b.postcode_area);
  if (!sic && !loc && !pa) return "provide sic and/or location and/or postcode_area";
  if (sic && !/^\d{2,5}$/.test(sic)) return "sic must be a 2-5 digit SIC code or prefix, e.g. 62 or 62012";
  if (pa && !/^[A-Za-z]{1,2}\d{0,2}$/.test(pa)) return "postcode_area must look like M, SW, SW1, B1";
  if (loc && loc.length < 2) return "location too short";
  if (s(b.days) && !(Number(b.days) >= 1 && Number(b.days) <= 7)) return "days must be 1-7";
  if (s(b.limit) && !(Number(b.limit) >= 1 && Number(b.limit) <= 100)) return "limit must be 1-100";
  return null;
}
function leads(b: any) { return leadsFilter(b); }
function sanctions(b: any) {
  const n = s(b.name);
  if (n.length < 2) return "missing name (2+ chars)";
  if (n.length > 200) return "name max 200 chars";
  if (s(b.type) && !/^(individual|person|entity|company|organisation|organization)$/i.test(s(b.type))) return "type must be individual|entity (or person|company)";
  if (s(b.year) && !/^(19|20)\d{2}$/.test(s(b.year))) return "year must be a 4-digit year";
  if (s(b.dob) && s(b.dob).length > 32) return "dob too long";
  if (s(b.country) && s(b.country).length > 64) return "country too long";
  return null;
}
function sanctionsBatch(b: any) {
  let names = b.names;
  if (typeof names === "string") {
    try { names = JSON.parse(names); } catch { names = String(names).split(/[\n;]/).map((x: string) => x.trim()).filter(Boolean); }
  }
  if (!Array.isArray(names) || !names.length) return "missing names array (1-50 items)";
  if (names.length > 50) return "names max 50 per call";
  for (const item of names.slice(0, 3)) {
    const n = typeof item === "string" ? item : s(item?.name);
    if (!n || n.length < 2) return "each names[] item needs a name (2+ chars)";
  }
  return null;
}

function officer(b: any) {
  const n = s(b.name);
  if (n.length < 2) return "missing name (2-100 chars)";
  if (n.length > 100) return "name max 100 chars";
  if (s(b.limit) && !(Number(b.limit) >= 1 && Number(b.limit) <= 25)) return "limit must be 1-25";
  return null;
}
function lei(b: any) {
  const l = s(b.lei).toUpperCase().replace(/[\s-]/g, "");
  const name = s(b.name), reg = s(b.registered_as), country = s(b.country).toUpperCase();
  if (!l && !name && !reg) return "missing lei (20-char) or name or registered_as";
  if (l && !/^[A-Z0-9]{20}$/.test(l)) return "lei must be 20 alphanumeric chars";
  if (country && !/^[A-Z]{2}$/.test(country)) return "country must be ISO2";
  if (country && !name && !reg && !l) return "country requires name or registered_as";
  return null;
}
function leiFull(b: any) {
  const l = s(b.lei).toUpperCase().replace(/[\s-]/g, "");
  const name = s(b.name), reg = s(b.registered_as), country = s(b.country).toUpperCase();
  if (!l && !name && !reg) return "missing name or registered_as (or lei)";
  if (l && !name && !reg && !/^[A-Z0-9]{20}$/.test(l)) return "lei must be 20 alphanumeric chars";
  if (country && !/^[A-Z]{2}$/.test(country)) return "country must be ISO2";
  return null;
}
function readBatch(b: any) {
  let urls = b.urls;
  if (typeof urls === "string") {
    const raw = urls.trim();
    if (raw.startsWith("[")) { try { urls = JSON.parse(raw); } catch { urls = raw.split(/[\s,]+/).filter(Boolean); } }
    else urls = raw.split(/[\s,]+/).filter(Boolean);
  }
  if (!Array.isArray(urls) || !urls.length) return "missing urls (comma-separated or JSON array, max 8 http(s))";
  if (urls.length > 8) return "max 8 urls per call";
  for (const u of urls.slice(0, 3)) {
    const e = url(u);
    if (e) return e.replace(/^url/, "each url");
  }
  return null;
}
function ukDd(b: any) {
  aliasInput("/uk-dd", b);
  const number = s(b.number), name = s(b.name), domain = s(b.domain);
  if (!number && !name) return "missing number or name";
  if (number && !CHNUM.test(number)) return "number must be a Companies House number: 8 digits (e.g. 00445790) or 2 letters + 6 digits (e.g. SC123456)";
  if (!number && name.length < 2) return "name too short";
  if (domain) { const d = domainish(domain); if (d) return d; }
  return null;
}
function kyb(b: any) {
  aliasInput("/kyb", b);
  const domain = s(b.domain), number = s(b.number), name = s(b.name), vat = s(b.vat);
  if (!domain && !number && !name && !vat && !s(b.acn) && !s(b.abn) && !s(b.ca_number) && !s(b.bn) && !(s(b.country) && s(b.vat_number)) && !s(b.lei)) return "provide domain and/or UK number/name, AU acn/abn, CA ca_number/bn, EU vat and/or lei";
  if (domain) { const d = domainish(domain); if (d) return d; }
  if (number && !CHNUM.test(number)) return "number must be a Companies House number";
  if (vat && (!/^(?:GR|[A-Z]{2})[A-Z0-9]{2,12}$/i.test(vat.replace(/[\s.-]/g, "")) || !/\d/.test(vat.replace(/[\s.-]/g, "").slice(2)))) return "vat must look like DE123456789 or IE6388047V";
  if (s(b.lei) && !/^[A-Z0-9]{20}$/i.test(s(b.lei).replace(/[\s-]/g, ""))) return "lei must be 20 alphanumeric chars";
  return null;
}

export const TOOL_PATH: Record<string, string> = { read_url: "/read", extract_links: "/links", check_domain: "/check", company_research: "/company", uk_company: "/uk-company", uk_company_lite: "/uk-company-lite",
  company_full: "/company-full", convert_document: "/convert", create_monitor: "/monitor", wallet_balances: "/wallet", tx_status: "/tx", token_check: "/token-check", fx_rates: "/fx", au_company: "/au-company", ca_company: "/ca-company", registry_batch: "/registry-batch",
  ens_lookup: "/ens", token_metadata: "/token", token_allowance: "/allowance", contract_info: "/contract", gas_fees: "/gas", block_lookup: "/block", nft_lookup: "/nft", web_search: "/search", uk_property_prices: "/uk-property", uk_area_profile: "/uk-area", uk_charity: "/uk-charity", uk_charity_full: "/uk-charity-full", us_sec: "/us-sec", us_sec_full: "/us-sec-full", eu_vat: "/eu-vat", lei_lookup: "/lei", lei_full: "/lei-full", read_batch: "/read-batch", uk_leads: "/uk-leads", uk_leads_lite: "/uk-leads-lite", uk_leads_feed: "/uk-leads-feed", uk_watch: "/uk-watch", uk_dd: "/uk-dd", kyb_report: "/kyb", email_check: "/email-check", domain_lookup: "/domain", dns_lookup: "/dns", url_redirects: "/redirects", page_meta: "/meta", http_headers: "/headers", iban_validate: "/iban", phone_check: "/phone", uk_postcode_validate: "/uk-postcode", siren_validate: "/siren", siret_validate: "/siret", partita_iva_validate: "/partita-iva", orgnr_se_validate: "/orgnr", bn_ca_validate: "/bn-ca", cvr_dk_validate: "/cvr", fn_at_validate: "/fn-at", cin_in_validate: "/cin-in", kvk_nl_validate: "/kvk-nl", hr_de_validate: "/hr-de", nif_es_validate: "/nif-es", sanctions_screen: "/sanctions", sanctions_batch: "/sanctions-batch", uk_officer: "/uk-officer" };
