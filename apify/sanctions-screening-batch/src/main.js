import { Actor, log } from "apify";
import { refreshSanctionsIndex, screenSanctions } from "./sanctions-lib.js";

// Same wording as AgentReader /uk-dd and /sanctions.
const DISCLAIMER =
  "Screening aid only; not a regulated AML/KYC determination. Matches are scored candidates (fuzzy name similarity over public lists), not confirmed hits. Screening aid over public sanctions lists only. Not a regulated AML/KYC/KYB determination, legal advice, or a guarantee of match/non-match. Confirm hits at the issuing authority before acting.";

// In-memory stand-in for the Cloudflare KV namespace the AgentReader screener caches its index in.
const mem = new Map();
const env = { LOG: { get: async (k, type) => (mem.has(k) ? (type === "arrayBuffer" ? mem.get(k) : null) : null), put: async (k, v) => { mem.set(k, v); } } };

await Actor.init();
const input = (await Actor.getInput()) || {};
let names = [].concat(input.names || []).map((n) => (typeof n === "string" ? { name: n } : n)).filter((n) => n && String(n.name || "").trim());
if (!names.length) throw new Error('Provide "names": ["BANCO NACIONAL DE CUBA", {"name": "Jane Doe", "type": "individual", "country": "Russia", "dob": "1970"}]');
const max = Math.min(Number(input.maxNames) || 1000, 5000);
if (names.length > max) { log.warning(`Truncating to ${max} names`); names = names.slice(0, max); }
const minScore = Math.max(0.75, Math.min(1, Number(input.minScore) || 0.75));
const maxMatches = Math.min(Math.max(Number(input.maxMatchesPerName) || 10, 1), 25);

log.info("Downloading public sanctions lists (OFAC SDN + non-SDN consolidated, UK FCDO, UN SC, EU FSF)...");
const refresh = await refreshSanctionsIndex(env);
for (const [k, v] of Object.entries(refresh.sources)) log.info(`${k}: ${v.count} entries${v.error ? ` (ERROR: ${v.error})` : ""}`);
if (!refresh.ok) throw new Error(`Sanctions lists could not be loaded: ${refresh.error}`);
const lists = Object.fromEntries(Object.entries(refresh.sources).map(([k, v]) => [k, { entries: v.count, url: v.url, licence: v.licence, published: v.pub || null, error: v.error || null }]));

const listsScreened = Object.keys(lists).filter((k) => lists[k].entries > 0);
const listsUnavailable = Object.keys(lists).filter((k) => !lists[k].entries).map((k) => ({ list: k, error: lists[k].error }));
if (listsUnavailable.length) log.warning(`Not screened this run (upstream download failed): ${listsUnavailable.map((x) => x.list).join(", ")}`);
let flagged = 0, errors = 0;
for (const item of names) {
  const q = { name: String(item.name).trim(), country: item.country, dob: item.dob, year: item.year, type: item.type };
  try {
    const r = await screenSanctions(env, q);
    const matches = r.matches.filter((m) => m.score >= minScore).slice(0, maxMatches);
    if (matches.length) flagged++;
    await Actor.pushData({
      name: q.name, query: r.query, possible_match: matches.length > 0, match_count: matches.length, highest_score: matches[0]?.score ?? 0,
      top_match: matches[0] ? `${matches[0].name} [${matches[0].list}${matches[0].program ? ` / ${matches[0].program}` : ""}]` : null,
      matches, screened_at: r.screened_at, index_built_at: r.index_built_at, lists_screened: listsScreened, ...(listsUnavailable.length ? { lists_unavailable: listsUnavailable } : {}), disclaimer: DISCLAIMER,
      also_available: { x402_api: "https://api.axiomworks.co.uk/sanctions-batch ($1 USDC per batch of up to 50 names)", single: "https://api.axiomworks.co.uk/sanctions ($0.05)", kyb_pack: "https://api.axiomworks.co.uk/kyb ($2.50)", mcp: "https://api.axiomworks.co.uk/mcp" },
    }, "name-screened");
  } catch (e) {
    errors++;
    await Actor.pushData({ name: q.name, ok: false, error: String(e?.message || e), disclaimer: DISCLAIMER });
  }
}
await Actor.setValue("OUTPUT", { screened: names.length, possible_match_count: flagged, errors, min_score: minScore, lists_screened: listsScreened, lists_unavailable: listsUnavailable, lists, index_entries: refresh.entries, disclaimer: DISCLAIMER });
log.info(`Done: ${names.length} screened, ${flagged} with candidate matches, ${errors} errors`);
await Actor.exit();
