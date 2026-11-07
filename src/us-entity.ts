import { UserError } from "./core";

// US state business-entity (Secretary of State) lookup across free official Socrata open-data registries — no key.
const TIMEOUT_MS = 9000;
const UA = "AgentReader/1.41 (+https://api.axiomworks.co.uk; US state business-entity lookup via official open data)";
const DISCLAIMER =
  "US state business-entity records from official state open-data portals (NY Department of State, Colorado Secretary of State, Connecticut Secretary of the State, Oregon Secretary of State, Texas Comptroller franchise-tax roll). Screening aid only — not a KYB/AML determination, good-standing certificate, credit score, or legal advice. Datasets refresh daily–monthly; confirm on the state SOS site before onboarding, contracting, or paying.";

export const US_STATES = ["NY", "CO", "CT", "OR", "TX"] as const;
type St = (typeof US_STATES)[number];

const SRC: Record<St, { host: string; ds: string; nameCol: string; idCol: string; label: string; coverage: string; lookup: (id: string) => string }> = {
  NY: { host: "data.ny.gov", ds: "n9v6-gdp6", nameCol: "current_entity_name", idCol: "dos_id", label: "New York Department of State — Active Corporations", coverage: "active entities only", lookup: () => `https://apps.dos.ny.gov/publicInquiry/` },
  CO: { host: "data.colorado.gov", ds: "4ykn-tg5h", nameCol: "entityname", idCol: "entityid", label: "Colorado Secretary of State — Business Entities", coverage: "all statuses", lookup: (id) => `https://www.coloradosos.gov/biz/BusinessEntityDetail.do?masterFileId=${id}` },
  CT: { host: "data.ct.gov", ds: "n7gp-d28j", nameCol: "name", idCol: "accountnumber", label: "Connecticut Secretary of the State — Business Registry", coverage: "all statuses (+principals, agents)", lookup: () => `https://service.ct.gov/business/s/onlinebusinesssearch` },
  OR: { host: "data.oregon.gov", ds: "tckn-sxa6", nameCol: "business_name", idCol: "registry_number", label: "Oregon Secretary of State — Active Businesses", coverage: "active entities only", lookup: (id) => `https://egov.sos.state.or.us/br/pkg_web_name_srch_inq.do_name_srch?p_name=&p_regist_nbr=${id}&p_srch=PHASE1&p_print=FALSE&p_entity_status=ACTINA` },
  TX: { host: "data.texas.gov", ds: "9cir-efmm", nameCol: "taxpayer_name", idCol: "taxpayer_number", label: "Texas Comptroller — Active Franchise Taxpayers (with SOS file number)", coverage: "active franchise-tax entities", lookup: (id) => `https://comptroller.texas.gov/taxes/franchise/account-status/search/${id}` },
};

const CO_TYPES: Record<string, string> = { DLLC: "Domestic LLC", FLLC: "Foreign LLC", DPC: "Domestic Profit Corporation", FPC: "Foreign Profit Corporation", DNC: "Domestic Nonprofit Corporation", FNC: "Foreign Nonprofit Corporation", DLP: "Domestic Limited Partnership", FLP: "Foreign Limited Partnership", DLLP: "Domestic LLP", FLLP: "Foreign LLP", DLLLP: "Domestic LLLP", TN: "Trade Name", DCOOP: "Domestic Cooperative" };
const TX_ORG: Record<string, string> = { CI: "Corporation (Texas)", CF: "Corporation (foreign)", CL: "LLC (Texas)", CM: "LLC (foreign)", PL: "Limited partnership (Texas)", PF: "Limited partnership (foreign)", PB: "Professional association", AB: "Business association", AF: "Foreign association", CT: "Texas professional corporation", PW: "Partnership", TF: "Foreign trust", TR: "Texas trust" };

function soql(s: string) { return s.replace(/'/g, "''"); }
function normName(s: string) { return String(s || "").toUpperCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim(); }
const SUFFIX = /\s+(INC|INCORPORATED|LLC|L L C|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LP|LLP|PLLC|PC|PA|NA)$/;
/** Prefix used for SoQL starts_with: text before first comma, legal-form suffix dropped. */
function searchBase(name: string) { let b = String(name || "").toUpperCase().split(",")[0].replace(/\./g, " ").replace(/\s+/g, " ").trim(); for (let i = 0; i < 2; i++) { const nb = b.replace(SUFFIX, "").trim(); if (nb.length >= 2) b = nb; } return b; }
function cmpName(s: string) { return normName(s).replace(SUFFIX, "").trim(); }
/** Exact-name variants (raw, with/without comma/period before legal suffix) so the real entity is never crowded out by prefix hits. */
function exactVariants(name: string) {
  const raw = String(name || "").toUpperCase().replace(/\s+/g, " ").trim();
  const n = normName(name); const m = n.match(SUFFIX); const base = m ? n.slice(0, m.index).trim() : n; const suf = m ? m[1] : "";
  const v = new Set<string>([raw, n]);
  if (suf) for (const x of [`${base}, ${suf}.`, `${base} ${suf}.`, `${base}, ${suf}`, `${base} ${suf}`]) v.add(x);
  return [...v].slice(0, 8);
}
function addr(...p: any[]) { const s = p.filter((x) => x && String(x).trim()).map((x) => String(x).trim()).join(", "); return s || null; }
function day(s: any) { return s ? String(s).slice(0, 10) : null; }

async function sq(st: St, params: Record<string, string>) {
  const s = SRC[st];
  const u = new URL(`https://${s.host}/resource/${s.ds}.json`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString(), { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error(`${st} open data HTTP ${r.status}`);
  return { rows: (await r.json()) as any[], url: u.toString() };
}

function mapRow(st: St, r: any): any {
  if (st === "NY") return { state: "NY", id: r.dos_id, name: r.current_entity_name, status: "active", entity_type: r.entity_type || null, formed: day(r.initial_dos_filing_date), jurisdiction: r.jurisdiction || null, county: r.county || null, address: null, process_address: addr(r.dos_process_name, r.dos_process_address_1, r.dos_process_address_2, r.dos_process_city, r.dos_process_state, r.dos_process_zip), registered_agent: r.registered_agent_name ? { name: r.registered_agent_name, address: addr(r.registered_agent_address_1, r.registered_agent_address_2, r.registered_agent_city, r.registered_agent_state, r.registered_agent_zip) } : null, ceo: r.chairman_name || null };
  if (st === "CO") { const status = r.entitystatus || null; return { state: "CO", id: r.entityid, name: String(r.entityname || "").replace(/,\s+(Dissolved|Delinquent|Withdrawn|Converted|Merged)\b.*$/i, ""), name_raw: r.entityname, status, entity_type: CO_TYPES[r.entitytype] || r.entitytype || null, formed: day(r.entityformdate), jurisdiction: r.jurisdictonofformation || null, address: addr(r.principaladdress1, r.principaladdress2, r.principalcity, r.principalstate, r.principalzipcode, r.principalcountry), registered_agent: (r.agentfirstname || r.agentlastname || r.agentorganizationname) ? { name: addr(r.agentorganizationname) || [r.agentfirstname, r.agentmiddlename, r.agentlastname].filter(Boolean).join(" "), address: addr(r.agentprincipaladdress1, r.agentprincipaladdress2, r.agentprincipalcity, r.agentprincipalstate, r.agentprincipalzipcode) } : null }; }
  if (st === "CT") return { state: "CT", id: r.accountnumber, ct_key: r.id, name: r.name, status: r.status || null, sub_status: r.sub_status || null, entity_type: r.business_type || null, formed: day(r.date_registration), jurisdiction: r.state_or_territory_formation || (r.citizenship === "Domestic" ? "CONNECTICUT" : null), citizenship: r.citizenship || null, address: addr(r.billingstreet, r.billingcity, r.billingstate, r.billingpostalcode, r.billingcountry), naics: r.naics_code || null, annual_report_due: day(r.annual_report_due_date) };
  if (st === "OR") return { state: "OR", id: r.registry_number, name: r.business_name, status: "active", entity_type: r.entity_type || null, formed: day(r.registry_date), jurisdiction: r.jurisdiction || null, address: null, associated: [{ role: r.associated_name_type || null, name: r.entity_of_record_name || [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(" ") || null, address: addr(r.address, r.address_continued, r.city, r.state, r.zip) }] };
  return { state: "TX", id: r.taxpayer_number, name: r.taxpayer_name, status: r.right_to_transact_business_code === "A" ? "active (right to transact)" : r.right_to_transact_business_code ? `right_to_transact=${r.right_to_transact_business_code}` : "active (franchise roll)", entity_type: TX_ORG[r.taxpayer_organizational_type] || r.taxpayer_organizational_type || null, formed: day(r.sos_charter_date), sos_file_number: r.secretary_of_state_sos_or_coa_file_number || null, jurisdiction: "TX roll", address: addr(r.taxpayer_address, r.taxpayer_city, r.taxpayer_state, r.taxpayer_zip) };
}

function dedupe(rows: any[]) {
  const m = new Map<string, any>();
  for (const r of rows) {
    const k = `${r.state}:${r.id}`;
    const ex = m.get(k);
    if (ex && r.associated) { const seen = new Set((ex.associated || []).map((a: any) => `${a.role}|${a.name}`)); for (const a of r.associated) if (!seen.has(`${a.role}|${a.name}`)) ex.associated.push(a); ex.associated = ex.associated.slice(0, 6); continue; }
    if (!ex) m.set(k, r);
  }
  return [...m.values()];
}

async function ctEnrich(hit: any) {
  if (!hit?.ct_key) return;
  const key = soql(hit.ct_key);
  const [p, a] = await Promise.allSettled([
    fetch(`https://data.ct.gov/resource/ka36-64k6.json?$limit=10&$where=${encodeURIComponent(`business_id='${key}'`)}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) }).then((r) => r.json()),
    fetch(`https://data.ct.gov/resource/qh2m-n44y.json?$limit=3&$where=${encodeURIComponent(`business_key='${key}'`)}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) }).then((r) => r.json()),
  ]);
  // Names, roles and business (not residential) city only — no residence addresses, emails or phones.
  if (p.status === "fulfilled" && Array.isArray(p.value)) hit.principals = p.value.map((x: any) => ({ name: x.name__c || [x.firstname, x.lastname].filter(Boolean).join(" "), role: x.designation || null, business_city: addr(x.business_city, x.business_state) }));
  if (a.status === "fulfilled" && Array.isArray(a.value) && a.value[0]) { const x = a.value[0]; hit.registered_agent = { name: x.name__c || null, type: x.type || null, address: x.type === "Business" ? x.business_address || null : addr(x.business_city, x.business_state) }; }
}

function score(q: string, n: string, status: string) {
  const qb = cmpName(q), nb = cmpName(n);
  let s = n === q ? 100 : nb === qb ? 95 : n.startsWith(q + " ") ? 85 : n.startsWith(q) ? 70 : 40;
  s += Math.max(0, 15 - Math.abs(n.length - q.length));
  if (/active|good standing/i.test(status || "")) s += 6;
  return s;
}

export function parseUsStates(raw: any): St[] {
  const s = String(raw || "").toUpperCase().trim();
  if (!s || s === "ALL" || s === "US") return [...US_STATES];
  const out = s.split(/[\s,;]+/).filter(Boolean);
  const bad = out.filter((x) => !(US_STATES as readonly string[]).includes(x));
  if (bad.length) throw new UserError(`unsupported state(s) ${bad.join(",")} — supported: ${US_STATES.join(", ")} (or all)`, 400);
  return out as St[];
}

/** US state business-entity lookup ($0.25): name across NY/CO/CT/OR/TX open-data SOS registries, or state+id. */
export async function usEntity(input: { name?: string; q?: string; company?: string; state?: string; states?: string; id?: string; number?: string; entity_id?: string; limit?: number | string; lite?: boolean; preview?: boolean }) {
  const lite = !!(input.lite || input.preview);
  const name = String(input.name || input.q || input.company || "").trim();
  const id = String(input.id || input.number || input.entity_id || "").trim().replace(/[^\w-]/g, "");
  const states = parseUsStates(input.state || input.states);
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 25);
  if (id) {
    if (states.length !== 1) throw new UserError("id lookup needs exactly one state (state=NY|CO|CT|OR|TX)", 400);
  } else if (name.length < 2) throw new UserError("provide name (2+ chars) or state+id", 400);

  const q = normName(name);
  const per: Record<string, any> = {};
  const all: any[] = [];
  await Promise.all(states.map(async (st) => {
    const s = SRC[st];
    try {
      const where = id ? `${s.idCol}='${soql(id)}'` : `starts_with(upper(${s.nameCol}),'${soql(searchBase(name))}')`;
      const exactQ = id ? null : sq(st, { $where: `upper(${s.nameCol}) in (${exactVariants(name).map((v) => `'${soql(v)}'`).join(",")})`, $limit: "10" }).catch(() => ({ rows: [] as any[], url: "" }));
      const { rows, url } = await sq(st, { $where: where, $limit: String(id ? 10 : Math.min(limit * 3, 50)) });
      const ex = exactQ ? (await exactQ).rows : [];
      const mapped = dedupe([...ex, ...rows].map((r) => mapRow(st, r)));
      per[st] = { count: mapped.length, source: s.label, coverage: s.coverage, query_url: url };
      all.push(...mapped);
    } catch (e: any) {
      per[st] = { count: 0, source: s.label, error: /timeout|abort/i.test(String(e?.name || e?.message)) ? `timeout ${TIMEOUT_MS / 1000}s` : String(e?.message || e) };
    }
  }));
  if (Object.values(per).every((x: any) => x.error)) throw new UserError("all US state open-data sources failed — retry shortly", 504);

  const STN: Record<string, string> = { NY: "NEW YORK", CO: "COLORADO", CT: "CONNECTICUT", OR: "OREGON", TX: "TEXAS" };
  // Tie-break exact-name duplicates toward the domestic (home-state) registration, which carries the formation record.
  const domestic = (r: any) => { const j = String(r.jurisdiction || "").toUpperCase(); return j === r.state || j === STN[r.state] || /^DOMESTIC/i.test(String(r.entity_type || "")); };
  for (const r of all) r._s = id ? 100 : score(q, normName(r.name), r.status) + (domestic(r) ? 4 : 0);
  all.sort((a, b) => b._s - a._s);
  const results = all.slice(0, limit).map(({ _s, ...r }) => ({ ...r, match: id ? "id" : cmpName(r.name) === cmpName(q) ? "exact" : _s >= 85 ? "prefix_word" : "prefix", lookup_url: SRC[r.state as St].lookup(String(r.id)) }));
  if (!results.length) throw new UserError(`no US state entity found for ${id ? `${states[0]} id=${id}` : `name=${name}`} in ${states.join(",")}`, 404);
  const top = results[0];
  if (top.state === "CT" && !lite) await ctEnrich(top).catch(() => {});
  for (const r of results) delete (r as any).ct_key;

  const flags: string[] = [];
  if (top && !/active|good standing/i.test(String(top.status))) flags.push(`top match status: ${top.status}`);
  if (top?.sub_status && /due|delinquent|forfeit/i.test(top.sub_status)) flags.push(`CT sub-status: ${top.sub_status}`);
  if (top?.formed && Date.now() - Date.parse(top.formed) < 180 * 86400e3) flags.push("entity formed < 6 months ago");
  if (!id && results.filter((r) => r.match === "exact").length > 1) flags.push("same exact name registered in multiple states — confirm which entity you are dealing with");

  return {
    product: "us-entity",
    price: "$0.25",
    disclaimer: DISCLAIMER,
    query: id ? { mode: "id", state: states[0], id } : { mode: "name", name, states },
    states_supported: US_STATES,
    total_results: all.length,
    best_match: top,
    results: lite ? results.slice(0, 3) : results,
    red_flags: flags,
    per_state: per,
    upsell: {
      kyb: { path: "/kyb", price: "$2.50", why: "one-shot KYB: add us_state+us_id or us_name to combine with website, sanctions, LEI" },
      us_sec: { path: "/us-sec", price: "$0.05", why: "SEC EDGAR filings if the entity is public" },
      sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity + agent names (OFAC/UK/EU/UN)" },
      us_sec_full: { path: "/us-sec-full", price: "$0.25", why: "full SEC EDGAR pack (filings + financial facts) for listed parents" },
    },
    source: "Official state open-data portals (Socrata SODA): data.ny.gov n9v6-gdp6, data.colorado.gov 4ykn-tg5h, data.ct.gov n7gp-d28j (+ka36-64k6, qh2m-n44y), data.oregon.gov tckn-sxa6, data.texas.gov 9cir-efmm",
    attribution: "Public records published by the respective US state agencies. Confirm on the state SOS website before acting.",
  };
}

export function usEntitySlim(d: any) {
  const t = d.best_match || {};
  return { state: t.state, id: t.id, name: t.name, status: t.status, entity_type: t.entity_type, formed: t.formed, jurisdiction: t.jurisdiction, total_results: d.total_results, other_matches: (d.results || []).slice(1, 3).map((r: any) => ({ state: r.state, id: r.id, name: r.name, status: r.status })), red_flags: (d.red_flags || []).slice(0, 2), omitted: ["registered_agent", "address", "principals", "per_state", "full results"] };
}

// ---- /registry-batch US support: us=STATE:ID (entity ids collide across states, so the state prefix is mandatory) ----
export type UsBatchItem = { raw: string; state?: St; id?: string; error?: string };
/** Split `us=` into items; each is `STATE:ID` (e.g. NY:3368051). Bad tokens keep a per-item error instead of failing the batch. */
export function parseUsBatch(raw: any): UsBatchItem[] {
  return String(raw || "").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean).map((tok) => {
    const m = tok.match(/^([A-Za-z]{2}):([A-Za-z0-9-]{1,20})$/);
    if (!m) return { raw: tok, error: `invalid us item "${tok.slice(0, 40)}" — use STATE:ID, e.g. NY:3368051 (states: ${US_STATES.join(", ")})` };
    const st = m[1].toUpperCase();
    if (!(US_STATES as readonly string[]).includes(st)) return { raw: tok, error: `unsupported US state "${st}" in "${tok.slice(0, 40)}" — supported: ${US_STATES.join(", ")}` };
    return { raw: tok, state: st as St, id: m[2] };
  });
}
/** One registry-batch US row: lite state+id lookup → compact record (or inline error). */
export async function usBatchOne(it: UsBatchItem, wrap: <T>(p: Promise<T>) => Promise<T> = (p) => p) {
  const id = it.state ? `${it.state}:${it.id}` : it.raw;
  if (it.error || !it.state) return { country: "US", id, found: false, error: it.error || "invalid us item" };
  try {
    const d: any = await wrap(usEntity({ state: it.state, id: it.id, lite: true }));
    const t = d.best_match || {};
    return { country: "US", id, found: true, data: { state: t.state, id: t.id, name: t.name, status: t.status, sub_status: t.sub_status ?? undefined, entity_type: t.entity_type, formed: t.formed, jurisdiction: t.jurisdiction, address: t.address ?? null, process_address: t.process_address ?? undefined, registered_agent: t.registered_agent ?? null, associated: t.associated ? t.associated.slice(0, 3) : undefined, sos_file_number: t.sos_file_number ?? undefined, annual_report_due: t.annual_report_due ?? undefined, red_flags: d.red_flags, lookup_url: t.lookup_url, source: d.per_state?.[it.state]?.source } };
  } catch (e: any) { return { country: "US", id, found: false, error: e?.message || String(e) }; }
}
