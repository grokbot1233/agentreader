import { Actor } from "apify";

async function loadSecret(name) {
  if (process.env[name]) return process.env[name];
  try {
    const store = await Actor.openKeyValueStore("axiom-secrets");
    const v = await store.getValue(name);
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object" && v.value) return String(v.value).trim();
  } catch (e) {
    // ignore — fall through
  }
  return "";
}

const CH_BASE = "https://api.company-information.service.gov.uk";

async function chKey() {
  const k = await loadSecret("CH_API_KEY");
  if (!k) throw new Error("CH_API_KEY missing — set Actor env or put it in key-value store axiom-secrets");
  return k;
}

async function chGet(path) {
  const res = await fetch(`${CH_BASE}${path}`, {
    headers: {
      Authorization: "Basic " + Buffer.from((await chKey()) + ":").toString("base64"),
      Accept: "application/json",
      "User-Agent": "AxiomWorks-Apify/1.0 (info@axiomworks.co.uk)",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Companies House ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function redFlags(company, officers = []) {
  const flags = [];
  const status = (company?.company_status || "").toLowerCase();
  if (status && status !== "active") flags.push(`status:${status}`);
  if (company?.has_been_liquidated) flags.push("liquidated");
  if (company?.has_insolvency_history) flags.push("insolvency_history");
  if (company?.has_charges) flags.push("has_charges");
  const activeOfficers = (officers || []).filter((o) => !o.resigned_on);
  if (activeOfficers.length === 0) flags.push("no_active_officers");
  if (activeOfficers.length === 1) flags.push("sole_officer");
  return flags;
}


async function vies(vat) {
  const clean = vat.replace(/[\s.]+/g, "").toUpperCase();
  const country = clean.slice(0, 2);
  const number = clean.slice(2);
  const res = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${number}`);
  if (!res.ok) return { error: `VIES HTTP ${res.status}` };
  return res.json();
}

async function websiteLite(domain) {
  const host = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "").toLowerCase();
  const out = { domain: host, ok: false, final_url: null, title: null, has_https: false };
  try {
    const res = await fetch("https://" + host, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "User-Agent": "AxiomWorks-KYB/1.0" } });
    out.ok = res.ok;
    out.final_url = res.url;
    out.has_https = (res.url || "").startsWith("https");
    const html = (await res.text()).slice(0, 50000);
    const m = html.match(/<title[^>]*>([^<]{1,200})/i);
    out.title = m ? m[1].trim() : null;
  } catch (e) {
    out.error = String(e.message || e);
  }
  return out;
}

await Actor.init();
const input = (await Actor.getInput()) || {};
const domain = (input.domain || "").trim();
const number = (input.companyNumber || "").trim().toUpperCase().replace(/\s+/g, "");
const name = (input.companyName || "").trim();
const vat = (input.vat || "").trim();
if (!domain && !number && !name && !vat) throw new Error("Provide domain and/or UK company number/name and/or EU VAT");

const report = {
  product: "agent-kyb-check",
  disclaimer: "Screening over public registries only. Not a KYC/KYB/AML determination, credit score, or investment advice.",
  inputs: { domain: domain || null, company_number: number || null, company_name: name || null, vat: vat || null },
  website: null,
  uk: null,
  eu_vat: null,
  trust: { flag: "INSUFFICIENT_DATA", score: 0, reasons: [] },
};

const tasks = [];
if (domain) tasks.push((async () => { report.website = await websiteLite(domain); })());
if (number || name) tasks.push((async () => {
  let num = number;
  if (!num && name) {
    const search = await chGet(`/search/companies?${new URLSearchParams({ q: name, items_per_page: "5" })}`);
    num = search?.items?.[0]?.company_number;
  }
  if (!num) { report.uk = { error: "no match" }; return; }
  const company = await chGet(`/company/${num}`);
  const off = await chGet(`/company/${num}/officers?items_per_page=20`);
  const officers = off?.items || [];
  report.uk = {
    company_number: company.company_number,
    company_name: company.company_name,
    company_status: company.company_status,
    date_of_creation: company.date_of_creation,
    sic_codes: company.sic_codes || [],
    registered_office_address: company.registered_office_address,
    officers_active: officers.filter((o) => !o.resigned_on).map((o) => o.name),
    red_flags: redFlags(company, officers),
  };
})());
if (vat) tasks.push((async () => { report.eu_vat = await vies(vat); })());
await Promise.all(tasks);

let score = 0;
const reasons = [];
if (report.website?.ok) { score += 25; } else if (report.website) { reasons.push("website_unreachable"); score -= 10; }
if (report.website?.has_https) score += 10;
if (report.uk?.company_status === "active") { score += 35; } else if (report.uk) { reasons.push("uk_not_active"); score -= 20; }
if (report.uk?.red_flags?.length) { reasons.push(...report.uk.red_flags); score -= 10 * report.uk.red_flags.length; }
if (report.eu_vat?.isValid === true || report.eu_vat?.valid === true) { score += 30; }
else if (report.eu_vat && !report.eu_vat.error) { reasons.push("vat_invalid"); score -= 15; }
score = Math.max(0, Math.min(100, score));
const flag = score >= 70 ? "OK" : score >= 40 ? "REVIEW" : (report.uk || report.eu_vat || report.website) ? "FAIL" : "INSUFFICIENT_DATA";
report.trust = { flag, score, reasons };

const { eventChargeLimitReached } = await Actor.pushData(report, "kyb-check");
await Actor.setValue("OUTPUT", report);
await Actor.exit();
