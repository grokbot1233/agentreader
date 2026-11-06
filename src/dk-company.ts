import { UserError } from "./core";

const API = "https://apicvr.dk/api/v1";
const UA =
  "AgentReader/1.0 (+https://api.axiomworks.co.uk; Danish company research via apicvr.dk / Erhvervsstyrelsen CVR)";
const DISCLAIMER =
  "Danish company profile from CVR (Erhvervsstyrelsen) via apicvr.dk open proxy. Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm identifiers at source before onboarding, contracting, or paying. Fair-use of apicvr.dk.";

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Normalize CVR: strip spaces/dashes and optional DK prefix → 8 digits. */
function normalizeCvr(raw: string): string {
  let cleaned = String(raw || "").replace(/[\s\-.]/g, "").toUpperCase();
  if (cleaned.startsWith("DK")) cleaned = cleaned.slice(2);
  return digits(cleaned);
}

function pickQuery(input: {
  cvr?: string;
  number?: string;
  vat?: string;
  name?: string;
  q?: string;
}): { q: string; mode: "cvr" | "name" } {
  const cvr = normalizeCvr(String(input.cvr || input.number || input.vat || ""));
  const name = String(input.name || input.q || "").trim();
  if (cvr) {
    if (cvr.length !== 8) throw new UserError("cvr must be exactly 8 digits (optional DK prefix)", 400);
    return { q: cvr, mode: "cvr" };
  }
  if (name) {
    if (name.length < 2) throw new UserError("name too short", 400);
    return { q: name, mode: "name" };
  }
  throw new UserError("provide cvr (or number/vat) or name", 400);
}

function mapPerson(p: any) {
  if (!p || typeof p !== "object") return null;
  return {
    name: p.name || null,
    role: p.role || null,
    type: p.type || null,
    cvr: p.cvr != null ? String(p.cvr) : null,
    address: p.address || null,
    zipcode: p.zipcode ?? null,
    city: p.city || null,
    country: p.country || null,
    ownership_percent: p.ownership_percent ?? null,
    ownership_range: p.ownership_range || null,
    voting_rights_percent: p.voting_rights_percent ?? null,
    voting_rights_range: p.voting_rights_range || null,
    startdate: p.startdate || null,
  };
}

function redFlags(r: any): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  if (r.bankrupt === true) {
    flags.push({ code: "bankrupt", severity: "high", detail: "Marked bankrupt in CVR" });
  }
  const st = String(r.status || "");
  if (/ophørt|ophort|ceased|opløst|oplost|tvangsopløst/i.test(st) || r.enddate) {
    flags.push({
      code: "ceased",
      severity: "high",
      detail: `Status ${st || "unknown"}${r.enddate ? `; enddate ${r.enddate}` : ""}`,
    });
  }
  if (r.protected === true) {
    flags.push({
      code: "protected",
      severity: "medium",
      detail: "Marketing protection / protected contact data on file (hemmelig adresse/kontakt)",
    });
  }
  const hasAddr = !!(r.address || r.zipcode || r.city);
  if (!hasAddr) {
    flags.push({ code: "missing_address", severity: "medium", detail: "No street address/zip/city on file" });
  }
  return flags;
}

function slimRecord(r: any, lite = false) {
  const direktion = Array.isArray(r.direktion) ? r.direktion.map(mapPerson).filter(Boolean) : [];
  const ejere = Array.isArray(r.ejere) ? r.ejere.map(mapPerson).filter(Boolean) : [];
  const fuldt = Array.isArray(r.fuldt_ansvarlige) ? r.fuldt_ansvarlige.map(mapPerson).filter(Boolean) : [];
  const out: any = {
    cvr: r.vat != null ? String(r.vat) : null,
    name: r.name || null,
    status: r.status || null,
    company_type: r.companydesc || null,
    company_type_short: r.companytypeshort || null,
    company_code: r.companycode ?? null,
    address: r.address || null,
    zipcode: r.zipcode ?? null,
    city: r.city || r.cityname || null,
    addressco: r.addressco || null,
    industry_code: r.industrycode != null ? String(r.industrycode) : null,
    industry_desc: r.industrydesc || null,
    employees: r.employees ?? null,
    startdate: r.startdate || null,
    enddate: r.enddate || null,
    bankrupt: !!r.bankrupt,
    protected: !!r.protected,
    phone: lite ? undefined : r.phone || null,
    email: lite ? undefined : r.email || null,
    website: lite ? undefined : r.website || null,
    direktion: lite ? direktion.slice(0, 2) : direktion,
    ejere: lite ? ejere.slice(0, 2) : ejere,
    fuldt_ansvarlige: lite ? fuldt.slice(0, 2) : fuldt,
    directors_count: direktion.length,
    owners_count: ejere.length,
    red_flags: redFlags(r),
  };
  if (lite) out.preview_omitted = ["full direktion/ejere/fuldt_ansvarlige", "p_units", "fax", "phone/email/website"];
  return out;
}

/** Danish company lookup via apicvr.dk (proxies Erhvervsstyrelsen CVR; free, no key). */
export async function dkCompany(input: {
  cvr?: string;
  number?: string;
  vat?: string;
  name?: string;
  q?: string;
  lite?: boolean;
  limit?: number;
}) {
  const { q, mode } = pickQuery(input);
  const lite = !!input.lite;
  const limit = Math.min(Math.max(Number(input.limit) || (mode === "name" ? 5 : 1), 1), 10);

  let url: string;
  let data: any;
  try {
    if (mode === "cvr") {
      url = `${API}/${q}`;
      const r = await fetch(url, {
        headers: { accept: "application/json", "user-agent": UA },
        signal: AbortSignal.timeout(12000),
      });
      if (r.status === 404) throw new UserError(`no Danish company found for cvr=${q}`, 404);
      if (r.status === 429) throw new UserError("Danish CVR API rate limited — retry shortly", 429);
      if (!r.ok) throw new Error(`apicvr http ${r.status}`);
      data = await r.json();
      if (!data || (data.vat == null && !data.name)) {
        throw new UserError(`no Danish company found for cvr=${q}`, 404);
      }
      const primary = slimRecord(data, lite);
      return {
        product: "dk-company",
        price: "$0.25",
        disclaimer: DISCLAIMER,
        query: { mode, q },
        total_results: 1,
        ...primary,
        source: "Danish CVR via apicvr.dk / Erhvervsstyrelsen",
        source_url: url,
        attribution: "Contains CVR data from Erhvervsstyrelsen via apicvr.dk. Confirm at virk.dk / cvr.dk before acting.",
        upsell: {
          kyb: { path: "/kyb", price: "$2.50", why: "attach DK CVR into one-shot KYB with VAT + LEI + sanctions" },
          registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch DK CVRs with UK/AU/CA/FR/NO ids" },
          sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
          eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate DK VAT via VIES" },
        },
      };
    }

    url = `${API}/search?name=${encodeURIComponent(q)}&limit=${limit}`;
    const r = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (r.status === 429) throw new UserError("Danish CVR API rate limited — retry shortly", 429);
    if (!r.ok) throw new Error(`apicvr search http ${r.status}`);
    data = await r.json();
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    throw new Error(`Danish company lookup failed: ${e?.message || e}`);
  }

  const results = Array.isArray(data) ? data : [];
  if (!results.length) {
    throw new UserError(`no Danish company found for name=${q}`, 404);
  }

  const chosen = results[0];
  const primary = slimRecord(chosen, lite);
  const matches = results.slice(0, limit).map((r: any) => ({
    cvr: r.vat != null ? String(r.vat) : null,
    name: r.name,
    status: r.status || null,
    city: r.city || r.cityname || null,
    company_type_short: r.companytypeshort || null,
  }));

  return {
    product: "dk-company",
    price: "$0.25",
    disclaimer: DISCLAIMER,
    query: { mode, q },
    total_results: results.length,
    ...primary,
    matches,
    source: "Danish CVR via apicvr.dk / Erhvervsstyrelsen",
    source_url: url!,
    attribution: "Contains CVR data from Erhvervsstyrelsen via apicvr.dk. Confirm at virk.dk / cvr.dk before acting.",
    upsell: {
      kyb: { path: "/kyb", price: "$2.50", why: "attach DK CVR into one-shot KYB with VAT + LEI + sanctions" },
      registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch DK CVRs with UK/AU/CA/FR/NO ids" },
      sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
      eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate DK VAT via VIES" },
    },
  };
}

export function dkCompanySlim(d: any) {
  return {
    cvr: d.cvr,
    name: d.name,
    status: d.status,
    city: d.city || null,
    company_type_short: d.company_type_short || null,
    employees: d.employees ?? null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["direktion detail", "ejere", "fuldt_ansvarlige", "p_units", "matches", "phone/email"],
  };
}
