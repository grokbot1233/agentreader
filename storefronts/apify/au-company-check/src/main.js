import { Actor } from "apify";
await Actor.init();
const input = (await Actor.getInput()) || {};
const RID = "5c3914e6-413e-4a2c-b890-bf8efe3eabf2"; // ASIC Company Dataset - Current (data.gov.au, CC BY 3.0 AU)
const API = "https://data.gov.au/data/api/3/action/datastore_search";
const queries = [];
for (const v of [].concat(input.acns || [], input.acn || [])) queries.push({ ACN: String(v).replace(/\D/g, "").padStart(9, "0") });
for (const v of [].concat(input.abns || [], input.abn || [])) queries.push({ ABN: String(v).replace(/\D/g, "") });
const names = [].concat(input.names || [], input.name || []);
if (!queries.length && !names.length) throw new Error("Provide acn/acns, abn/abns or name/names");
const norm = (r, q) => ({ source: "ASIC Company Dataset (data.gov.au)", query: q, acn: r.ACN, abn: r.ABN, name: r["Company Name"], current_name: r["Current Name"] || null,
  type: r.Type, class: r.Class, sub_class: r["Sub Class"], status: r.Status, registered: r["Date of Registration"], deregistered: r["Date of Deregistration"], previous_state: r["Previous State of Registration"] });
async function run(params, q) {
  const res = await fetch(`${API}?${new URLSearchParams({ resource_id: RID, limit: String(input.limit || 10), ...params })}`);
  const j = await res.json();
  const recs = j?.result?.records || [];
  if (!recs.length) await Actor.pushData({ query: q, found: false }, "company-report");
  for (const r of recs) await Actor.pushData({ found: true, ...norm(r, q) }, "company-report");
}
for (const f of queries) await run({ filters: JSON.stringify(f) }, Object.values(f)[0]);
for (const n of names) await run({ q: JSON.stringify({ "Company Name": n }) }, n);
await Actor.exit();
