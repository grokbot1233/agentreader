import { UserError } from "./core";
import { ukCompany } from "./uk-company";
import { kybSanctionsScreen } from "./sanctions";
import { domainLookup } from "./domain";
import { companyResearch } from "./company";

type Env = { LOG: KVNamespace; CH_API_KEY?: string };

function s(v: any) {
  return (v == null ? "" : String(v)).trim();
}

function domainish(v: string) {
  return v.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "").toLowerCase();
}

const DISCLAIMER =
  "UK due-diligence screening over public Companies House data, public sanctions lists, and optional public domain/RDAP signals only. Not a regulated KYC/KYB/AML determination, credit score, or investment advice. Sanctions matches are scored candidates — never a certainty. Confirm identifiers at source before onboarding, contracting, or paying.";

/** UK-only due-diligence job: full CH pack + sanctions + optional domain skim → trust flag. $1.00. */
export async function ukDdReport(env: Env, input: {
  number?: string; name?: string; domain?: string; preview?: boolean;
}) {
  const preview = !!input.preview;
  const number = s(input.number);
  const name = s(input.name);
  const rawDomain = s(input.domain);
  const domain = rawDomain ? domainish(rawDomain) : "";

  if (!number && !name) {
    throw new UserError("provide UK company number and/or name (optional domain for RDAP/website skim)");
  }

  const out: any = {
    product: "uk-dd",
    price: "$1.00",
    disclaimer: DISCLAIMER,
    inputs: { number: number || null, name: name || null, domain: domain || null },
    uk: null as any,
    sanctions: null as any,
    domain: null as any,
    website: null as any,
    trust: { flag: "INSUFFICIENT_DATA" as string, reasons: [] as string[], score: 0 },
    sources: {} as any,
  };

  // UK Companies House pack (full when paid; lite when preview)
  try {
    out.uk = await ukCompany(env, { number: number || undefined, name: name || undefined, lite: preview });
    out.sources.uk_companies_house = out.uk?.sources || true;
  } catch (e: any) {
    out.uk = { error: String(e?.message || e) };
  }

  // Optional domain RDAP (bounded; soft-fail)
  if (domain) {
    try {
      out.domain = await domainLookup({ domain });
      out.sources.rdap = true;
    } catch (e: any) {
      out.domain = { error: String(e?.message || e) };
    }
  }

  // Paid only: light website research (soft-fail; keep bounded)
  if (domain && !preview) {
    try {
      const research = await companyResearch({ domain });
      // Bound payload: keep summary fields, drop heavy page bodies
      out.website = {
        domain: research.domain || domain,
        homepage: research.homepage ? { title: research.homepage.title, url: research.homepage.url } : null,
        tech_stack: research.tech_stack ? Object.keys(research.tech_stack).slice(0, 12) : [],
        contacts: {
          email_count: (research.contacts?.emails || []).length,
          phone_count: (research.contacts?.phones || []).length,
        },
        dns_issues: (research.dns?.issues || research.issues || []).slice?.(0, 5) || research.dns?.issues || null,
        domain_registration: research.domain_registration || null,
        sources: research.sources || true,
      };
      out.sources.website = true;
    } catch (e: any) {
      out.website = { error: String(e?.message || e), note: "optional website skim failed" };
    }
  }

  // Sanctions: entity + (paid) up to 2 active officers
  try {
    const entityName =
      out.uk?.name ||
      out.uk?.profile?.company_name ||
      out.uk?.profile?.name ||
      out.uk?.overview?.company_name ||
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
    if (preview) {
      out.sanctions = entityName
        ? await kybSanctionsScreen(env, { entityName, directors: [] }).catch((e: any) => ({
            error: String(e?.message || e),
            skipped: true,
          }))
        : { skipped: true, reason: "preview: no entity name yet" };
      out.preview_omitted = ["full UK officers/PSC/filings/charges", "officer sanctions", "website research"];
    } else {
      const dirs = directors.slice(0, 2);
      out.sanctions = await kybSanctionsScreen(env, { entityName, directors: dirs }).catch((e: any) => ({
        error: String(e?.message || e),
        skipped: true,
      }));
      if (directors.length > dirs.length) {
        out.notes = [...(out.notes || []), `officer sanctions capped at ${dirs.length} of ${directors.length} active directors (CPU)`];
      }
    }
    out.sources.sanctions_lists = out.sanctions?.skipped ? false : true;
  } catch (e: any) {
    out.sanctions = {
      error: String(e?.message || e),
      disclaimer: "Screening aid only; not a regulated AML/KYC determination.",
    };
  }

  // Trust heuristic (shorter KYB-style)
  let score = 0;
  const reasons: string[] = [];
  const ukStatus = String(
    out.uk?.status || out.uk?.profile?.company_status || out.uk?.profile?.status || out.uk?.overview?.status || "",
  ).toLowerCase();
  const flags: any[] = out.uk?.red_flags || [];
  const high = flags.filter((f: any) => f.severity === "high").length;
  const isCharge = (f: any) => /charge/i.test(String(f.code || f.id || f.name || f.flag || ""));
  const charges = flags.filter((f: any) => f.severity === "medium" && isCharge(f)).length;
  const medium = flags.filter((f: any) => f.severity === "medium" && !isCharge(f)).length;

  if (out.uk && !out.uk.error) {
    if (ukStatus === "active") {
      score += 45;
      reasons.push("UK company status active");
    } else if (ukStatus) {
      score -= 30;
      reasons.push(`UK company status: ${ukStatus}`);
    }
    if (high) {
      score -= 25 * high;
      reasons.push(`${high} high-severity UK red flag(s)`);
    }
    if (charges) {
      score -= 3;
      reasons.push("outstanding registered charges (secured lending; common)");
    }
    if (medium) {
      score -= 10 * medium;
      reasons.push(`${medium} medium-severity UK red flag(s)`);
    }
    if (out.uk.mass_formation_office?.matched || out.uk.overview?.mass_formation_office?.matched) {
      score -= 15;
      reasons.push("registered office matches common formation-agent / virtual-office pattern");
    }
  }

  if (out.domain && !out.domain.error) {
    score += 10;
    reasons.push("domain RDAP resolved");
    const age = Number(out.domain.age_days);
    if (Number.isFinite(age) && age < 90) {
      score -= 8;
      reasons.push(`young domain (${age} days)`);
    }
    if (Array.isArray(out.domain.flags) && out.domain.flags.length) {
      score -= 5;
      reasons.push(`domain flags: ${out.domain.flags.slice(0, 3).join(",")}`);
    }
  }
  if (out.website && !out.website.error) {
    score += 10;
    reasons.push("website skim completed");
  }

  if (out.sanctions && !out.sanctions.error && !out.sanctions.skipped && out.sanctions.possible_match) {
    const hs = Number(out.sanctions.highest_score || 0);
    if (hs >= 0.92) {
      score -= 35;
      reasons.push(`possible sanctions match (score ${hs}) — review required`);
    } else if (hs >= 0.8) {
      score -= 15;
      reasons.push(`possible sanctions match (score ${hs})`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  const haveUk = !!(out.uk && !out.uk.error);
  let flag = "INSUFFICIENT_DATA";
  if (!haveUk) flag = "INSUFFICIENT_DATA";
  else if (high > 0 || score < 30) flag = "REVIEW";
  else if (score < 55 || medium >= 2) flag = "CAUTION";
  else flag = "CLEAR";

  out.trust = {
    flag,
    score,
    reasons,
    checks_completed: [out.uk && !out.uk.error, out.sanctions && !out.sanctions.error && !out.sanctions.skipped, out.domain && !out.domain.error, out.website && !out.website.error].filter(Boolean).length,
  };

  out.upsell = {
    multi_jurisdiction: { path: "/kyb", price: "$2.50", why: "add AU/CA/VAT/LEI + director appointment skim" },
    monitor: { path: "/uk-watch", price: "$5.00/30d", why: "webhook when officers/status/filings/PSC/charges change" },
    lite: { path: "/uk-company-lite", price: "$0.05", why: "cheap status/flags only" },
    sanctions: { path: "/sanctions", price: "$0.05", why: "screen any extra names" },
  };
  return out;
}
