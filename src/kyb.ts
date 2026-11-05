import { UserError } from "./core";
import { companyResearch } from "./company";
import { ukCompany } from "./uk-company";
import { euVat } from "./eu-vat";
import { kybSanctionsScreen } from "./sanctions";

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
}) {
  const rawDomain = s(input.domain) || (s(input.name).includes(".") ? s(input.name) : "");
  const domain = domainish(rawDomain);
  const number = s(input.number);
  const name = !domain && s(input.name) && !s(input.name).includes(".") ? s(input.name) : "";
  const vat = s(input.vat) || (s(input.country) && s(input.vat_number) ? s(input.country) + s(input.vat_number) : "");

  if (!domain && !number && !name && !vat) {
    throw new UserError("provide domain and/or UK company number/name and/or EU VAT");
  }

  const out: any = {
    product: "kyb",
    price: "$2.00",
    disclaimer: "Screening over public registries and public sanctions lists only. Not a KYC/KYB/AML determination, credit score, or investment advice. Sanctions matches are scored candidates — never a certainty. Confirm identifiers at source before onboarding, contracting, or paying.",
    inputs: { domain: domain || null, number: number || null, name: name || null, vat: vat || null },
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
      out.uk?.profile?.company_name ||
      out.uk?.overview?.company_name ||
      out.eu_vat?.name ||
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
    out.sanctions = await kybSanctionsScreen(env, { entityName, directors });
    out.sources.sanctions_lists = out.sanctions?.skipped ? false : true;
  } catch (e: any) {
    out.sanctions = { error: String(e?.message || e), disclaimer: "Screening aid only; not a regulated AML/KYC determination." };
  }

  // Composite trust heuristic (transparent, non-regulatory)
  let score = 0;
  const reasons: string[] = [];
  const ukStatus = (out.uk?.status || out.uk?.profile?.company_status || out.uk?.overview?.status || "").toLowerCase();
  const flags: any[] = out.uk?.red_flags || [];
  const high = flags.filter((f: any) => f.severity === "high").length;
  const medium = flags.filter((f: any) => f.severity === "medium").length;

  if (out.uk && !out.uk.error) {
    if (ukStatus === "active") { score += 40; reasons.push("UK company status active"); }
    else if (ukStatus) { score -= 30; reasons.push(`UK company status: ${ukStatus}`); }
    if (high) { score -= 25 * high; reasons.push(`${high} high-severity UK red flag(s)`); }
    if (medium) { score -= 10 * medium; reasons.push(`${medium} medium-severity UK red flag(s)`); }
    if (out.uk.mass_formation_office?.matched || out.uk.overview?.mass_formation_office?.matched) {
      score -= 15; reasons.push("registered office matches common formation-agent / virtual-office pattern");
    }
  }
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
  const have = [out.uk && !out.uk.error, out.eu_vat && !out.eu_vat.error, out.website && !out.website.error].filter(Boolean).length;
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
