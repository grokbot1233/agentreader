import { UserError } from "./core";

const UA = "AxiomWorksAgentReader/1.7 (+https://api.axiomworks.co.uk; info@axiomworks.co.uk)";
const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SUB_BASE = "https://data.sec.gov/submissions/CIK";
const FACTS_BASE = "https://data.sec.gov/api/xbrl/companyfacts/CIK";
const NOTE =
  "SEC EDGAR data is public; fair-use / attribution: https://www.sec.gov/os/accessing-edgar-data. Not investment advice.";
const CACHE_PREFIX = "sec:v1:";
const TICKERS_TTL = 86400; // 24h
const SUB_TTL = 3600; // 1h
const FACTS_TTL = 3600;
const KEY_FACTS = [
  "Assets",
  "Liabilities",
  "StockholdersEquity",
  "Revenues",
  "NetIncomeLoss",
  "EarningsPerShareDiluted",
] as const;

type EnvKV = { LOG: KVNamespace };

function s(v: any) {
  return v == null ? "" : String(v).trim();
}

function padCik(cik: string | number): string {
  const n = String(cik).replace(/\D/g, "");
  if (!n) throw new UserError("cik must be numeric");
  return n.padStart(10, "0");
}

async function kvGet(env: EnvKV, k: string) {
  try {
    return await env.LOG.get(k, "json");
  } catch {
    return null;
  }
}
async function kvPut(env: EnvKV, k: string, v: any, ttl: number) {
  try {
    await env.LOG.put(k, JSON.stringify(v), { expirationTtl: ttl });
  } catch {}
}

async function secFetch(url: string): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (r.status === 404) throw new UserError("SEC company not found", 404);
      if (r.status === 429) {
        await new Promise((res) => setTimeout(res, 800));
        lastErr = new UserError("SEC rate limited; retry shortly", 429);
        continue;
      }
      if (!r.ok) throw new UserError(`SEC HTTP ${r.status}`, r.status >= 500 ? 502 : r.status);
      return await r.json();
    } catch (e: any) {
      if (e instanceof UserError) throw e;
      lastErr = e;
      await new Promise((res) => setTimeout(res, 400));
    }
  }
  throw new UserError(`SEC fetch failed: ${String(lastErr?.message || lastErr)}`, 502);
}

async function loadTickers(env: EnvKV): Promise<Record<string, { cik: string; ticker: string; title: string }>> {
  const ck = `${CACHE_PREFIX}tickers`;
  const hit = await kvGet(env, ck);
  if (hit && typeof hit === "object") return hit as any;
  const raw = await secFetch(TICKERS_URL);
  const map: Record<string, { cik: string; ticker: string; title: string }> = {};
  for (const row of Object.values(raw || {}) as any[]) {
    if (!row) continue;
    const ticker = s(row.ticker).toUpperCase();
    const cik = padCik(row.cik_str ?? row.cik);
    const title = s(row.title);
    if (ticker) map[ticker] = { cik, ticker, title };
    map[`CIK${cik}`] = { cik, ticker, title };
  }
  await kvPut(env, ck, map, TICKERS_TTL);
  return map;
}

async function resolveCik(env: EnvKV, opts: { ticker?: string; cik?: string }): Promise<{ cik: string; ticker: string | null; title: string | null }> {
  const cikIn = s(opts.cik);
  const tickerIn = s(opts.ticker).toUpperCase();
  if (!cikIn && !tickerIn) throw new UserError("missing ticker or cik");
  if (cikIn) {
    const cik = padCik(cikIn);
    // Prefer ticker map for title if available
    try {
      const map = await loadTickers(env);
      const hit = map[`CIK${cik}`];
      if (hit) return { cik, ticker: hit.ticker || null, title: hit.title || null };
    } catch {}
    return { cik, ticker: null, title: null };
  }
  const map = await loadTickers(env);
  const hit = map[tickerIn];
  if (!hit) throw new UserError(`ticker '${tickerIn}' not found in SEC company_tickers`, 404);
  return { cik: hit.cik, ticker: hit.ticker, title: hit.title };
}

async function loadSubmissions(env: EnvKV, cik: string) {
  const ck = `${CACHE_PREFIX}sub:${cik}`;
  const hit = await kvGet(env, ck);
  if (hit) return { data: hit as any, cache: "HIT" as const };
  const data = await secFetch(`${SUB_BASE}${cik}.json`);
  await kvPut(env, ck, data, SUB_TTL);
  return { data, cache: "MISS" as const };
}

async function loadFacts(env: EnvKV, cik: string) {
  const ck = `${CACHE_PREFIX}facts:${cik}`;
  const hit = await kvGet(env, ck);
  if (hit) return { data: hit as any, cache: "HIT" as const };
  try {
    const data = await secFetch(`${FACTS_BASE}${cik}.json`);
    await kvPut(env, ck, data, FACTS_TTL);
    return { data, cache: "MISS" as const };
  } catch (e: any) {
    if (e instanceof UserError && e.status === 404) return { data: null, cache: "MISS" as const };
    throw e;
  }
}

function addrBlock(a: any) {
  if (!a) return null;
  return {
    street1: a.street1 || null,
    street2: a.street2 || null,
    city: a.city || null,
    stateOrCountry: a.stateOrCountry || null,
    zipCode: a.zipCode || null,
  };
}

function recentFilings(sub: any, n = 15) {
  const recent = sub?.filings?.recent || {};
  const forms: string[] = recent.form || [];
  const filed: string[] = recent.filingDate || [];
  const accession: string[] = recent.accessionNumber || [];
  const primary: string[] = recent.primaryDocument || [];
  const reportDate: string[] = recent.reportDate || [];
  const out: any[] = [];
  const len = Math.min(n, forms.length);
  for (let i = 0; i < len; i++) {
    out.push({
      form: forms[i] || null,
      filed: filed[i] || null,
      accession: accession[i] || null,
      primaryDocument: primary[i] || null,
      reportDate: reportDate[i] || null,
    });
  }
  return out;
}

function pickFact(gaap: any, name: string) {
  const f = gaap?.[name];
  if (!f?.units) return null;
  // Prefer USD, then USD/shares, then first unit
  const unitKeys = Object.keys(f.units);
  const unit =
    unitKeys.find((u) => u === "USD") ||
    unitKeys.find((u) => u === "USD/shares") ||
    unitKeys[0];
  if (!unit) return null;
  const vals: any[] = f.units[unit] || [];
  if (!vals.length) return null;
  // Prefer 10-K / 10-Q annual/quarterly with end date; take last by end then filed
  const sorted = [...vals].sort((a, b) => {
    const ae = String(a.end || a.filed || "");
    const be = String(b.end || b.filed || "");
    return ae < be ? -1 : ae > be ? 1 : 0;
  });
  const last = sorted[sorted.length - 1];
  return {
    concept: name,
    unit,
    value: last.val ?? null,
    end: last.end || null,
    filed: last.filed || null,
    form: last.form || null,
    fy: last.fy ?? null,
    fp: last.fp || null,
  };
}

function redFlags(filings: any[]): { flag: string; reason: string; severity: "high" | "medium" | "low" }[] {
  const flags: { flag: string; reason: string; severity: "high" | "medium" | "low" }[] = [];
  const forms = filings.map((f) => String(f.form || "").toUpperCase());
  const nt = forms.filter((f) => /^NT\s*10-?K/.test(f) || f === "NT 10-K" || f.startsWith("NT 10-K"));
  if (nt.length >= 2)
    flags.push({ flag: "multiple_nt_10k", reason: `${nt.length} NT 10-K (late annual) filings in recent history`, severity: "high" });
  else if (nt.length === 1)
    flags.push({ flag: "nt_10k", reason: "Recent NT 10-K (notification of late filing)", severity: "medium" });

  // Item 4.02 often appears in 8-K primary doc name or as form description — we only have form list;
  // look for 8-K and note if many recent 8-Ks after NT
  const k8 = filings.filter((f) => /^8-?K/i.test(String(f.form || "")));
  // bankruptcy / going concern heuristics from form codes
  const bank = forms.filter((f) => /15-12|BANKR|N-?CSR|DEF\s*14/i.test(f) === false && (/^15-/.test(f) || f.includes("BANKR")));
  // Form types: 15-12B/G (termination), S-? wait — bankruptcy often Chapter 11 via 8-K; also look for "NTN" etc.
  if (forms.some((f) => /^15-12/.test(f)))
    flags.push({ flag: "registration_termination", reason: "Recent Form 15-12x (registration termination / deregistration)", severity: "high" });

  // Going-concern-ish: look at primaryDocument names in recent filings
  const docs = filings.map((f) => `${f.form || ""} ${f.primaryDocument || ""}`.toLowerCase());
  if (docs.some((d) => /going.?concern|bankrupt|chapter.?11|receivership|liquidation/i.test(d)))
    flags.push({ flag: "distress_keywords", reason: "Going concern / bankruptcy / liquidation keywords in recent form/document names", severity: "high" });

  // Many late notices
  const lateish = forms.filter((f) => f.startsWith("NT "));
  if (lateish.length >= 3)
    flags.push({ flag: "repeated_late_filings", reason: `${lateish.length} NT-* late-filing notices in recent window`, severity: "high" });

  // Recent 8-K Item 4.02: SEC submissions don't always expose items; check accession primary doc strings
  if (docs.some((d) => /4\.02|non-?reliance|restatement/i.test(d)))
    flags.push({ flag: "item_4_02_non_reliance", reason: "Possible 8-K Item 4.02 / non-reliance signal in recent documents", severity: "high" });

  if (!flags.length && k8.length >= 8)
    flags.push({ flag: "heavy_8k_activity", reason: `${k8.length} Form 8-K filings in last ~15 — elevated event activity`, severity: "low" });

  return flags;
}

function coreFromSub(sub: any, resolved: { cik: string; ticker: string | null; title: string | null }, cache: string) {
  const filings = recentFilings(sub, 15);
  const website = s(sub.website) || s(sub.investorWebsite) || null;
  return {
    queried_at: new Date().toISOString(),
    cik: resolved.cik,
    name: sub.name || resolved.title || null,
    tickers: Array.isArray(sub.tickers) ? sub.tickers : resolved.ticker ? [resolved.ticker] : [],
    exchanges: Array.isArray(sub.exchanges) ? sub.exchanges : [],
    sic: sub.sic || null,
    sicDescription: sub.sicDescription || null,
    ein: sub.ein || null,
    category: sub.category || null,
    fiscalYearEnd: sub.fiscalYearEnd || null,
    stateOfIncorporation: sub.stateOfIncorporationDescription || sub.stateOfIncorporation || null,
    addresses: {
      mailing: addrBlock(sub.addresses?.mailing),
      business: addrBlock(sub.addresses?.business),
    },
    phone: sub.phone || null,
    formerNames: (Array.isArray(sub.formerNames) ? sub.formerNames : []).slice(0, 5).map((f: any) => ({
      name: f.name || null,
      from: f.from || null,
      to: f.to || null,
    })),
    website,
    recent_filings: filings,
    cache,
    source: "SEC EDGAR",
    fair_use: NOTE,
    edgar_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${resolved.cik}&owner=exclude&count=40`,
  };
}

export async function usSec(
  env: EnvKV,
  opts: { ticker?: string; cik?: string; full?: boolean },
) {
  const resolved = await resolveCik(env, opts);
  const { data: sub, cache } = await loadSubmissions(env, resolved.cik);
  const core = coreFromSub(sub, resolved, cache);

  if (!opts.full) {
    return {
      ...core,
      bundle: "us-sec",
      price: "$0.05",
      upsell: "/us-sec-full for us-gaap key facts + red-flag heuristics ($0.25)",
    };
  }

  const { data: facts } = await loadFacts(env, resolved.cik);
  const gaap = facts?.facts?.["us-gaap"] || {};
  const highlights: Record<string, any> = {};
  for (const k of KEY_FACTS) {
    const p = pickFact(gaap, k);
    if (p) highlights[k] = p;
  }

  // Pull a wider window for red flags (up to 40)
  const filingsWide = recentFilings(sub, 40);
  const flags = redFlags(filingsWide);

  return {
    ...core,
    bundle: "us-sec-full",
    price: "$0.25",
    companyfacts_highlights: highlights,
    red_flags: flags,
    red_flag_count: flags.length,
    note: "companyfacts_highlights are last reported us-gaap values only; full XBRL blob not included.",
  };
}
