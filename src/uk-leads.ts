import { UserError } from "./core";

const CH_API = "https://api.company-information.service.gov.uk";
const UA = "AgentReader/1.9 (+https://api.axiomworks.co.uk; UK new-incorporation leads)";
const CACHE_PREFIX = "ukleads:v1:";

const MASS_AGENT_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "71-75 shelton street", label: "Shelton Street / Covent Garden (common formation agent)" },
  { pattern: "167-169 great portland street", label: "Great Portland Street (common virtual office)" },
  { pattern: "20-22 wenlock road", label: "Wenlock Road (common formation agent)" },
  { pattern: "86-90 paul street", label: "Paul Street (common virtual office)" },
  { pattern: "124 city road", label: "124 City Road (common formation agent address)" },
  { pattern: "kemp house", label: "Kemp House City Road (common formation agent)" },
  { pattern: "international house, 12 constance street", label: "Constance Street International House" },
];

type EnvKV = { LOG: KVNamespace; CH_API_KEY?: string };

function basicAuth(key: string) {
  return "Basic " + btoa(`${key}:`);
}

function addrString(a: any): string {
  if (!a) return "";
  if (typeof a === "string") return a;
  return [a.premises, a.address_line_1, a.address_line_2, a.locality, a.region, a.postal_code, a.country].filter(Boolean).join(", ");
}

function massAgent(address: string | null) {
  const s = (address || "").toLowerCase().replace(/\s+/g, " ");
  if (!s) return { matched: false, label: null as string | null };
  for (const { pattern, label } of MASS_AGENT_PATTERNS) if (s.includes(pattern)) return { matched: true, label };
  return { matched: false, label: null };
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseDays(v: any, def = 1) {
  const n = Number(v ?? def);
  if (!Number.isFinite(n) || n < 1 || n > 7) throw new UserError("days must be 1-7");
  return Math.floor(n);
}

function parseLimit(v: any, max: number, def: number) {
  const n = Number(v ?? def);
  if (!Number.isFinite(n) || n < 1 || n > max) throw new UserError(`limit must be 1-${max}`);
  return Math.floor(n);
}

function normalizeSic(raw: string): string {
  const s = raw.trim();
  if (!/^\d{2,5}$/.test(s)) throw new UserError("sic must be a 2-5 digit SIC code or prefix, e.g. 62 or 62012");
  return s;
}

function normalizePostcodeArea(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]{1,2}\d{0,2}$/.test(s)) throw new UserError("postcode_area must look like M, SW, SW1, B1");
  return s;
}

async function apiGet(env: EnvKV, path: string): Promise<any> {
  const key = (env.CH_API_KEY || "").trim();
  if (!key) throw new UserError("CH_API_KEY not configured", 503);
  const source = `${CH_API}${path}`;
  const r = await fetch(source, {
    headers: { authorization: basicAuth(key), accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 429) throw new UserError("Companies House rate limited; retry shortly", 429);
  if (!r.ok) throw new UserError(`Companies House http ${r.status}`, r.status === 404 ? 404 : 502);
  return r.json();
}

async function cachedJson(env: EnvKV, key: string, ttl: number, fn: () => Promise<any>) {
  const hit = await env.LOG.get(CACHE_PREFIX + key, "json");
  if (hit) return hit;
  const data = await fn();
  try {
    // CF free-tier daily KV put limit: never fail the response just because cache write failed.
    await env.LOG.put(CACHE_PREFIX + key, JSON.stringify(data), { expirationTtl: ttl });
  } catch {}
  return data;
}

async function fetchOfficers(env: EnvKV, number: string) {
  return cachedJson(env, `off:${number}`, 86400, async () => {
    try {
      const data = await apiGet(env, `/company/${number}/officers?items_per_page=50`);
      const items = (data.items || [])
        .filter((o: any) => !o.resigned_on)
        .slice(0, 8)
        .map((o: any) => ({
          name: o.name || null,
          role: o.officer_role || null,
          appointed_on: o.appointed_on || null,
          nationality: o.nationality || null,
          country_of_residence: o.country_of_residence || null,
        }));
      return { directors: items, total_active: items.length };
    } catch {
      return { directors: [], total_active: 0, error: "officers_unavailable" };
    }
  });
}

export type UkLeadsInput = {
  sic?: string;
  location?: string;
  postcode_area?: string;
  days?: number | string;
  limit?: number | string;
  lite?: boolean;
};

export async function ukLeads(env: EnvKV, input: UkLeadsInput) {
  const lite = !!input.lite;
  const sic = (input.sic || "").trim() ? normalizeSic(String(input.sic)) : "";
  const location = (input.location || "").trim();
  const postcodeArea = (input.postcode_area || "").trim() ? normalizePostcodeArea(String(input.postcode_area)) : "";
  if (!sic && !location && !postcodeArea) {
    throw new UserError("provide sic and/or location and/or postcode_area (refusing unfiltered register dump)");
  }
  if (location && location.length < 2) throw new UserError("location too short");
  if (location.length > 80) throw new UserError("location too long");

  const days = parseDays(input.days, 1);
  const limit = parseLimit(input.limit, lite ? 100 : 40, lite ? 50 : 25);
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 864e5);
  const incorporated_from = ymd(from);
  const incorporated_to = ymd(to);

  const cacheKey = `q:${lite ? "L" : "F"}:${sic}|${location.toLowerCase()}|${postcodeArea}|${days}|${limit}|${incorporated_from}`;
  return cachedJson(env, cacheKey, lite ? 3600 : 1800, async () => {
    const pageSize = 100;
    const maxScan = Math.min(500, Math.max(limit * 5, 100));
    let start = 0;
    let hits_total = 0;
    const collected: any[] = [];

    while (collected.length < limit && start < maxScan) {
      const params = new URLSearchParams({
        incorporated_from,
        incorporated_to,
        company_status: "active",
        size: String(pageSize),
        start_index: String(start),
      });
      if (sic) params.set("sic_codes", sic);
      if (location) params.set("location", location);
      const data = await apiGet(env, `/advanced-search/companies?${params}`);
      hits_total = Number(data.hits || 0);
      const items = data.items || [];
      if (!items.length) break;
      for (const it of items) {
        const address = it.registered_office_address || null;
        const pc = (address?.postal_code || "").toUpperCase().replace(/\s+/g, "");
        if (postcodeArea && !pc.startsWith(postcodeArea)) continue;
        const office = addrString(address);
        const mass = massAgent(office);
        collected.push({
          company_number: it.company_number,
          company_name: it.company_name,
          company_status: it.company_status,
          date_of_creation: it.date_of_creation,
          company_type: it.company_type || null,
          sic_codes: it.sic_codes || [],
          registered_office: office || null,
          postcode: address?.postal_code || null,
          locality: address?.locality || null,
          region: address?.region || null,
          mass_formation_office: mass,
          ch_url: `https://find-and-update.company-information.service.gov.uk/company/${it.company_number}`,
        });
        if (collected.length >= limit) break;
      }
      start += items.length;
      if (start >= hits_total) break;
    }

    let companies = collected;
    if (!lite) {
      const enriched = [];
      for (const c of companies) {
        const off = await fetchOfficers(env, c.company_number);
        enriched.push({ ...c, directors: off.directors, directors_active: off.total_active });
      }
      companies = enriched;
    }

    return {
      product: lite ? "uk-leads-lite" : "uk-leads",
      query: { sic: sic || null, location: location || null, postcode_area: postcodeArea || null, days, limit, incorporated_from, incorporated_to },
      hits_total_unfiltered_by_postcode: hits_total,
      returned: companies.length,
      companies,
      notes: [
        "Source: UK Companies House advanced search + officers API (public register).",
        "Not investment advice. Officer names are personal data published on the public register; buyers must have a lawful basis for their use.",
        lite ? "Lite excludes directors — upgrade to /uk-leads for active officer names." : "Directors list is active (non-resigned) officers only, capped per company.",
      ],
      attribution: "Contains public sector information licensed under the Open Government Licence v3.0.",
      sources: { companies_house_api: CH_API, advanced_search: `${CH_API}/advanced-search/companies` },
      upsell: lite
        ? { next: "/uk-leads", price: "$1.00", why: "same filters + active director names + mass-formation flags" }
        : { next: "/uk-leads-feed", price: "$25.00/30d", why: "daily webhook of new matches for this filter" },
    };
  });
}

export type LeadsFeed = {
  id: string;
  kind: "uk-leads-feed";
  sic: string | null;
  location: string | null;
  postcode_area: string | null;
  webhook: string;
  created: string;
  expires: string;
  last_run?: string | null;
  last_delivered?: number;
  runs: number;
  last_error?: string | null;
  active: boolean;
  seen: string[]; // recent company numbers to dedupe
};

function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}

const FEED_TTL_DAYS = 30;
const MAX_FEEDS = 30;

export async function createLeadsFeed(env: EnvKV, body: {
  webhook: string; sic?: string; location?: string; postcode_area?: string;
}): Promise<LeadsFeed> {
  const webhook = (body.webhook || "").trim();
  if (!webhook) throw new UserError("missing webhook");
  let wh: URL; try { wh = new URL(webhook); } catch { throw new UserError("invalid webhook url"); }
  if (wh.protocol !== "https:") throw new UserError("webhook must be https");

  const sic = (body.sic || "").trim() ? normalizeSic(String(body.sic)) : "";
  const location = (body.location || "").trim();
  const postcode_area = (body.postcode_area || "").trim() ? normalizePostcodeArea(String(body.postcode_area)) : "";
  if (!sic && !location && !postcode_area) throw new UserError("provide sic and/or location and/or postcode_area");

  try {
    const listed = await env.LOG.list({ prefix: "leadsfeed:" });
    if (listed.keys.length >= MAX_FEEDS) throw new UserError(`leads-feed capacity reached (${MAX_FEEDS})`, 503);
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    console.log("leadsfeed list cap skipped", e?.message || e);
  }

  // validate filter produces something / CH reachable
  await ukLeads(env, { sic, location, postcode_area, days: 1, limit: 5, lite: true });

  const id = newId();
  const now = new Date();
  const expires = new Date(now.getTime() + FEED_TTL_DAYS * 864e5);
  const feed: LeadsFeed = {
    id, kind: "uk-leads-feed",
    sic: sic || null, location: location || null, postcode_area: postcode_area || null,
    webhook, created: now.toISOString(), expires: expires.toISOString(),
    last_run: null, last_delivered: 0, runs: 0, last_error: null, active: true, seen: [],
  };
  await env.LOG.put(`leadsfeed:${id}`, JSON.stringify(feed), {
    expirationTtl: (FEED_TTL_DAYS + 1) * 86400,
    metadata: { id, expires: feed.expires, active: true },
  });
  return feed;
}

export async function getLeadsFeed(env: EnvKV, id: string): Promise<LeadsFeed | null> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return null;
  return (await env.LOG.get(`leadsfeed:${id}`, "json")) as LeadsFeed | null;
}

export async function runLeadsFeeds(env: EnvKV) {
  let listed: any;
  try { listed = await env.LOG.list({ prefix: "leadsfeed:" }); }
  catch (e: any) { console.log("runLeadsFeeds list failed", e?.message || e); return { ran: 0, delivered: 0, errors: 0, skipped: "kv_list_limit" }; }
  let ran = 0, delivered = 0, errors = 0;
  const now = Date.now();
  for (const k of listed.keys) {
    const feed = (await env.LOG.get(k.name, "json")) as LeadsFeed | null;
    if (!feed || !feed.active) continue;
    if (new Date(feed.expires).getTime() < now) {
      feed.active = false;
      await env.LOG.put(k.name, JSON.stringify(feed), { expirationTtl: 7 * 86400, metadata: { id: feed.id, active: false, expired: true } });
      continue;
    }
    ran++;
    try {
      const result = await ukLeads(env, {
        sic: feed.sic || undefined,
        location: feed.location || undefined,
        postcode_area: feed.postcode_area || undefined,
        days: 1, limit: 40, lite: false,
      });
      const seen = new Set(feed.seen || []);
      const fresh = (result.companies || []).filter((c: any) => c.company_number && !seen.has(c.company_number));
      for (const c of fresh) seen.add(c.company_number);
      feed.seen = [...seen].slice(-500);
      if (fresh.length) {
        const payload = {
          type: "uk-leads-feed",
          feed_id: feed.id,
          delivered_at: new Date().toISOString(),
          query: { sic: feed.sic, location: feed.location, postcode_area: feed.postcode_area },
          count: fresh.length,
          companies: fresh,
          attribution: result.attribution,
        };
        const r = await fetch(feed.webhook, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": UA },
          body: JSON.stringify(payload).slice(0, 900_000),
          signal: AbortSignal.timeout(12000),
        });
        if (!r.ok) throw new Error(`webhook http ${r.status}`);
        delivered += fresh.length;
        feed.last_delivered = fresh.length;
      } else {
        feed.last_delivered = 0;
      }
      feed.last_run = new Date().toISOString();
      feed.runs += 1;
      feed.last_error = null;
    } catch (e: any) {
      errors++;
      feed.last_error = String(e?.message || e).slice(0, 300);
      feed.last_run = new Date().toISOString();
    }
    const ttl = Math.max(60, Math.floor((new Date(feed.expires).getTime() - now) / 1000) + 86400);
    await env.LOG.put(k.name, JSON.stringify(feed), { expirationTtl: ttl, metadata: { id: feed.id, expires: feed.expires, active: true } });
  }
  return { ran, delivered, errors };
}
