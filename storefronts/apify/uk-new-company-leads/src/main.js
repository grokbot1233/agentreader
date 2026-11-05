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
const sic = (input.sic || "").trim();
const location = (input.location || "").trim();
const postcodeArea = (input.postcodeArea || "").trim().toUpperCase();
const days = Math.min(7, Math.max(1, Number(input.days) || 1));
const withDirectors = input.withDirectors !== false;
const limit = Math.min(100, Math.max(1, Number(input.limit) || 25));
if (!sic && !location && !postcodeArea) throw new Error("Provide sic and/or location and/or postcodeArea");

const to = new Date();
const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
from.setUTCDate(from.getUTCDate() - (days - 1));
const iso = (d) => d.toISOString().slice(0, 10);

const q = new URLSearchParams({
  company_status: "active",
  incorporated_from: iso(from),
  incorporated_to: iso(to),
  size: "100",
});
if (sic) q.set("sic_codes", sic);
if (location) q.set("location", location);

const advanced = await chGet(`/advanced-search/companies?${q}`);
let items = advanced?.items || [];
if (postcodeArea) {
  const re = new RegExp("^" + postcodeArea.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  items = items.filter((c) => re.test((c.registered_office_address?.postal_code || "").replace(/\s+/g, "")));
}
items = items.slice(0, limit);

for (const c of items) {
  let directors = [];
  if (withDirectors) {
    try {
      const off = await chGet(`/company/${c.company_number}/officers?items_per_page=20`);
      directors = (off?.items || []).filter((o) => !o.resigned_on).map((o) => o.name);
    } catch (e) {
      directors = [];
    }
  }
  const lead = {
    company_number: c.company_number,
    company_name: c.company_name,
    company_status: c.company_status,
    company_type: c.company_type,
    date_of_creation: c.date_of_creation,
    sic_codes: c.sic_codes || [],
    registered_office_address: c.registered_office_address,
    directors: withDirectors ? directors : undefined,
    attribution: "Contains public sector information licensed under the Open Government Licence v3.0.",
  };
  const { eventChargeLimitReached } = await Actor.pushData(lead, "company-lead");
  if (eventChargeLimitReached) break;
}

await Actor.setValue("SUMMARY", {
  returned: items.length,
  query: { sic, location, postcodeArea, days, withDirectors, from: iso(from), to: iso(to) },
});
await Actor.exit();
