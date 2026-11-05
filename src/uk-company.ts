import { parseHTML } from "linkedom";
import { UserError } from "./core";

const CH = "https://find-and-update.company-information.service.gov.uk";
const URI = "https://data.companieshouse.gov.uk/doc/company";
const UA = "AgentReader/1.0 (+https://api.axiomworks.co.uk; public data research)";

async function getText(url: string): Promise<{ url: string; status: number; text: string }> {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/json" }, signal: AbortSignal.timeout(12000), redirect: "follow" });
  const text = await r.text();
  return { url: r.url, status: r.status, text };
}

function textOf(el: any): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function parseOverview(html: string) {
  const { document } = parseHTML(html);
  const get = (id: string) => textOf(document.getElementById(id));
  const sics: string[] = [];
  for (let i = 0; i < 10; i++) {
    const t = get(`sic${i}`); if (!t) break; sics.push(t);
  }
  // accounts / confirmation blocks from dt/dd
  const pairs: Record<string, string> = {};
  for (const dt of document.querySelectorAll("dt")) {
    const label = textOf(dt).replace(/\s+/g, " ").trim();
    const dd = dt.nextElementSibling;
    if (dd && dd.tagName === "DD") pairs[label] = textOf(dd);
  }
  return {
    name: textOf(document.querySelector("h1.heading-xlarge")) || textOf(document.querySelector("h1")) || null,
    number: get("company-number") || null,
    status: get("company-status") || null,
    type: get("company-type") || null,
    incorporated_on: get("company-creation-date") || null,
    dissolved_on: get("company-dissolved-date") || null,
    registered_office: textOf(document.querySelector("#content-container address")) ||
      (() => { const dt = [...document.querySelectorAll("dt")].find((d) => /Registered office address/i.test(textOf(d))); return dt ? textOf(dt.nextElementSibling) : null; })(),
    sic_codes: sics,
    accounts_text: pairs["Accounts"] || null,
    confirmation_statement_text: pairs["Confirmation statement"] || null,
    pairs,
  };
}

function parseOfficers(html: string) {
  const { document } = parseHTML(html);
  const out: any[] = [];
  for (let i = 1; i <= 40; i++) {
    const nameEl = document.getElementById(`officer-name-${i}`);
    if (!nameEl) break;
    const status = textOf(document.getElementById(`officer-status-tag-${i}`)) || null;
    out.push({
      name: textOf(nameEl),
      role: textOf(document.getElementById(`officer-role-${i}`)) || null,
      status,
      appointed_on: textOf(document.querySelector(`#officer-role-app-date-${i}`) || [...document.querySelectorAll("dt")].find((d) => {
        const p = d.parentElement; return p && p.querySelector(`#officer-role-${i}`) && /Appointed on/i.test(textOf(d));
      })?.nextElementSibling) || null,
      resigned_on: null as string | null,
      nationality: textOf(document.getElementById(`officer-nationality-${i}`)) || null,
      correspondence_address: textOf(document.getElementById(`officer-address-value-${i}`)) || null,
      source: `${CH}/officers`,
    });
  }
  // Better appointed/resigned from appointment cards
  for (let i = 1; i <= out.length; i++) {
    const card = document.querySelector(`.appointment-${i}`);
    if (!card) continue;
    for (const dt of card.querySelectorAll("dt")) {
      const lab = textOf(dt);
      const val = textOf(dt.nextElementSibling);
      if (/Appointed on/i.test(lab)) out[i - 1].appointed_on = val;
      if (/Resigned on/i.test(lab)) out[i - 1].resigned_on = val;
      if (/Nationality/i.test(lab)) out[i - 1].nationality = val;
      if (/Role/i.test(lab) && !out[i - 1].role) out[i - 1].role = val;
    }
  }
  const active = out.filter((o) => /active/i.test(o.status || "") || !o.resigned_on);
  const resigned = out.filter((o) => /resign/i.test(o.status || "") || o.resigned_on);
  return { active: active.slice(0, 25), resigned_sample: resigned.slice(0, 10), total_listed: out.length };
}

function parseFilings(html: string) {
  const rows: { date: string; type: string; description: string }[] = [];
  const { document } = parseHTML(html);
  for (const tr of document.querySelectorAll("tr")) {
    const tds = [...tr.querySelectorAll("td")].map(textOf);
    if (tds.length >= 3 && /\d{1,2} \w+ \d{4}/.test(tds[0])) {
      rows.push({ date: tds[0], type: tds[1], description: tds[2].slice(0, 300) });
    }
  }
  // fallback regex if table structure differs
  if (!rows.length) {
    const text = document.body?.textContent || "";
    // already handled by linkedom usually
  }
  return rows.slice(0, 25);
}

function parseCharges(html: string) {
  const text = parseHTML(html).document.body?.textContent?.replace(/\s+/g, " ") || "";
  const m = text.match(/(\d+)\s+charges?\s+registered/i);
  const out = text.match(/(\d+)\s+outstanding/i);
  const sat = text.match(/(\d+)\s+satisfied/i);
  const part = text.match(/(\d+)\s+part satisfied/i);
  const none = /no charges|there are no charges/i.test(text);
  return {
    registered: m ? Number(m[1]) : none ? 0 : null,
    outstanding: out ? Number(out[1]) : none ? 0 : null,
    satisfied: sat ? Number(sat[1]) : null,
    part_satisfied: part ? Number(part[1]) : null,
    summary_excerpt: text.match(/Filter charges([\s\S]{0,400})/)?.[1]?.slice(0, 300) || text.slice(0, 300),
  };
}

function parsePsc(html: string) {
  const text = parseHTML(html).document.body?.textContent?.replace(/\s+/g, " ") || "";
  if (/PSC information is not available|exempt from the requirement/i.test(text)) {
    return { available: false, reason: "exempt or not available (e.g. listed company)", excerpt: text.match(/The PSC information[\s\S]{0,240}/)?.[0] || null };
  }
  if (/no persons with significant control|There are no persons/i.test(text)) {
    return { available: true, persons: [], note: "none filed" };
  }
  const persons: any[] = [];
  const { document } = parseHTML(html);
  for (const h2 of document.querySelectorAll("h2")) {
    const name = textOf(h2);
    if (!name || /Persons with significant control|Important/i.test(name)) continue;
    const block = h2.parentElement;
    const info: any = { name };
    if (block) {
      for (const dt of block.querySelectorAll("dt")) {
        info[textOf(dt).toLowerCase().replace(/\s+/g, "_")] = textOf(dt.nextElementSibling);
      }
    }
    persons.push(info);
    if (persons.length >= 15) break;
  }
  return { available: true, persons };
}

async function searchByName(name: string) {
  const url = `${CH}/search/companies?q=${encodeURIComponent(name)}`;
  const { text, status } = await getText(url);
  if (status >= 400) throw new UserError(`Companies House search failed (${status})`, 502);
  const { document } = parseHTML(text);
  const hits: { number: string; name: string; snippet: string; url: string }[] = [];
  for (const li of document.querySelectorAll("li.type-company")) {
    const t = textOf(li);
    if (t.includes("{{{")) continue;
    const a = li.querySelector('a[href*="/company/"]');
    const href = a?.getAttribute("href") || "";
    const num = (href.match(/\/company\/([0-9A-Z]+)/) || [])[1];
    if (!num) continue;
    hits.push({ number: num, name: textOf(a), snippet: t.slice(0, 240), url: `${CH}/company/${num}` });
    if (hits.length >= 10) break;
  }
  return { source: url, hits };
}

async function uriProfile(number: string) {
  const url = `${URI}/${number}.json`;
  const r = await fetch(url, { headers: { accept: "application/json", "user-agent": UA }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return { source: url, ok: false, status: r.status };
  const j = await r.json();
  return { source: url, ok: true, data: j.primaryTopic || j };
}

function normalizeNumber(n: string) {
  const s = n.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[0-9A-Z]{2,8}$/.test(s)) throw new UserError("invalid company number");
  // pad numeric-only to 8
  if (/^\d+$/.test(s)) return s.padStart(8, "0");
  return s;
}

function redFlags(profile: any, overview: any, charges: any, filings: any[], psc: any): { flag: string; reason: string }[] {
  const flags: { flag: string; reason: string }[] = [];
  const status = (overview.status || profile?.CompanyStatus || "").toLowerCase();
  if (/dissolved|liquidation|receivership|administration|insolvency/.test(status))
    flags.push({ flag: "status_risk", reason: `Company status is '${overview.status || profile?.CompanyStatus}'` });
  if (/liquidation/.test(status))
    flags.push({ flag: "in_liquidation", reason: "Company appears to be in liquidation" });
  const acc = (overview.accounts_text || "").toLowerCase();
  if (/overdue/.test(acc))
    flags.push({ flag: "accounts_overdue", reason: "Accounts marked overdue on Companies House overview" });
  const cs = (overview.confirmation_statement_text || "").toLowerCase();
  if (/overdue/.test(cs))
    flags.push({ flag: "confirmation_statement_overdue", reason: "Confirmation statement marked overdue" });
  if (charges?.outstanding && charges.outstanding > 0)
    flags.push({ flag: "outstanding_charges", reason: `${charges.outstanding} outstanding charge(s) registered` });
  if (psc?.available && Array.isArray(psc.persons) && psc.persons.length === 0)
    flags.push({ flag: "no_psc_filed", reason: "No persons with significant control filed" });
  const recent = filings.slice(0, 15).map((f) => `${f.type} ${f.description}`.toLowerCase());
  if (recent.some((t) => /gazette|strike off|compulsory|winding/.test(t)))
    flags.push({ flag: "strike_off_or_gazette", reason: "Recent filing mentions gazette/strike off/winding up" });
  if (recent.some((t) => /insolvency|administrator|liquidator|receiver/.test(t)))
    flags.push({ flag: "insolvency_filing", reason: "Recent insolvency-related filing detected" });
  // very new company
  const inc = overview.incorporated_on || profile?.IncorporationDate;
  if (inc) {
    const d = new Date(inc.includes("/") ? inc.split("/").reverse().join("-") : inc);
    if (!isNaN(+d) && Date.now() - +d < 180 * 864e5)
      flags.push({ flag: "newly_incorporated", reason: `Incorporated within the last 180 days (${inc})` });
  }
  return flags;
}

export async function ukCompany(opts: { number?: string; name?: string }) {
  let number = (opts.number || "").trim();
  let search: any = null;
  const sources: Record<string, string> = {};

  if (!number) {
    if (!opts.name?.trim()) throw new UserError("provide number= or name=");
    search = await searchByName(opts.name.trim());
    sources.search = search.source;
    if (!search.hits.length) throw new UserError("no Companies House matches for that name", 404);
    // prefer exact name match, else first active-looking hit
    const exact = search.hits.find((h: any) => h.name.toLowerCase() === opts.name!.trim().toLowerCase());
    const active = search.hits.find((h: any) => !/dissolved|closed|liquidation/i.test(h.snippet));
    number = (exact || active || search.hits[0]).number;
  }
  number = normalizeNumber(number);

  const overviewUrl = `${CH}/company/${number}`;
  const [uri, overviewR, officersR, pscR, filingR, chargesR] = await Promise.all([
    uriProfile(number),
    getText(overviewUrl),
    getText(`${CH}/company/${number}/officers`),
    getText(`${CH}/company/${number}/persons-with-significant-control`),
    getText(`${CH}/company/${number}/filing-history`),
    getText(`${CH}/company/${number}/charges`),
  ]);
  sources.uri = uri.source;
  sources.overview = overviewUrl;
  sources.officers = `${CH}/company/${number}/officers`;
  sources.psc = `${CH}/company/${number}/persons-with-significant-control`;
  sources.filing_history = `${CH}/company/${number}/filing-history`;
  sources.charges = `${CH}/company/${number}/charges`;

  if (overviewR.status === 404) throw new UserError("company not found", 404);
  if (overviewR.status >= 400) throw new UserError(`Companies House overview failed (${overviewR.status})`, 502);

  const overview = parseOverview(overviewR.text);
  const officers = officersR.status < 400 ? parseOfficers(officersR.text) : { error: `http ${officersR.status}` };
  const psc = pscR.status < 400 ? parsePsc(pscR.text) : { error: `http ${pscR.status}` };
  const filings = filingR.status < 400 ? parseFilings(filingR.text) : [];
  const charges = chargesR.status < 400 ? parseCharges(chargesR.text) : { error: `http ${chargesR.status}` };
  const profile = uri.ok ? uri.data : null;

  const accounts = profile?.Accounts || {};
  const overdue_accounts = /overdue/i.test(overview.accounts_text || "") || false;
  const overdue_confirmation = /overdue/i.test(overview.confirmation_statement_text || "") || false;

  const flags = redFlags(profile, overview, charges, filings, psc);

  return {
    queried_at: new Date().toISOString(),
    company_number: number,
    search: search ? { query: opts.name, hits: search.hits, selected: number, source: search.source } : null,
    profile: profile ? {
      name: profile.CompanyName, number: profile.CompanyNumber, status: profile.CompanyStatus,
      type: profile.CompanyCategory, incorporation_date: profile.IncorporationDate,
      dissolution_date: profile.DissolutionDate || null, country: profile.CountryOfOrigin,
      registered_office: profile.RegAddress || null,
      sic_codes: profile.SICCodes?.SicText || overview.sic_codes,
      accounts: accounts, mortgages: profile.Mortgages || null, previous_names: profile.PreviousNames || [],
      source: uri.source,
    } : null,
    overview: { ...overview, source: overviewUrl },
    officers: { ...officers, source: sources.officers },
    persons_with_significant_control: { ...psc, source: sources.psc },
    filing_history_highlights: { items: filings, source: sources.filing_history },
    charges: { ...charges, source: sources.charges },
    compliance: {
      accounts_overdue: overdue_accounts,
      confirmation_statement_overdue: overdue_confirmation,
      accounts_text: overview.accounts_text,
      confirmation_statement_text: overview.confirmation_statement_text,
    },
    red_flags: flags,
    sources,
    note: "Built from Companies House public pages + free URI JSON (no API key). For higher-rate official REST access, add a free API key from developer.company-information.service.gov.uk.",
  };
}
