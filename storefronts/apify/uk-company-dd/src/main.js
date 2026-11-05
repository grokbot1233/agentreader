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


await Actor.init();
const input = (await Actor.getInput()) || {};
let number = (input.companyNumber || "").trim().toUpperCase().replace(/\s+/g, "");
const name = (input.companyName || "").trim();
const includeOfficers = input.includeOfficers !== false;
const maxOfficers = Math.min(100, Math.max(1, Number(input.maxOfficers) || 50));

if (!number && !name) throw new Error("Provide companyNumber or companyName");

if (!number && name) {
  const q = new URLSearchParams({ q: name, items_per_page: "5" });
  const search = await chGet(`/search/companies?${q}`);
  const hit = (search?.items || [])[0];
  if (!hit?.company_number) throw new Error(`No Companies House match for name: ${name}`);
  number = hit.company_number;
}

const company = await chGet(`/company/${number}`);
if (!company) throw new Error(`Company not found: ${number}`);

let officers = [];
if (includeOfficers) {
  const off = await chGet(`/company/${number}/officers?items_per_page=${maxOfficers}`);
  officers = (off?.items || []).map((o) => ({
    name: o.name,
    role: o.officer_role,
    appointed_on: o.appointed_on || null,
    resigned_on: o.resigned_on || null,
    nationality: o.nationality || null,
    country_of_residence: o.country_of_residence || null,
    date_of_birth: o.date_of_birth || null,
  }));
}

const flags = redFlags(company, officers);
const report = {
  source: "Companies House (official REST API)",
  attribution: "Contains public sector information licensed under the Open Government Licence v3.0.",
  company_number: company.company_number,
  company_name: company.company_name,
  company_status: company.company_status,
  company_type: company.type,
  date_of_creation: company.date_of_creation,
  registered_office_address: company.registered_office_address,
  sic_codes: company.sic_codes || [],
  accounts: company.accounts || null,
  confirmation_statement: company.confirmation_statement || null,
  has_charges: !!company.has_charges,
  has_insolvency_history: !!company.has_insolvency_history,
  has_been_liquidated: !!company.has_been_liquidated,
  officers,
  officers_count: officers.length,
  red_flags: flags,
  trust_hint: flags.length ? "REVIEW" : "OK",
};

const { eventChargeLimitReached } = await Actor.pushData(report, "company-report");
await Actor.setValue("OUTPUT", report);
if (eventChargeLimitReached) console.log("Charge limit reached");
await Actor.exit();
