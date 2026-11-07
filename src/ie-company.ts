import { UserError } from "./core";

const RESOURCE = "3fef41bc-b8f4-4b10-8434-ce51c29b1bba";
const API = "https://opendata.cro.ie/api/3/action/datastore_search";
const DATASET = "https://opendata.cro.ie/dataset/companies";
const TIMEOUT_MS = 7000;
const UA = "AgentReader/1.43 (+https://api.axiomworks.co.uk; Irish company research via CRO open data)";
const DISCLAIMER =
  "Irish company profile from the Companies Registration Office (CRO) open data snapshot (CKAN). Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm identifiers at cro.ie before onboarding, contracting, or paying. Source: official CRO open data (CC-BY-4.0). Do not use the older services.cro.ie API (that service requires a key).";

export function normalizeIeNumber(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) throw new UserError("company number must be numeric (e.g. 104547)", 400);
  if (d.length > 8) throw new UserError("company number must be at most 8 digits", 400);
  return d.replace(/^0+(?=\d)/, "");
}

function joinAddress(rec: any): string | null {
  const parts = [rec.company_address_1, rec.company_address_2, rec.company_address_3, rec.company_address_4, rec.eircode]
    .map((x) => (x == null ? "" : String(x).trim()))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function isoDate(v: any): string | null {
  if (!v) return null;
  const s = String(v);
  return s.slice(0, 10) || null;
}

function statusOf(rec: any): string {
  return String(rec.company_status || "").trim() || "unknown";
}

function redFlags(rec: any): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  const st = statusOf(rec).toLowerCase();
  if (rec.comp_dissolved_date) flags.push({ code: "dissolved", severity: "high", detail: `Dissolved on ${isoDate(rec.comp_dissolved_date)}` });
  if (st && st !== "normal" && !/normal/i.test(st)) flags.push({ code: "status", severity: "medium", detail: `CRO status is ${statusOf(rec)}` });
  return flags;
}

function shape(rec: any, lite: boolean) {
  const number = rec.company_num != null ? String(rec.company_num) : null;
  return {
    company_number: number,
    name: rec.company_name || null,
    status: statusOf(rec),
    company_type: rec.company_type || null,
    registered: isoDate(rec.company_reg_date),
    dissolved: isoDate(rec.comp_dissolved_date),
    last_annual_return: isoDate(rec.last_ar_date),
    last_accounts_date: isoDate(rec.last_accounts_date),
    address: joinAddress(rec),
    eircode: rec.eircode || null,
    red_flags: redFlags(rec),
    ...(lite ? {} : { address_lines: [rec.company_address_1, rec.company_address_2, rec.company_address_3, rec.company_address_4].filter(Boolean), nace_v2_code: rec.nace_v2_code || null, company_status_code: rec.company_status_code ?? null, company_type_code: rec.company_type_code ?? null }),
  };
}

async function ckan(params: Record<string, string>) {
  const url = `${API}?${new URLSearchParams(params)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`CRO open data HTTP ${r.status}`);
    const j: any = await r.json();
    if (!j?.success) throw new Error(j?.error?.message || "CRO open data request failed");
    return { records: (j.result?.records || []) as any[], url, total: Number(j.result?.total || 0) };
  } finally {
    clearTimeout(t);
  }
}

const UPSELL = {
  kyb: { path: "/kyb", price: "$2.50", why: "attach an Irish CRO number into one-shot KYB with VAT + LEI + sanctions" },
  registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch Irish CRO numbers with UK/EU/US-state ids (ie=)" },
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate Irish VAT via VIES (IE + number)" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
};

/** Irish company lookup via CRO CKAN open data — free official snapshot; no key. */
export async function ieCompany(input: {
  number?: string;
  company_number?: string;
  ie?: string;
  cro?: string;
  name?: string;
  q?: string;
  lite?: boolean;
  preview?: boolean;
  limit?: number;
}) {
  const lite = !!(input.lite || input.preview);
  const rawNum = String(input.number || input.company_number || input.ie || input.cro || "").trim();
  const name = String(input.name || input.q || "").trim();
  const limit = Math.min(Math.max(Number(input.limit) || (rawNum ? 1 : 5), 1), 10);

  try {
    if (rawNum) {
      const number = normalizeIeNumber(rawNum);
      const { records, url } = await ckan({
        resource_id: RESOURCE,
        filters: JSON.stringify({ company_num: Number(number) }),
        limit: "1",
      });
      if (!records.length) throw new UserError(`no Irish company found for number=${number}`, 404);
      return {
        product: "ie-company",
        price: "$0.25",
        disclaimer: DISCLAIMER,
        query: { mode: "number", number },
        ...shape(records[0], lite),
        source: "Companies Registration Office (CRO) open data",
        source_url: DATASET,
        search_url: url,
        license: "CC-BY-4.0 (CRO Ireland)",
        attribution: "Contains CRO open data licensed under CC-BY-4.0. Confirm at cro.ie before acting.",
        upsell: UPSELL,
      };
    }
    if (!name || name.length < 2) throw new UserError("provide number (CRO company number, e.g. 104547) or name", 400);
    const { records, url, total } = await ckan({ resource_id: RESOURCE, q: name, limit: String(limit) });
    if (!records.length) throw new UserError(`no Irish company found for name=${name}`, 404);
    const q = name.toLowerCase();
    const scored = records.map((rec) => {
      const n = String(rec.company_name || "").toLowerCase();
      let score = n === q ? 100 : n.startsWith(q) ? 80 : n.includes(q) ? 50 : 10;
      if (/normal/i.test(String(rec.company_status || ""))) score += 8;
      return { rec, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const primary = shape(scored[0].rec, lite);
    return {
      product: "ie-company",
      price: "$0.25",
      disclaimer: DISCLAIMER,
      query: { mode: "name", q: name },
      total_results: total || records.length,
      ...primary,
      matches: records.length > 1 ? scored.slice(0, limit).map((x) => ({ company_number: String(x.rec.company_num), name: x.rec.company_name, status: statusOf(x.rec), address: joinAddress(x.rec) })) : undefined,
      source: "Companies Registration Office (CRO) open data",
      source_url: DATASET,
      search_url: url,
      license: "CC-BY-4.0 (CRO Ireland)",
      attribution: "Contains CRO open data licensed under CC-BY-4.0. Confirm at cro.ie before acting.",
      upsell: UPSELL,
    };
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    if (e?.name === "TimeoutError" || e?.name === "AbortError" || /timeout|aborted/i.test(String(e?.message || ""))) {
      throw new UserError(`CRO open data upstream not responding within ${TIMEOUT_MS / 1000}s — retry shortly; confirm at cro.ie`, 504);
    }
    throw new Error(`Irish company lookup failed: ${e?.message || e}`);
  }
}

export function ieCompanySlim(d: any) {
  return {
    company_number: d.company_number,
    name: d.name,
    status: d.status,
    company_type: d.company_type || null,
    address: d.address || null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["address_lines", "nace_v2_code", "matches", "last_annual_return"],
  };
}
