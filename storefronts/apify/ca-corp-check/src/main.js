import { Actor } from "apify";
import { parse } from "csv-parse";
import { Readable } from "node:stream";
await Actor.init();
const input = (await Actor.getInput()) || {};
const nums = new Set([].concat(input.numbers || []).map((v) => String(v).replace(/\D/g, "").replace(/^0+/, "")).filter(Boolean));
const bns = new Set([].concat(input.bns || []).map((v) => String(v).replace(/\D/g, "").slice(0, 9)).filter((v) => v.length === 9));
const names = [].concat(input.names || []).map((s) => String(s).toUpperCase().trim()).filter(Boolean);
const limit = input.limit || 25;
if (!nums.size && !bns.size && !names.length) throw new Error("Provide numbers, bns or names");
const FILES = ["https://d4bf66bykfyaf.cloudfront.net/corporations-active-cbca-en.csv", "https://d4bf66bykfyaf.cloudfront.net/corporations-active-non-cbca-en.csv"];
const SRC = "Corporations Canada Federal Corporations open data (open.canada.ca), Open Government Licence - Canada";
const hits = new Map(); let nameHits = 0;
for (const url of FILES) {
  const res = await fetch(url); if (!res.ok) throw new Error(`download ${res.status}`);
  const parser = Readable.fromWeb(res.body).pipe(parse({ columns: true, bom: true, relax_column_count: true }));
  for await (const r of parser) {
    const num = r["Corporation number"]; const bn = (r["Business number (BN)"] || "").slice(0, 9); const nm = (r["Corporate name - form 1"] || "").toUpperCase();
    let q = nums.has(num) ? num : bns.has(bn) ? bn : null;
    if (!q && names.length && nameHits < limit * names.length) { const n = names.find((x) => nm.includes(x)); if (n) { q = n; nameHits++; } }
    if (!q) continue;
    hits.set(num, { found: true, query: q, corporation_number: num, business_number: bn || null, name: r["Corporate name - form 1"], name_alt: r["Corporate name - form 2"] || null,
      governing_legislation: r["Governing legislation"], status: r["Status"], status_detail: r["Status Detail"] || null, anniversary_date: r["Anniversary date"] || null,
      last_annual_filing_year: r["Year of last annual filing"] || null, last_annual_meeting: r["Date of last annual meeting"] || null,
      registered_office: [r["Street"], r["Street 2"], r["City/town"], r["Province/territory"], r["Postal code"], r["Country"]].filter(Boolean).join(", "),
      directors_min: r["Minimum number of directors"] ? +r["Minimum number of directors"] : null, directors_max: r["Maximum number of directors"] ? +r["Maximum number of directors"] : null, source: SRC });
  }
}
for (const v of hits.values()) await Actor.pushData(v, "company-report");
for (const q of [...nums, ...bns]) if (![...hits.values()].some((h) => h.query === q)) await Actor.pushData({ found: false, query: q });
await Actor.exit();
