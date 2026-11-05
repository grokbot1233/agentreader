import { UserError } from "./core";
import { companyResearch } from "./company";
import { ukCompany } from "./uk-company";
import { euVat } from "./eu-vat";
import { kybSanctionsScreen } from "./sanctions";
import { ukOfficerSearch } from "./uk-officer";
export function bindingRegistries(env: any): KybRegistries {
  const call = async (q: string) => { if (!env.AU) throw new Error("registry backend not bound"); const r = await env.AU.fetch(`https://au.internal/internal/${q}`, { headers: { "x-internal-key": env.AU_INTERNAL_KEY || "" } }); const j: any = await r.json(); if (!r.ok) throw new Error(r.status === 404 ? "not found in register snapshot" : j?.error || "registry error"); return j; };
  return {
    au: (b) => { const raw = String(b.acn || b.abn || "").replace(/\s/g, ""); const acn = /^\d{11}$/.test(raw) ? raw.slice(2) : raw; if (!/^\d{9}$/.test(acn)) throw new Error("acn must be 9 digits (or abn 11)"); return call(`au?acn=${acn}`); },
    ca: (b) => { const n = String(b.number || "").replace(/\D/g, ""), bn = String(b.bn || "").replace(/\D/g, "").slice(0, 9); if (n && n.length <= 8) return call(`ca?number=${n}`); if (bn.length === 9) return call(`ca?bn=${bn}`); throw new Error("ca_number or 9-digit bn required"); },
  };
}
export type KybRegistries = { au?: (b: any) => Promise<any>; ca?: (b: any) => Promise<any> };

type Env = { LOG: KVNamespace; CH_API_KEY?: string };

function s(v: any) {
  return (v == null ? "" : String(v)).trim();
}

function domainish(v: string) {
  return v.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "").toLowerCase();
}

/** Composite agent KYB / due-diligence pack. Screening only — not a regulated determination. */
export async function kybReport(env: Env, input: {
  domain?: string; number?: string; name?: string; vat?: string; country?: string; vat_number?: string;
  acn?: string; abn?: string; ca_number?: string; bn?: string;
}, reg: KybRegistries = {}) {
  const acn = s(input.acn) || s(input.abn), caNum = s(input.ca_number), bn = s(input.bn);
  const rawDomain = s(input.domain) || (s(input.name).includes(".") ? s(input.name) : "");
  const domain = domainish(rawDomain);
  const number = s(input.number);
  const name = !domain && s(input.name) && !s(input.name).includes(".") ? s(input.name) : "";
  const vat = s(input.vat) || (s(input.country) && s(input.vat_number) ? s(input.country) + s(input.vat_number) : "");

  if (!domain && !number && !name && !vat && !acn && !caNum && !bn) {
    throw new UserError("provide domain and/or UK company number/name, AU acn/abn, CA ca_number/bn and/or EU VAT");
  }

  const out: any = {
    product: "kyb",
    price: "$2.50",
    disclaimer: "Screening over public registries and public sanctions lists only. Not a KYC/KYB/AML determination, credit score, or investment advice. Sanctions matches are scored candidates — never a certainty. Confirm identifiers at source before onboarding, contracting, or paying.",
    inputs: { domain: domain || null, number: number || null, name: name || null, vat: vat || null, acn: acn || null, ca_number: caNum || null, bn: bn || null },
    au: null as any,
    ca: null as any,
    directors_appointments: null as any,
    website: null as any,
    uk: null as any,
    eu_vat: null as any,
    trust: { flag: "INSUFFICIENT_DATA" as string, reasons: [] as string[], score: 0 },
    sources: {} as any,
  };

  const tasks: Promise<void>[] = [];

  if (domain) {
    tasks.push((async () => {
      try {
        out.website = await companyResearch({ domain });
        out.sources.website = out.website?.sources || true;
      } catch (e: any) {
        out.website = { error: String(e?.message || e) };
      }
    })());
  }

  if (number || name) {
    tasks.push((async () => {
      try {
        out.uk = await ukCompany(env, { number: number || undefined, name: name || undefined });
        out.sources.uk_companies_house = out.uk?.sources || true;
      } catch (e: any) {
        out.uk = { error: String(e?.message || e) };
      }
    })());
  } else if (domain && /\.uk$/i.test(domain)) {
    // best-effort: try company name from domain label
    const guess = domain.split(".")[0].replace(/-/g, " ");
    if (guess.length >= 3) {
      tasks.push((async () => {
        try {
          out.uk = await ukCompany(env, { name: guess });
          out.uk_guessed_from_domain = guess;
          out.sources.uk_companies_house = out.uk?.sources || true;
        } catch (e: any) {
          out.uk = { error: String(e?.message || e), note: "optional UK lookup from domain label failed" };
        }
      })());
    }
  }

  if (acn && reg.au) tasks.push((async () => { try { out.au = await reg.au!(/^\d{11}$/.test(acn.replace(/\s/g, "")) ? { abn: acn } : { acn }); out.sources.asic = true; } catch (e: any) { out.au = { error: String(e?.message || e) }; } })());
  if ((caNum || bn) && reg.ca) tasks.push((async () => { try { out.ca = await reg.ca!(caNum ? { number: caNum } : { bn }); if (out.ca?.matches) out.ca = out.ca.matches[0]; out.sources.corporations_canada = true; } catch (e: any) { out.ca = { error: String(e?.message || e) }; } })());
  if (vat) {
    tasks.push((async () => {
      try {
        out.eu_vat = await euVat(env, { vat });
        out.sources.eu_vies = true;
      } catch (e: any) {
        out.eu_vat = { error: String(e?.message || e) };
      }
    })());
  }

  await Promise.all(tasks);

  // Sanctions screen (entity + directors) — soft-fail; does not change $2 price
  out.sanctions = null as any;
  try {
    const entityName =
      out.uk?.name ||
      out.uk?.profile?.name ||
      out.uk?.profile?.company_name ||
      out.uk?.overview?.company_name ||
      out.eu_vat?.name ||
      out.au?.name ||
      out.ca?.name ||
      name ||
      null;
    const officers = out.uk?.officers?.items || out.uk?.officers || [];
    const directors: string[] = [];
    if (Array.isArray(officers)) {
      for (const o of officers) {
        if (directors.length >= 3) break;
        const n = o?.name;
        if (!n) continue;
        const role = String(o?.officer_role || o?.role || "").toLowerCase();
        const resigned = !!(o?.resigned_on || o?.resignedOn);
        if (resigned) continue;
        if (!role || /director|member/.test(role)) directors.push(String(n));
      }
    }
    const [sanc, appts] = await Promise.all([
      kybSanctionsScreen(env, { entityName, directors }),
      Promise.all(directors.map(async (d) => { try { const r: any = await ukOfficerSearch(env as any, { name: d, limit: 1 }); const o = r?.officers?.[0]; return o ? { director: d, best_match: o.name, active_appointments: o.active_count, appointments_total: o.appointments_total, flags: o.flags || [], note: "best name match on CH officer search; confirm DOB" } : { director: d, found: false }; } catch (e: any) { return { director: d, error: String(e?.message || e) }; } })),
    ]);
    out.sanctions = sanc; out.directors_appointments = appts.length ? appts : null;
    out.sources.sanctions_lists = out.sanctions?.skipped ? false : true;
  } catch (e: any) {
    out.sanctions = { error: String(e?.message || e), disclaimer: "Screening aid only; not a regulated AML/KYC determination." };
  }

  // Composite trust heuristic (transparent, non-regulatory)
  let score = 0;
  const reasons: string[] = [];
  const ukStatus = String(out.uk?.status || out.uk?.profile?.status || out.uk?.company?.status || out.uk?.profile?.company_status || out.uk?.overview?.status || "").toLowerCase();
  const flags: any[] = out.uk?.red_flags || [];
  const high = flags.filter((f: any) => f.severity === "high").length;
  // Outstanding charges (secured lending) are normal for established companies: count as a minor -3, not a medium red flag.
  const isCharge = (f: any) => /charge/i.test(String(f.code || f.id || f.name || f.flag || ""));
  const charges = flags.filter((f: any) => f.severity === "medium" && isCharge(f)).length;
  const medium = flags.filter((f: any) => f.severity === "medium" && !isCharge(f)).length;

  if (out.uk && !out.uk.error) {
    if (ukStatus === "active") { score += 40; reasons.push("UK company status active"); }
    else if (ukStatus) { score -= 30; reasons.push(`UK company status: ${ukStatus}`); }
    if (high) { score -= 25 * high; reasons.push(`${high} high-severity UK red flag(s)`); }
    if (charges) { score -= 3; reasons.push("outstanding registered charges (secured lending; common for established companies)"); }
    if (medium) { score -= 10 * medium; reasons.push(`${medium} medium-severity UK red flag(s)`); }
    if (out.uk.mass_formation_office?.matched || out.uk.overview?.mass_formation_office?.matched) {
      score -= 15; reasons.push("registered office matches common formation-agent / virtual-office pattern");
    }
  }
  for (const [k, lbl] of [["au", "AU ASIC"], ["ca", "CA Corporations Canada"]] as const) {
    const r = out[k]; if (!r || r.error) continue;
    const st = String(r.status || "").toUpperCase();
    if (st === "REGD" || st === "ACTIVE") { score += 40; reasons.push(`${lbl} status ${st.toLowerCase()}`); }
    else if (st) { score -= 30; reasons.push(`${lbl} status: ${r.status_desc || r.status_detail || st}`); }
    if (r.status_detail && /dissolution/i.test(r.status_detail)) { score -= 20; reasons.push(`${lbl}: ${r.status_detail}`); }
  }
  for (const d of out.directors_appointments || []) if ((d.active_appointments || 0) >= 20) { score -= 10; reasons.push(`director ${d.director} has ${d.active_appointments} active appointments (nominee/formation pattern?)`); }
  if (out.eu_vat && !out.eu_vat.error) {
    if (out.eu_vat.valid === true || out.eu_vat.isValid === true) { score += 30; reasons.push("EU VIES VAT valid"); }
    else if (out.eu_vat.valid === false || out.eu_vat.isValid === false) { score -= 20; reasons.push("EU VIES VAT not valid"); }
  }
  if (out.website && !out.website.error) {
    score += 15; reasons.push("website research completed");
    const issues = out.website?.dns?.issues || out.website?.issues || [];
    if (Array.isArray(issues) && issues.length >= 3) { score -= 5; reasons.push("website has multiple DNS/email issues"); }
  }
  if (out.sanctions && !out.sanctions.error && !out.sanctions.skipped && out.sanctions.possible_match) {
    const hs = Number(out.sanctions.highest_score || 0);
    if (hs >= 0.92) { score -= 35; reasons.push(`possible sanctions match (score ${hs}) — review required`); }
    else if (hs >= 0.8) { score -= 15; reasons.push(`possible sanctions match (score ${hs})`); }
  }

  score = Math.max(0, Math.min(100, score));
  let flag = "INSUFFICIENT_DATA";
  const have = [out.uk && !out.uk.error, out.au && !out.au.error, out.ca && !out.ca.error, out.eu_vat && !out.eu_vat.error, out.website && !out.website.error].filter(Boolean).length;
  if (have === 0) flag = "INSUFFICIENT_DATA";
  else if (high > 0 || score < 30) flag = "REVIEW";
  else if (score < 55 || medium >= 2) flag = "CAUTION";
  else flag = "CLEAR";

  out.trust = { flag, score, reasons, checks_completed: have };
  out.upsell = {
    deeper_uk: { path: "/uk-company", price: "$0.50" },
    monitor: { path: "/uk-watch", price: "$5.00/30d", why: "webhook when officers/status/filings change" },
    leads: { path: "/uk-leads", price: "$1.00", why: "new incorporations by SIC/area with directors" },
    sanctions: { path: "/sanctions", price: "$0.05", why: "screen any extra names (OFAC/UK/UN/EU)" },
  };
  return out;
}
