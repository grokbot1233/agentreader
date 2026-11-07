import { Actor, log } from "apify";
import { noCompany, dkCompany, fiCompany, chCompany, plCompany, czCompany, beCompany, skCompany, frCompany } from "./registries.js";

const DISCLAIMER = "Screening aid only; not a regulated AML/KYC/KYB determination, credit score or legal advice. Data comes from official open registries; confirm identifiers at source before onboarding, contracting or paying.";

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
/** Normalise registry dates (YYYY-MM-DD, DD.MM.YYYY, "August 8, 1905") to ISO YYYY-MM-DD; unknown formats pass through. */
function isoDate(v) {
  if (!v) return null;
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/); if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return t;
}
const join = (...p) => p.filter((x) => x !== null && x !== undefined && String(x).trim() !== "").join(", ") || null;
const people = (arr, nameK = "name", roleK = "role", sinceK) =>
  Array.isArray(arr) && arr.length ? arr.map((o) => ({ name: o[nameK] ?? null, role: o[roleK] ?? null, since: sinceK ? o[sinceK] ?? null : null })) : null;

// country -> [fetcher, input builder, normaliser]
const REG = {
  NO: [noCompany, (id) => ({ orgnr: id }), (d) => ({
    company_id: d.orgnr, name: d.name, status: d.status, legal_form: d.orgform?.description || d.orgform?.code || null,
    registered_address: d.forretningsadresse ? join(d.forretningsadresse.address, [d.forretningsadresse.postal_code, d.forretningsadresse.city].filter(Boolean).join(" "), d.forretningsadresse.country) : null,
    incorporation_date: d.stiftelsesdato || null, officers: null, registry: "Brønnøysundregistrene Enhetsregisteret" })],
  DK: [dkCompany, (id) => ({ cvr: id }), (d) => ({
    company_id: d.cvr, name: d.name, status: d.status, legal_form: d.company_type || null,
    registered_address: join(d.address, [d.zipcode, d.city].filter(Boolean).join(" "), "Denmark"),
    incorporation_date: d.startdate || null, officers: people(d.direktion, "name", "role", "startdate"),
    owners: people(d.ejere, "name", "ownership_range", "startdate"), registry: "CVR (Erhvervsstyrelsen) via apicvr.dk" })],
  FI: [fiCompany, (id) => ({ ytunnus: id }), (d) => ({
    company_id: d.business_id, name: d.name, status: d.status, legal_form: d.company_form?.description_en || null,
    registered_address: join(d.address, [d.postcode, d.city].filter(Boolean).join(" "), "Finland"),
    incorporation_date: d.registration_date || null, officers: null, registry: "PRH / YTJ (Finnish Trade Register)" })],
  CH: [chCompany, (id) => ({ uid: id }), (d) => ({
    company_id: d.uid, name: d.name, status: d.status, legal_form: d.legal_form?.description_en || null,
    registered_address: join(d.address, "Switzerland"), incorporation_date: null, officers: null,
    registry: "Zefix / UID register (Federal Office of Justice)" })],
  PL: [plCompany, (id) => (String(id).replace(/\D/g, "").length === 10 && !/^0{3}/.test(String(id).replace(/\D/g, "")) ? { nip: id } : { krs: id }), (d) => ({
    company_id: d.krs, name: d.name, status: d.status_hint === "current_extract" ? "registered (current KRS extract)" : d.status_hint || null,
    legal_form: d.legal_form || null, registered_address: d.address || null, incorporation_date: d.registration_date || null,
    officers: people(d.representation?.board), registry: "KRS (Ministry of Justice)" })],
  CZ: [czCompany, (id) => ({ ico: id }), (d) => ({
    company_id: d.ico, name: d.name, status: d.status, legal_form: d.legal_form?.description_en || null,
    registered_address: join(d.address, "Czechia"), incorporation_date: d.founded || null, officers: null, registry: "ARES (Ministry of Finance)" })],
  BE: [beCompany, (id) => ({ enterprise_number: id }), (d) => ({
    company_id: d.enterprise_number, name: d.name, status: d.status, legal_form: d.legal_form || null,
    registered_address: join(d.address, "Belgium"), incorporation_date: d.start_date || null, officers: people(d.functions, "name", "role", "since"),
    registry: "CBE/KBO Public Search (FPS Economy)" })],
  SK: [skCompany, (id) => ({ ico: id }), (d) => ({
    company_id: d.ico, name: d.name, status: d.status, legal_form: d.legal_form?.description || null,
    registered_address: d.address || null, incorporation_date: d.establishment || null, officers: people(d.statutory_bodies, "name", "role", "valid_from"),
    registry: "RPO (Statistical Office of the Slovak Republic)" })],
  FR: [frCompany, (id) => (String(id).replace(/\D/g, "").length === 14 ? { siret: id } : { siren: id }), (d) => ({
    company_id: d.siren, name: d.name, status: d.status_label || d.status, legal_form: d.legal_form ? `INSEE catégorie juridique ${d.legal_form}` : null,
    registered_address: join(d.siege?.address, "France"), incorporation_date: d.created || null, officers: people(d.dirigeants),
    registry: "API Recherche d'entreprises (INSEE / RNE)" })],
};
const ALIAS = { NORWAY: "NO", DENMARK: "DK", FINLAND: "FI", SWITZERLAND: "CH", POLAND: "PL", CZECHIA: "CZ", "CZECH REPUBLIC": "CZ", BELGIUM: "BE", SLOVAKIA: "SK", FRANCE: "FR" };

await Actor.init();
const input = (await Actor.getInput()) || {};
let companies = [].concat(input.companies || []);
// Also accept "DK:24256790" strings
companies = companies.map((c) => (typeof c === "string" ? { country: c.split(/[:\s]/)[0], id: c.split(/[:\s]/).slice(1).join("") } : c));
if (!companies.length) throw new Error('Provide "companies": [{ "country": "DK", "id": "24256790" }, ...]');
const max = Math.min(Number(input.maxCompanies) || 500, 1000);
if (companies.length > max) { log.warning(`Truncating to ${max} companies`); companies = companies.slice(0, max); }
const includeRaw = input.includeRaw !== false;

let ok = 0, failed = 0;
const summary = [];
for (const c of companies) {
  const cc0 = String(c?.country || "").trim().toUpperCase();
  const cc = ALIAS[cc0] || cc0;
  const id = String(c?.id ?? "").trim();
  const base = { query: { country: cc0 || null, id: id || null }, checked_at: new Date().toISOString() };
  const reg = REG[cc];
  if (!reg || !id) {
    failed++;
    await Actor.pushData({ ...base, found: false, error: !reg ? `unsupported country "${cc0}" (supported: ${Object.keys(REG).join(", ")})` : "missing id" });
    continue;
  }
  const [fn, mk, norm] = reg;
  let attempt = 0, rec = null, err = null;
  while (attempt < 3 && !rec) {
    attempt++;
    try { rec = await fn(mk(id)); }
    catch (e) {
      err = e; const st = e?.status;
      if (st && st !== 429 && st < 500) break; // user/not-found errors: do not retry
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  if (!rec) {
    failed++;
    log.warning(`${cc} ${id}: ${err?.message || err}`);
    await Actor.pushData({ ...base, found: false, country: cc, error: String(err?.message || err), http_status: err?.status ?? null });
    summary.push({ country: cc, id, found: false });
    continue;
  }
  const { product, price, upsell, disclaimer: srcDisclaimer, ...details } = rec;
  const n = norm(rec);
  n.incorporation_date = isoDate(n.incorporation_date);
  const out = {
    ...base, found: true, country: cc, ...n,
    red_flags: rec.red_flags || [], source: rec.source || n.registry, source_url: rec.source_url || null,
    attribution: rec.attribution || null, disclaimer: DISCLAIMER, source_disclaimer: srcDisclaimer || null,
    ...(includeRaw ? { details } : {}),
    also_available: {
      x402_api: `https://api.axiomworks.co.uk/${cc.toLowerCase()}-company ($0.25 USDC per call)`,
      registry_batch: "https://api.axiomworks.co.uk/registry-batch ($0.30)",
      kyb_pack: "https://api.axiomworks.co.uk/kyb ($2.50, registry + VAT + LEI + sanctions)",
      mcp: "https://api.axiomworks.co.uk/mcp",
    },
  };
  ok++;
  await Actor.pushData(out, "company-record");
  summary.push({ country: cc, id, found: true, name: out.name, status: out.status });
}
await Actor.setValue("OUTPUT", { requested: companies.length, found: ok, failed, results: summary });
log.info(`Done: ${ok} found, ${failed} failed`);
await Actor.exit();
