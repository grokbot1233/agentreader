import { UserError } from "./core";

const UA = "AxiomWorksAgentReader (+https://api.axiomworks.co.uk; info@axiomworks.co.uk)";
const API = "https://api.gleif.org/api/v1";
const CACHE_PREFIX = "lei:v1:";
const CACHE_TTL = 86400; // 24h — valid hits only
const LEI_RE = /^[A-Z0-9]{20}$/;

type EnvKV = { LOG: KVNamespace };

function s(v: any) {
  return v == null ? "" : String(v).trim();
}

async function kvGet(env: EnvKV, k: string) {
  try {
    return await env.LOG.get(k, "json");
  } catch {
    return null;
  }
}
async function kvPut(env: EnvKV, k: string, v: any, ttl = CACHE_TTL) {
  try {
    await env.LOG.put(k, JSON.stringify(v), { expirationTtl: ttl });
  } catch {}
}

function fmtAddr(a: any) {
  if (!a || typeof a !== "object") return null;
  const lines = Array.isArray(a.addressLines) ? a.addressLines.filter(Boolean) : [];
  return {
    lines,
    city: a.city || null,
    region: a.region || null,
    country: a.country || null,
    postal_code: a.postalCode || null,
  };
}

function identifiersFrom(attrs: any) {
  const out: { type: string; value: string }[] = [];
  const bic = Array.isArray(attrs.bic) ? attrs.bic.filter(Boolean) : attrs.bic ? [attrs.bic] : [];
  for (const b of bic.slice(0, 5)) out.push({ type: "bic", value: String(b) });
  for (const [k, type] of [["mic", "mic"], ["ocid", "ocid"], ["qcc", "qcc"], ["gem", "gem"], ["spglobal", "spglobal"]] as const) {
    const v = attrs[k];
    if (!v) continue;
    for (const x of (Array.isArray(v) ? v : [v])) {
      if (out.length >= 5) break;
      out.push({ type, value: String(x) });
    }
    if (out.length >= 5) break;
  }
  return { bic: bic.length ? bic : null, identifiers: out };
}

function cleanRecord(data: any, opts: { cache?: string; parents?: { direct: any; ultimate: any } } = {}) {
  const attrs = data?.attributes || {};
  const ent = attrs.entity || {};
  const reg = attrs.registration || {};
  const otherNames = Array.isArray(ent.otherNames)
    ? ent.otherNames.map((n: any) => ({ name: n?.name || null, type: n?.type || null, language: n?.language || null })).filter((n: any) => n.name)
    : [];
  const { bic, identifiers } = identifiersFrom(attrs);
  return {
    lei: attrs.lei || data?.id || null,
    legal_name: ent.legalName?.name || null,
    other_names: otherNames,
    status: {
      entity: ent.status || null,
      registration: reg.status || null,
    },
    legal_form: ent.legalForm?.id || ent.legalForm?.other || null,
    jurisdiction: ent.jurisdiction || null,
    legal_address: fmtAddr(ent.legalAddress),
    hq_address: fmtAddr(ent.headquartersAddress),
    registered_as: ent.registeredAs || reg.validatedAs || null,
    registration_authority: ent.registeredAt?.id || reg.validatedAt?.id || null,
    bic,
    identifiers,
    parents: opts.parents || { direct: null, ultimate: null },
    creation_date: ent.creationDate || null,
    initial_registration: reg.initialRegistrationDate || null,
    last_update: reg.lastUpdateDate || null,
    next_renewal: reg.nextRenewalDate || null,
    source: "gleif",
    fetched_at: new Date().toISOString(),
    cache: opts.cache || "MISS",
    price: "$0.005",
    product: "lei",
  };
}

async function gleifFetch(path: string) {
  return fetch(`${API}${path}`, {
    headers: { accept: "application/vnd.api+json", "user-agent": UA },
    signal: AbortSignal.timeout(12000),
  });
}

async function fetchByLei(lei: string) {
  const r = await gleifFetch(`/lei-records/${encodeURIComponent(lei)}`);
  if (r.status === 404) throw new UserError(`LEI ${lei} not found in GLEIF`, 404);
  if (!r.ok) {
    if (r.status >= 500) throw new UserError("GLEIF service unavailable; try again shortly", 503);
    throw new UserError(`GLEIF HTTP ${r.status}`, r.status);
  }
  const j: any = await r.json();
  return j.data;
}

async function searchRecords(opts: { name?: string; registered_as?: string; country?: string; size?: number }) {
  const params = new URLSearchParams();
  params.set("page[size]", String(Math.min(Math.max(opts.size || 5, 1), 10)));
  if (opts.name) params.set("filter[entity.legalName]", opts.name);
  if (opts.registered_as) params.set("filter[entity.registeredAs]", opts.registered_as);
  if (opts.country) params.set("filter[entity.legalAddress.country]", opts.country.toUpperCase());
  const r = await gleifFetch(`/lei-records?${params.toString()}`);
  if (!r.ok) {
    if (r.status >= 500) throw new UserError("GLEIF service unavailable; try again shortly", 503);
    throw new UserError(`GLEIF HTTP ${r.status}`, r.status);
  }
  const j: any = await r.json();
  const data = Array.isArray(j.data) ? j.data : [];
  if (!data.length) throw new UserError("no LEI records matched", 404);
  return { data, total: j.meta?.pagination?.total ?? data.length };
}

function parentLinkPresent(data: any, kind: "direct-parent" | "ultimate-parent") {
  const rel = data?.relationships?.[kind]?.links;
  return !!(rel && rel.related);
}

async function relatedParent(lei: string, kind: "direct-parent" | "ultimate-parent") {
  try {
    const r = await gleifFetch(`/lei-records/${encodeURIComponent(lei)}/${kind}`);
    if (r.status === 404 || !r.ok) return null;
    const j: any = await r.json();
    const d = j.data;
    if (!d) return null;
    const attrs = d.attributes || {};
    const ent = attrs.entity || {};
    return {
      lei: attrs.lei || d.id || null,
      legal_name: ent.legalName?.name || null,
      status: ent.status || null,
    };
  } catch {
    return null;
  }
}

async function withParents(data: any) {
  const lei = data?.attributes?.lei || data?.id;
  if (!lei) return { direct: null, ultimate: null };
  const [direct, ultimate] = await Promise.all([
    parentLinkPresent(data, "direct-parent") ? relatedParent(lei, "direct-parent") : Promise.resolve(null),
    parentLinkPresent(data, "ultimate-parent") ? relatedParent(lei, "ultimate-parent") : Promise.resolve(null),
  ]);
  return { direct, ultimate };
}

/** Single LEI (or best name/registered_as hit) with parents + BIC/ids. $0.005 */
export async function leiLookup(
  env: EnvKV,
  opts: { lei?: string; name?: string; registered_as?: string; country?: string },
) {
  const leiIn = s(opts.lei).toUpperCase().replace(/[\s-]/g, "");
  const name = s(opts.name);
  const registered_as = s(opts.registered_as);
  const country = s(opts.country).toUpperCase().replace(/[^A-Z]/g, "");

  if (!leiIn && !name && !registered_as) {
    throw new UserError("provide lei (20-char) or name or registered_as");
  }
  if (leiIn && !LEI_RE.test(leiIn)) throw new UserError("lei must be a 20-character alphanumeric Legal Entity Identifier");
  if (country && !/^[A-Z]{2}$/.test(country)) throw new UserError("country must be ISO2, e.g. US or GB");
  if (country && !name && !registered_as && !leiIn) throw new UserError("country requires name or registered_as");

  const cacheKey = leiIn
    ? `${CACHE_PREFIX}${leiIn}`
    : `${CACHE_PREFIX}q:${country || ""}:${registered_as || name}`.toLowerCase();

  const hit = await kvGet(env, cacheKey);
  if (hit && (hit as any).lei) {
    return { ...(hit as any), fetched_at: new Date().toISOString(), cache: "HIT", price: "$0.005", product: "lei" };
  }

  let data: any;
  try {
    if (leiIn) data = await fetchByLei(leiIn);
    else {
      const { data: rows } = await searchRecords({ name: name || undefined, registered_as: registered_as || undefined, country: country || undefined, size: 5 });
      data = rows[0];
    }
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    throw new UserError(`GLEIF request failed: ${String(e?.message || e)}`, 503);
  }

  const parents = await withParents(data);
  const out = cleanRecord(data, { parents, cache: "MISS" });
  const { cache: _c, fetched_at: _f, ...store } = out;
  await kvPut(env, cacheKey, store);
  if (out.lei && cacheKey !== `${CACHE_PREFIX}${out.lei}`) await kvPut(env, `${CACHE_PREFIX}${out.lei}`, store);
  return out;
}

/** Name/registered_as multi-match (up to 10) each with parents. $0.05 */
export async function leiFull(
  env: EnvKV,
  opts: { name?: string; registered_as?: string; country?: string; lei?: string },
) {
  const leiIn = s(opts.lei).toUpperCase().replace(/[\s-]/g, "");
  const name = s(opts.name);
  const registered_as = s(opts.registered_as);
  const country = s(opts.country).toUpperCase().replace(/[^A-Z]/g, "");

  // If only a single LEI given, return one enriched record shaped like search results
  if (leiIn && !name && !registered_as) {
    if (!LEI_RE.test(leiIn)) throw new UserError("lei must be a 20-character alphanumeric Legal Entity Identifier");
    const one = await leiLookup(env, { lei: leiIn });
    return {
      product: "lei-full",
      price: "$0.05",
      query: { lei: leiIn },
      count: 1,
      total_available: 1,
      results: [one],
      source: "gleif",
      fetched_at: new Date().toISOString(),
      note: "Single LEI given — prefer /lei $0.005 for one-record lookups; /lei-full is for name/registered_as screening up to 10.",
    };
  }
  if (!name && !registered_as) throw new UserError("provide name or registered_as for multi-match screening (or lei for single)");
  if (country && !/^[A-Z]{2}$/.test(country)) throw new UserError("country must be ISO2, e.g. US or GB");

  let rows: any[];
  let total: number;
  try {
    const r = await searchRecords({ name: name || undefined, registered_as: registered_as || undefined, country: country || undefined, size: 10 });
    rows = r.data;
    total = r.total;
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    throw new UserError(`GLEIF request failed: ${String(e?.message || e)}`, 503);
  }

  // Enrich each candidate with parents (concurrency 4)
  const results: any[] = new Array(rows.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
    while (i < rows.length) {
      const idx = i++;
      const data = rows[idx];
      const parents = await withParents(data);
      const rec = cleanRecord(data, { parents, cache: "MISS" });
      results[idx] = { ...rec, price: undefined, product: undefined };
    }
  }));

  return {
    product: "lei-full",
    price: "$0.05",
    query: { name: name || null, registered_as: registered_as || null, country: country || null },
    count: results.length,
    total_available: total,
    results,
    source: "gleif",
    fetched_at: new Date().toISOString(),
  };
}
