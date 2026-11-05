import { parseHTML } from "linkedom";
import { UserError } from "./core";

const CH_API = "https://api.company-information.service.gov.uk";
const CH_WEB = "https://find-and-update.company-information.service.gov.uk";
const CH_URI = "https://data.companieshouse.gov.uk/doc/company";
const UA = "AgentReader/1.0 (+https://api.axiomworks.co.uk; Companies House research)";
const CACHE_TTL = 86400; // 24h
const CACHE_PREFIX = "ch:v1:";

/** Known UK mass-formation / virtual-office address fingerprints (lowercase substrings). */
const MASS_AGENT_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "71-75 shelton street", label: "Shelton Street / Covent Garden (common formation agent)" },
  { pattern: "71–75 shelton street", label: "Shelton Street / Covent Garden (common formation agent)" },
  { pattern: "167-169 great portland street", label: "Great Portland Street (common virtual office)" },
  { pattern: "167–169 great portland street", label: "Great Portland Street (common virtual office)" },
  { pattern: "international house, 12 constance street", label: "Constance Street International House" },
  { pattern: "20-22 wenlock road", label: "Wenlock Road (common formation agent)" },
  { pattern: "20–22 wenlock road", label: "Wenlock Road (common formation agent)" },
  { pattern: "unit 3, vista place", label: "Vista Place Coy Pond (common formation agent)" },
  { pattern: "coy pond business park", label: "Coy Pond Business Park (common formation agent)" },
  { pattern: "kemp house, 152-160 city road", label: "Kemp House City Road (common formation agent)" },
  { pattern: "kemp house, 160 city road", label: "Kemp House City Road (common formation agent)" },
  { pattern: "office 4, 219 kensington high street", label: "Kensington High Street virtual office" },
  { pattern: "86-90 paul street", label: "Paul Street (common virtual office)" },
  { pattern: "86–90 paul street", label: "Paul Street (common virtual office)" },
  { pattern: "124 city road", label: "124 City Road (common formation agent address)" },
  { pattern: "suites 10-12 the dome", label: "The Dome Edinburgh (common registered office)" },
  { pattern: "c/o the accountancy partnership", label: "The Accountancy Partnership (formation agent)" },
  { pattern: "c/o aacsl accountants", label: "AACSL Accountants (formation agent)" },
  { pattern: "c/o company secretary", label: "Generic company-secretary c/o address" },
];

type EnvKV = { LOG: KVNamespace; CH_API_KEY?: string };

function normalizeNumber(n: string) {
  const s = n.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[0-9A-Z]{2,8}$/.test(s)) throw new UserError("invalid company number");
  if (/^\d+$/.test(s)) return s.padStart(8, "0");
  return s;
}

function basicAuth(key: string) {
  return "Basic " + btoa(`${key}:`);
}

async function apiGet(env: EnvKV, path: string): Promise<{ ok: true; status: number; data: any; source: string } | { ok: false; status: number; error: string; source: string }> {
  const key = (env.CH_API_KEY || "").trim();
  const source = `${CH_API}${path}`;
  if (!key) return { ok: false, status: 0, error: "CH_API_KEY not configured", source };
  try {
    const r = await fetch(source, {
      headers: { authorization: basicAuth(key), accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (r.status === 404) return { ok: false, status: 404, error: "not found", source };
    if (r.status === 429) return { ok: false, status: 429, error: "rate limited", source };
    if (!r.ok) return { ok: false, status: r.status, error: `http ${r.status}`, source };
    return { ok: true, status: r.status, data: await r.json(), source };
  } catch (e: any) {
    return { ok: false, status: 0, error: String(e?.message || e), source };
  }
}

async function getText(url: string) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/json" }, signal: AbortSignal.timeout(12000), redirect: "follow" });
  return { url: r.url, status: r.status, text: await r.text() };
}

function textOf(el: any): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function addrString(a: any): string {
  if (!a) return "";
  if (typeof a === "string") return a;
  return [a.premises, a.address_line_1, a.address_line_2, a.locality, a.region, a.postal_code, a.country].filter(Boolean).join(", ");
}

function detectMassAgent(address: string | null | undefined): { matched: boolean; label: string | null; address: string | null } {
  const s = (address || "").toLowerCase().replace(/\s+/g, " ");
  if (!s) return { matched: false, label: null, address: address || null };
  for (const { pattern, label } of MASS_AGENT_PATTERNS) {
    if (s.includes(pattern)) return { matched: true, label, address: address || null };
  }
  return { matched: false, label: null, address: address || null };
}

function accountsOverdue(accounts: any): boolean {
  if (!accounts) return false;
  if (accounts.overdue === true) return true;
  const next = accounts.next_due || accounts.next_accounts?.due_on;
  if (next && new Date(next).getTime() < Date.now()) return true;
  return false;
}

function confOverdue(cs: any): boolean {
  if (!cs) return false;
  if (cs.overdue === true) return true;
  const next = cs.next_due;
  if (next && new Date(next).getTime() < Date.now()) return true;
  return false;
}

function redFlags(input: {
  status?: string | null;
  company_status_detail?: string | null;
  incorporation_date?: string | null;
  accounts?: any;
  confirmation_statement?: any;
  officers?: any[];
  charges?: any;
  insolvency?: any;
  registered_office?: string | null;
  filings?: any[];
}): { flag: string; reason: string; severity: "high" | "medium" | "low" }[] {
  const flags: { flag: string; reason: string; severity: "high" | "medium" | "low" }[] = [];
  const status = (input.status || "").toLowerCase();
  const detail = (input.company_status_detail || "").toLowerCase();

  if (/dissolved/.test(status))
    flags.push({ flag: "dissolved", reason: `Company status is '${input.status}'`, severity: "high" });
  if (/liquidation|receiver|administration|insolvency|voluntary arrangement/.test(status + " " + detail))
    flags.push({ flag: "insolvency_status", reason: `Status/detail indicates insolvency process: '${input.status}' ${input.company_status_detail || ""}`.trim(), severity: "high" });

  if (accountsOverdue(input.accounts))
    flags.push({ flag: "accounts_overdue", reason: `Accounts overdue (next_due=${input.accounts?.next_due || input.accounts?.next_accounts?.due_on || "unknown"})`, severity: "high" });
  if (confOverdue(input.confirmation_statement))
    flags.push({ flag: "confirmation_statement_overdue", reason: `Confirmation statement overdue (next_due=${input.confirmation_statement?.next_due || "unknown"})`, severity: "high" });

  const outstanding = input.charges?.outstanding ?? input.charges?.total_count; // prefer outstanding
  const outN = Number(input.charges?.outstanding ?? 0);
  if (outN > 0)
    flags.push({ flag: "outstanding_charges", reason: `${outN} outstanding charge(s) registered`, severity: "medium" });

  const cases = input.insolvency?.cases || input.insolvency?.items || [];
  if (Array.isArray(cases) && cases.length > 0)
    flags.push({ flag: "insolvency_history", reason: `${cases.length} insolvency case(s) on record`, severity: "high" });
  else if (input.insolvency && input.insolvency.has_insolvency_history)
    flags.push({ flag: "insolvency_history", reason: "Company has insolvency history flag set", severity: "high" });

  // officer churn: resignations in last 12 months among listed officers
  const officers = input.officers || [];
  const yearAgo = Date.now() - 365 * 864e5;
  const recentResign = officers.filter((o) => {
    const r = o.resigned_on || o.resignedOn;
    return r && new Date(r).getTime() >= yearAgo;
  });
  const recentAppoint = officers.filter((o) => {
    const a = o.appointed_on || o.appointedOn;
    return a && new Date(a).getTime() >= yearAgo && !(o.resigned_on || o.resignedOn);
  });
  if (recentResign.length >= 3)
    flags.push({ flag: "officer_churn", reason: `${recentResign.length} officer resignation(s) in the last 12 months`, severity: "medium" });
  if (recentAppoint.length >= 3 && recentResign.length >= 2)
    flags.push({ flag: "officer_turnover", reason: `${recentAppoint.length} recent appointments and ${recentResign.length} resignations in 12 months`, severity: "medium" });

  const inc = input.incorporation_date;
  if (inc) {
    const d = new Date(inc.includes("/") ? inc.split("/").reverse().join("-") : inc);
    if (!isNaN(+d)) {
      const age = Date.now() - +d;
      if (age < 90 * 864e5)
        flags.push({ flag: "newly_incorporated", reason: `Incorporated within the last 90 days (${inc})`, severity: "medium" });
      else if (age < 180 * 864e5)
        flags.push({ flag: "newly_incorporated", reason: `Incorporated within the last 180 days (${inc})`, severity: "low" });
    }
  }

  const mass = detectMassAgent(input.registered_office || "");
  if (mass.matched)
    flags.push({ flag: "mass_formation_address", reason: `Registered office matches known mass-formation / virtual-office pattern: ${mass.label}`, severity: "medium" });

  const filings = input.filings || [];
  const recent = filings.slice(0, 20).map((f) => `${f.type || ""} ${f.description || ""} ${f.category || ""}`.toLowerCase());
  if (recent.some((t) => /gazette|strike.?off|compulsory|winding/.test(t)))
    flags.push({ flag: "strike_off_or_gazette", reason: "Recent filing mentions gazette / strike off / winding up", severity: "high" });
  if (recent.some((t) => /insolvency|administrator|liquidator|receiver|moratorium/.test(t)))
    flags.push({ flag: "insolvency_filing", reason: "Recent insolvency-related filing detected", severity: "high" });

  return flags;
}

/* ---------- Official API pack ---------- */
async function searchApi(env: EnvKV, name: string) {
  const path = `/search/companies?q=${encodeURIComponent(name)}&items_per_page=10`;
  const r = await apiGet(env, path);
  if (!r.ok) return { ok: false as const, error: r.error, source: r.source, hits: [] as any[] };
  const hits = (r.data.items || []).map((it: any) => ({
    number: it.company_number,
    name: it.title,
    status: it.company_status,
    type: it.company_type,
    address_snippet: it.address_snippet,
    date_of_creation: it.date_of_creation,
    url: `${CH_WEB}/company/${it.company_number}`,
  }));
  return { ok: true as const, source: r.source, hits };
}

async function packFromApi(env: EnvKV, number: string) {
  const paths = {
    profile: `/company/${number}`,
    officers: `/company/${number}/officers?items_per_page=50`,
    psc: `/company/${number}/persons-with-significant-control?items_per_page=50`,
    filings: `/company/${number}/filing-history?items_per_page=25`,
    charges: `/company/${number}/charges`,
    insolvency: `/company/${number}/insolvency`,
  };
  const [profile, officers, psc, filings, charges, insolvency] = await Promise.all([
    apiGet(env, paths.profile),
    apiGet(env, paths.officers),
    apiGet(env, paths.psc),
    apiGet(env, paths.filings),
    apiGet(env, paths.charges),
    apiGet(env, paths.insolvency),
  ]);
  if (!profile.ok) return { ok: false as const, error: profile.error, status: profile.status };

  const p = profile.data;
  const office = addrString(p.registered_office_address);
  const officerItems = (officers.ok ? officers.data.items : []) || [];
  const officersNorm = officerItems.map((o: any) => ({
    name: o.name,
    role: o.officer_role,
    appointed_on: o.appointed_on || null,
    resigned_on: o.resigned_on || null,
    nationality: o.nationality || null,
    country_of_residence: o.country_of_residence || null,
    occupation: o.occupation || null,
    address: addrString(o.address) || null,
  }));
  const filingItems = ((filings.ok ? filings.data.items : []) || []).map((f: any) => ({
    date: f.date, type: f.type, category: f.category, description: f.description, action_date: f.action_date || null,
  }));
  const chargeSummary = charges.ok ? {
    total_count: charges.data.total_count ?? (charges.data.items || []).length,
    outstanding: charges.data.outstanding_count ?? (charges.data.items || []).filter((c: any) => /outstanding|part/i.test(c.status || "")).length,
    satisfied: charges.data.satisfied_count ?? null,
    part_satisfied: charges.data.part_satisfied_count ?? null,
    items: (charges.data.items || []).slice(0, 10).map((c: any) => ({
      status: c.status, created_on: c.created_on, delivered_on: c.delivered_on,
      classification: c.classification?.description || c.classification?.type || null,
      persons_entitled: (c.persons_entitled || []).map((x: any) => x.name).filter(Boolean),
    })),
  } : { error: (charges as any).error, status: (charges as any).status };

  const insolvencyData = insolvency.ok ? {
    cases: (insolvency.data.cases || []).map((c: any) => ({
      type: c.type, dates: c.dates, practitioners: (c.practitioners || []).map((pr: any) => ({ name: pr.name, role: pr.role })),
    })),
    has_insolvency_history: !!(insolvency.data.cases || []).length || p.has_insolvency_history,
  } : (insolvency.status === 404 ? { cases: [], has_insolvency_history: !!p.has_insolvency_history, note: "no insolvency resource" }
    : { error: (insolvency as any).error, status: (insolvency as any).status, has_insolvency_history: !!p.has_insolvency_history });

  let pscData: any;
  if (psc.ok) {
    const persons = (psc.data.items || []).map((x: any) => ({
      name: x.name, kind: x.kind, natures_of_control: x.natures_of_control,
      notified_on: x.notified_on, ceased_on: x.ceased_on || null,
      nationality: x.nationality || null, country_of_residence: x.country_of_residence || null,
    }));
    const empty = persons.length === 0 && !(psc.data.active_count > 0);
    const plcExempt = empty && /plc|public-limited|public limited/i.test(String(p.type || "") + " " + String(p.company_name || ""));
    pscData = {
      available: !plcExempt,
      persons,
      active_count: psc.data.active_count, ceased_count: psc.data.ceased_count,
      reason: plcExempt ? "likely exempt (e.g. listed/public company with no PSC resource items)" : undefined,
    };
  } else if (psc.status === 404) {
    pscData = { available: false, reason: "not available / exempt", persons: [] };
  } else {
    pscData = { available: false, error: (psc as any).error, persons: [] };
  }

  const flags = redFlags({
    status: p.company_status,
    company_status_detail: p.company_status_detail,
    incorporation_date: p.date_of_creation,
    accounts: p.accounts,
    confirmation_statement: p.confirmation_statement,
    officers: officersNorm,
    charges: chargeSummary,
    insolvency: insolvencyData,
    registered_office: office,
    filings: filingItems,
  });

  return {
    ok: true as const,
    mode: "companies_house_api" as const,
    company_number: number,
    profile: {
      name: p.company_name, number: p.company_number, status: p.company_status,
      status_detail: p.company_status_detail || null, type: p.type,
      incorporation_date: p.date_of_creation, dissolution_date: p.date_of_cessation || null,
      jurisdiction: p.jurisdiction, sic_codes: p.sic_codes || [],
      registered_office: p.registered_office_address || null, registered_office_text: office,
      accounts: p.accounts || null, confirmation_statement: p.confirmation_statement || null,
      has_been_liquidated: p.has_been_liquidated || false, has_insolvency_history: p.has_insolvency_history || false,
      has_charges: p.has_charges || false, previous_company_names: p.previous_company_names || [],
      links: p.links || null, source: profile.source,
    },
    officers: {
      active_count: officers.ok ? officers.data.active_count : null,
      resigned_count: officers.ok ? officers.data.resigned_count : null,
      total_results: officers.ok ? officers.data.total_results : officersNorm.length,
      items: officersNorm, source: officers.ok ? officers.source : null, error: officers.ok ? undefined : (officers as any).error,
    },
    persons_with_significant_control: { ...pscData, source: psc.ok ? psc.source : null },
    filing_history_highlights: { items: filingItems, source: filings.ok ? filings.source : null, error: filings.ok ? undefined : (filings as any).error },
    charges: { ...chargeSummary, source: charges.ok ? charges.source : null },
    insolvency: { ...insolvencyData, source: insolvency.ok ? insolvency.source : (insolvency.status === 404 ? `${CH_API}/company/${number}/insolvency` : null) },
    compliance: {
      accounts_overdue: accountsOverdue(p.accounts),
      confirmation_statement_overdue: confOverdue(p.confirmation_statement),
      accounts: p.accounts || null,
      confirmation_statement: p.confirmation_statement || null,
    },
    mass_formation_office: detectMassAgent(office),
    red_flags: flags,
    sources: {
      profile: profile.source,
      officers: officers.ok ? officers.source : undefined,
      psc: psc.ok ? psc.source : undefined,
      filing_history: filings.ok ? filings.source : undefined,
      charges: charges.ok ? charges.source : undefined,
      insolvency: insolvency.ok || insolvency.status === 404 ? `${CH_API}/company/${number}/insolvency` : undefined,
      web: `${CH_WEB}/company/${number}`,
    },
  };
}

/* ---------- Public fallback (URI + HTML) ---------- */
function parseOverview(html: string) {
  const { document } = parseHTML(html);
  const get = (id: string) => textOf(document.getElementById(id));
  const sics: string[] = [];
  for (let i = 0; i < 10; i++) { const t = get(`sic${i}`); if (!t) break; sics.push(t); }
  const pairs: Record<string, string> = {};
  for (const dt of document.querySelectorAll("dt")) {
    const label = textOf(dt); const dd = dt.nextElementSibling;
    if (dd && dd.tagName === "DD") pairs[label] = textOf(dd);
  }
  return {
    name: textOf(document.querySelector("h1.heading-xlarge")) || textOf(document.querySelector("h1")) || null,
    number: get("company-number") || null, status: get("company-status") || null, type: get("company-type") || null,
    incorporated_on: get("company-creation-date") || null, dissolved_on: get("company-dissolved-date") || null,
    registered_office: textOf(document.querySelector("#content-container address")) ||
      (() => { const dt = [...document.querySelectorAll("dt")].find((d) => /Registered office address/i.test(textOf(d))); return dt ? textOf(dt.nextElementSibling) : null; })(),
    sic_codes: sics, accounts_text: pairs["Accounts"] || null, confirmation_statement_text: pairs["Confirmation statement"] || null, pairs,
  };
}

function parseOfficersHtml(html: string) {
  const { document } = parseHTML(html);
  const out: any[] = [];
  for (let i = 1; i <= 40; i++) {
    const nameEl = document.getElementById(`officer-name-${i}`);
    if (!nameEl) break;
    const card = document.querySelector(`.appointment-${i}`);
    const row: any = { name: textOf(nameEl), role: textOf(document.getElementById(`officer-role-${i}`)) || null, status: textOf(document.getElementById(`officer-status-tag-${i}`)) || null, appointed_on: null, resigned_on: null, nationality: null, address: textOf(document.getElementById(`officer-address-value-${i}`)) || null };
    if (card) for (const dt of card.querySelectorAll("dt")) {
      const lab = textOf(dt), val = textOf(dt.nextElementSibling);
      if (/Appointed on/i.test(lab)) row.appointed_on = val;
      if (/Resigned on/i.test(lab)) row.resigned_on = val;
      if (/Nationality/i.test(lab)) row.nationality = val;
    }
    out.push(row);
  }
  return out;
}

function parseFilingsHtml(html: string) {
  const { document } = parseHTML(html);
  const rows: any[] = [];
  for (const tr of document.querySelectorAll("tr")) {
    const tds = [...tr.querySelectorAll("td")].map(textOf);
    if (tds.length >= 3 && /\d{1,2} \w+ \d{4}/.test(tds[0])) rows.push({ date: tds[0], type: tds[1], description: tds[2].slice(0, 300) });
  }
  return rows.slice(0, 25);
}

function parseChargesHtml(html: string) {
  const text = parseHTML(html).document.body?.textContent?.replace(/\s+/g, " ") || "";
  const none = /no charges|there are no charges/i.test(text);
  return {
    total_count: Number(text.match(/(\d+)\s+charges?\s+registered/i)?.[1] ?? (none ? 0 : null)),
    outstanding: Number(text.match(/(\d+)\s+outstanding/i)?.[1] ?? (none ? 0 : null)),
    satisfied: Number(text.match(/(\d+)\s+satisfied/i)?.[1] ?? null),
    part_satisfied: Number(text.match(/(\d+)\s+part satisfied/i)?.[1] ?? null),
  };
}

async function searchByNameHtml(name: string) {
  const url = `${CH_WEB}/search/companies?q=${encodeURIComponent(name)}`;
  const { text, status } = await getText(url);
  if (status >= 400) throw new UserError(`Companies House search failed (${status})`, 502);
  const { document } = parseHTML(text);
  const hits: any[] = [];
  for (const li of document.querySelectorAll("li.type-company")) {
    const t = textOf(li); if (t.includes("{{{")) continue;
    const a = li.querySelector('a[href*="/company/"]');
    const href = a?.getAttribute("href") || "";
    const num = (href.match(/\/company\/([0-9A-Z]+)/) || [])[1];
    if (!num) continue;
    hits.push({ number: num, name: textOf(a), snippet: t.slice(0, 240), status: /dissolved/i.test(t) ? "dissolved" : /liquidation/i.test(t) ? "liquidation" : null, url: `${CH_WEB}/company/${num}` });
    if (hits.length >= 10) break;
  }
  return { source: url, hits };
}

async function packFromPublic(number: string) {
  const overviewUrl = `${CH_WEB}/company/${number}`;
  const [uriR, overviewR, officersR, pscR, filingR, chargesR] = await Promise.all([
    fetch(`${CH_URI}/${number}.json`, { headers: { accept: "application/json", "user-agent": UA }, signal: AbortSignal.timeout(10000) })
      .then(async (r) => r.ok ? { ok: true as const, data: (await r.json()).primaryTopic, source: `${CH_URI}/${number}.json` } : { ok: false as const, status: r.status, source: `${CH_URI}/${number}.json` })
      .catch((e) => ({ ok: false as const, status: 0, error: String(e), source: `${CH_URI}/${number}.json` })),
    getText(overviewUrl),
    getText(`${CH_WEB}/company/${number}/officers`),
    getText(`${CH_WEB}/company/${number}/persons-with-significant-control`),
    getText(`${CH_WEB}/company/${number}/filing-history`),
    getText(`${CH_WEB}/company/${number}/charges`),
  ]);
  if (overviewR.status === 404) throw new UserError("company not found", 404);
  if (overviewR.status >= 400) throw new UserError(`Companies House overview failed (${overviewR.status})`, 502);
  const overview = parseOverview(overviewR.text);
  const officers = officersR.status < 400 ? parseOfficersHtml(officersR.text) : [];
  const filings = filingR.status < 400 ? parseFilingsHtml(filingR.text) : [];
  const charges = chargesR.status < 400 ? parseChargesHtml(chargesR.text) : {};
  const profile = uriR.ok ? uriR.data : null;
  const office = overview.registered_office || addrString(profile?.RegAddress) || null;
  const flags = redFlags({
    status: overview.status || profile?.CompanyStatus,
    incorporation_date: overview.incorporated_on || profile?.IncorporationDate,
    accounts: { overdue: /overdue/i.test(overview.accounts_text || "") },
    confirmation_statement: { overdue: /overdue/i.test(overview.confirmation_statement_text || "") },
    officers,
    charges,
    insolvency: null,
    registered_office: office,
    filings,
  });
  const pscText = pscR.status < 400 ? (parseHTML(pscR.text).document.body?.textContent || "") : "";
  let psc: any = { available: false, persons: [] };
  if (/exempt from the requirement|PSC information is not available/i.test(pscText)) psc = { available: false, reason: "exempt or not available", persons: [] };
  else if (/no persons with significant control|There are no persons/i.test(pscText)) psc = { available: true, persons: [], note: "none filed" };
  else psc = { available: true, persons: [], note: "see source page", source: `${CH_WEB}/company/${number}/persons-with-significant-control` };

  return {
    ok: true as const,
    mode: "public_fallback" as const,
    company_number: number,
    profile: profile ? {
      name: profile.CompanyName, number: profile.CompanyNumber, status: profile.CompanyStatus,
      type: profile.CompanyCategory, incorporation_date: profile.IncorporationDate,
      dissolution_date: profile.DissolutionDate || null, registered_office: profile.RegAddress || null,
      registered_office_text: office, sic_codes: profile.SICCodes?.SicText || overview.sic_codes,
      accounts: profile.Accounts || null, mortgages: profile.Mortgages || null,
      previous_company_names: profile.PreviousNames || [], source: uriR.ok ? uriR.source : null,
    } : { name: overview.name, number, status: overview.status, type: overview.type, incorporation_date: overview.incorporated_on, registered_office_text: office, sic_codes: overview.sic_codes, source: overviewUrl },
    overview: { ...overview, source: overviewUrl },
    officers: { items: officers, total_results: officers.length, source: `${CH_WEB}/company/${number}/officers` },
    persons_with_significant_control: psc,
    filing_history_highlights: { items: filings, source: `${CH_WEB}/company/${number}/filing-history` },
    charges: { ...charges, source: `${CH_WEB}/company/${number}/charges` },
    insolvency: { note: "not available via public HTML fallback; use API mode", cases: [] },
    compliance: {
      accounts_overdue: /overdue/i.test(overview.accounts_text || ""),
      confirmation_statement_overdue: /overdue/i.test(overview.confirmation_statement_text || ""),
      accounts_text: overview.accounts_text, confirmation_statement_text: overview.confirmation_statement_text,
    },
    mass_formation_office: detectMassAgent(office),
    red_flags: flags,
    sources: { uri: uriR.ok ? uriR.source : undefined, overview: overviewUrl, web: overviewUrl },
    note: "Served from Companies House public URI/HTML fallback (API unavailable or failed).",
  };
}

function liteFromFull(full: any) {
  const p = full.profile || {};
  return {
    queried_at: full.queried_at,
    mode: full.mode,
    company_number: full.company_number,
    name: p.name || full.overview?.name || null,
    status: p.status || full.overview?.status || null,
    status_detail: p.status_detail || null,
    type: p.type || full.overview?.type || null,
    incorporation_date: p.incorporation_date || full.overview?.incorporated_on || null,
    dissolution_date: p.dissolution_date || null,
    sic_codes: p.sic_codes || full.overview?.sic_codes || [],
    registered_office_text: p.registered_office_text || full.overview?.registered_office || null,
    compliance: full.compliance,
    mass_formation_office: full.mass_formation_office,
    red_flags: full.red_flags,
    sources: { profile: full.sources?.profile || full.sources?.overview || full.sources?.web, web: full.sources?.web || `${CH_WEB}/company/${full.company_number}` },
    note: "Lite pack: profile + status + compliance + red flags. Use /uk-company for full officers/PSC/filings/charges/insolvency.",
  };
}

async function resolveNumber(env: EnvKV, opts: { number?: string; name?: string }) {
  let number = (opts.number || "").trim();
  let search: any = null;
  if (!number) {
    if (!opts.name?.trim()) throw new UserError("provide number= or name=");
    const apiSearch = await searchApi(env, opts.name.trim());
    if (apiSearch.ok && apiSearch.hits.length) {
      search = { query: opts.name, hits: apiSearch.hits, source: apiSearch.source, mode: "api" };
      const exact = apiSearch.hits.find((h: any) => (h.name || "").toLowerCase() === opts.name!.trim().toLowerCase());
      const active = apiSearch.hits.find((h: any) => !/dissolved|liquidation|closed/i.test(h.status || ""));
      number = (exact || active || apiSearch.hits[0]).number;
    } else {
      const html = await searchByNameHtml(opts.name.trim());
      search = { query: opts.name, hits: html.hits, source: html.source, mode: "public_fallback", api_error: apiSearch.error };
      if (!html.hits.length) throw new UserError("no Companies House matches for that name", 404);
      const exact = html.hits.find((h: any) => (h.name || "").toLowerCase() === opts.name!.trim().toLowerCase());
      const active = html.hits.find((h: any) => !/dissolved|liquidation|closed/i.test(h.status || h.snippet || ""));
      number = (exact || active || html.hits[0]).number;
    }
  }
  return { number: normalizeNumber(number), search };
}

export async function ukCompany(env: EnvKV, opts: { number?: string; name?: string; lite?: boolean }) {
  const { number, search } = await resolveNumber(env, opts);
  const cacheKey = `${CACHE_PREFIX}${number}`;

  // KV cache (full pack); lite derived from cache
  try {
    const cached = await env.LOG.get(cacheKey, "json");
    if (cached && (cached as any).company_number === number) {
      const full = { ...(cached as any), queried_at: new Date().toISOString(), cache: "HIT", search };
      return opts.lite ? { ...liteFromFull(full), cache: "HIT", search } : full;
    }
  } catch {}

  let full: any = null;
  let apiErr: string | null = null;
  if ((env.CH_API_KEY || "").trim()) {
    const api = await packFromApi(env, number);
    if (api.ok) full = { ...api, queried_at: new Date().toISOString(), search, cache: "MISS" };
    else apiErr = `${api.status || ""} ${api.error}`.trim();
  } else {
    apiErr = "CH_API_KEY not configured";
  }
  if (!full) {
    const pub = await packFromPublic(number);
    full = { ...pub, queried_at: new Date().toISOString(), search, cache: "MISS", api_fallback_reason: apiErr };
  }

  try {
    await env.LOG.put(cacheKey, JSON.stringify({ ...full, search: undefined, cache: undefined }), {
      expirationTtl: CACHE_TTL,
      metadata: { number, mode: full.mode, cached_at: full.queried_at },
    });
  } catch {}

  return opts.lite ? { ...liteFromFull(full), cache: full.cache, search } : full;
}

/** Local/test helper: run without Worker env by accepting key directly */
export async function ukCompanyWithKey(key: string | undefined, opts: { number?: string; name?: string; lite?: boolean }, kv?: KVNamespace) {
  const mem = new Map<string, string>();
  const fakeKv = kv || {
    get: async (k: string, type?: any) => {
      const v = mem.get(k); if (!v) return null;
      return type === "json" ? JSON.parse(v) : v;
    },
    put: async (k: string, v: string) => { mem.set(k, v); },
  } as any;
  return ukCompany({ LOG: fakeKv, CH_API_KEY: key }, opts);
}
