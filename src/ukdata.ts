import { UserError } from "./core";
const UA = "AxiomWorksAgentReader/1.6 (+https://api.axiomworks.co.uk; info@axiomworks.co.uk)";
export const PC = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
const T = (ms: number) => AbortSignal.timeout(ms);
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
async function postcode(pc: string) {
  const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc.replace(/\s/g, ""))}`, { headers: { "user-agent": UA }, signal: T(6000) });
  if (r.status === 404) throw new UserError(`postcode ${pc} not found (terminated or invalid)`, 404); if (!r.ok) throw new Error(`postcodes.io ${r.status}`);
  return (await r.json() as any).result;
}
const lbl = (u: string) => (u || "").split("/").pop()!.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

export async function ukProperty(p: { postcode: string; radius?: string; limit?: string }) {
  if (!PC.test((p.postcode || "").trim())) throw new UserError("postcode must be a full UK postcode, e.g. CB1 2AB", 400);
  const info = await postcode(p.postcode.trim());
  if (info.country === "Scotland" || info.country === "Northern Ireland") throw new UserError(`HM Land Registry Price Paid covers England & Wales only (${info.postcode} is in ${info.country})`, 422);
  const radius = Math.min(1000, Math.max(50, Number(p.radius) || 400)); const limit = Math.min(200, Math.max(5, Number(p.limit) || 50));
  const near = await (await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(info.postcode.replace(/\s/g, ""))}/nearest?limit=40&radius=${radius}`, { headers: { "user-agent": UA }, signal: T(6000) })).json() as any;
  const pcs: string[] = [...new Set([info.postcode, ...((near.result || []).map((x: any) => x.postcode))])];
  const q = `PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/> PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
SELECT ?date ?price ?pc ?paon ?saon ?street ?town ?type ?estate ?newbuild ?cat WHERE { VALUES ?pc { ${pcs.map((x) => `"${x}"`).join(" ")} }
 ?addr lrcommon:postcode ?pc . ?tx lrppi:propertyAddress ?addr ; lrppi:pricePaid ?price ; lrppi:transactionDate ?date ; lrppi:propertyType ?type ; lrppi:estateType ?estate ; lrppi:newBuild ?newbuild .
 OPTIONAL { ?tx lrppi:transactionCategory ?cat } OPTIONAL { ?addr lrcommon:paon ?paon } OPTIONAL { ?addr lrcommon:saon ?saon } OPTIONAL { ?addr lrcommon:street ?street } OPTIONAL { ?addr lrcommon:town ?town } } ORDER BY DESC(?date) LIMIT ${limit}`;
  let r: Response | null = null;
  for (let i = 0; i < 3; i++) {
    r = await fetch("https://landregistry.data.gov.uk/landregistry/query?query=" + encodeURIComponent(q), { headers: { accept: "application/sparql-results+json", "user-agent": UA }, signal: T(20000) });
    if (r.status !== 429 && r.status < 500) break; await new Promise((ok) => setTimeout(ok, 800 * (i + 1)));
  }
  if (!r!.ok) throw new Error(`land registry ${r!.status} (${(await r!.text()).slice(0, 80)})`);
  const rows = ((await r!.json() as any).results?.bindings || []).map((b: any) => ({ date: b.date?.value, price: Number(b.price?.value), postcode: b.pc?.value,
    address: [b.saon?.value, b.paon?.value, b.street?.value, b.town?.value].filter(Boolean).join(", "), property_type: lbl(b.type?.value), tenure: lbl(b.estate?.value), new_build: b.newbuild?.value === "true", category: b.cat ? lbl(b.cat.value) : null }));
  const yr = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10); const last12 = rows.filter((x: any) => x.date >= yr).map((x: any) => x.price);
  const byType: Record<string, number[]> = {}; for (const x of rows) (byType[x.property_type] ??= []).push(x.price);
  return { postcode: info.postcode, area: { district: info.admin_district, ward: info.admin_ward, region: info.region, country: info.country, lat: info.latitude, lon: info.longitude },
    search: { radius_m: radius, postcodes_searched: pcs.length }, summary: { sales: rows.length, latest_sale: rows[0]?.date || null, median_price: median(rows.map((x: any) => x.price)), median_last_12m: median(last12), sales_last_12m: last12.length,
      median_by_type: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, { median: median(v), n: v.length }])) }, sales: rows,
    source: "HM Land Registry Price Paid Data (OGL v3; contains HM Land Registry data © Crown copyright and database right) + postcodes.io (ONS/OS OGL)", coverage: "England & Wales, sales since 1995; ~2 month publication lag" };
}

export async function ukArea(p: { postcode: string }) {
  if (!PC.test((p.postcode || "").trim())) throw new UserError("postcode must be a full UK postcode, e.g. SW1A 2AA", 400);
  const i = await postcode(p.postcode.trim());
  const [crimeR, fsaR] = await Promise.allSettled([
    (async () => { const r = await fetch(`https://data.police.uk/api/crimes-street/all-crime?lat=${i.latitude}&lng=${i.longitude}`, { headers: { "user-agent": UA }, signal: T(10000) }); if (!r.ok) throw new Error(`police ${r.status}`); return r.json(); })(),
    (async () => { const r = await fetch(`https://api.ratings.food.gov.uk/Establishments?latitude=${i.latitude}&longitude=${i.longitude}&maxDistanceLimit=0.25&pageSize=0`, { headers: { "x-api-version": "2", accept: "application/json", "user-agent": UA }, signal: T(10000) }); if (!r.ok) throw new Error(`fsa ${r.status}`); return r.json(); })(),
  ]);
  let crime: any = { error: crimeR.status === "rejected" ? String((crimeR.reason as any)?.message) : null };
  if (crimeR.status === "fulfilled") { const list = crimeR.value as any[]; const by: Record<string, number> = {}; for (const c of list) by[c.category] = (by[c.category] || 0) + 1;
    crime = { month: list[0]?.month || null, total_within_1mile: list.length, by_category: Object.fromEntries(Object.entries(by).sort((a, b) => b[1] - a[1])), source: "data.police.uk (OGL v3), street-level crimes within ~1 mile, latest month" }; }
  let food: any = { error: fsaR.status === "rejected" ? String((fsaR.reason as any)?.message) : null };
  if (fsaR.status === "fulfilled") { const es = ((fsaR.value as any).establishments || []); const dist: Record<string, number> = {}; for (const e of es) dist[e.RatingValue] = (dist[e.RatingValue] || 0) + 1;
    const num = es.map((e: any) => Number(e.RatingValue)).filter((n: number) => !isNaN(n));
    food = { establishments_within_400m: es.length, rating_distribution: dist, average_rating: num.length ? Math.round(num.reduce((a: number, b: number) => a + b, 0) / num.length * 100) / 100 : null,
      lowest_rated: es.filter((e: any) => ["0", "1"].includes(String(e.RatingValue))).slice(0, 10).map((e: any) => ({ name: e.BusinessName, rating: e.RatingValue, type: e.BusinessType, date: e.RatingDate?.slice(0, 10) })),
      source: "Food Standards Agency ratings API (OGL v3)" }; }
  return { postcode: i.postcode, location: { lat: i.latitude, lon: i.longitude, eastings: i.eastings, northings: i.northings },
    geography: { country: i.country, region: i.region, local_authority: i.admin_district, county: i.admin_county, ward: i.admin_ward, parish: i.parish, constituency: i.parliamentary_constituency, lsoa: i.lsoa, msoa: i.msoa, nhs_icb: i.codes?.ccg ? i.ccg : i.nhs_ha, codes: i.codes },
    crime, food_hygiene: food, source: "postcodes.io (ONS/OS, OGL) + data.police.uk + FSA, all Open Government Licence v3" };
}
