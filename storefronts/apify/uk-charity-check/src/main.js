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

async function charityKey() {
  const k = await loadSecret("CHARITY_KEY");
  if (!k) throw new Error("CHARITY_KEY missing — set Actor env or put it in key-value store axiom-secrets");
  return k;
}

await Actor.init();
const input = (await Actor.getInput()) || {};
let number = (input.charityNumber || "").trim();
const name = (input.name || "").trim();
if (!number && !name) throw new Error("Provide charityNumber or name");

const headers = {
  "Ocp-Apim-Subscription-Key": await charityKey(),
  Accept: "application/json",
  "User-Agent": "AxiomWorks-Apify/1.0 (info@axiomworks.co.uk)",
};

if (!number && name) {
  const url = `https://api.charitycommission.gov.uk/register/api/searchCharityName/${encodeURIComponent(name)}/0`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Charity search HTTP ${res.status}`);
  const hits = await res.json();
  const hit = Array.isArray(hits) ? hits[0] : hits?.[0];
  number = String(hit?.reg_charity_number || hit?.charity_number || "");
  if (!number) throw new Error(`No charity match for: ${name}`);
}

const url = `https://api.charitycommission.gov.uk/register/api/allcharitydetailsV2/${number}/0`;
const res = await fetch(url, { headers });
if (!res.ok) throw new Error(`Charity detail HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
const d = await res.json();
const out = {
  source: "UK Charity Commission Register of Charities",
  attribution: "Contains public sector information licensed under the Open Government Licence v3.0.",
  charity_number: number,
  name: d.charity_name || d.name,
  status: d.reg_status || d.status,
  income: d.latest_income ?? d.income ?? null,
  spending: d.latest_expenditure ?? null,
  activities: d.charitable_objects || d.activities || null,
  trustees_count: d.trustee_count ?? (d.trustees ? d.trustees.length : null),
  address: d.address || null,
  raw_keys: Object.keys(d).slice(0, 40),
};
await Actor.pushData(out, "charity-check");
await Actor.setValue("OUTPUT", out);
await Actor.exit();
