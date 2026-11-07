import { UserError } from "./core";

const RESOURCE = "25e80bf3-f107-4ab4-89ef-251b5b9374e9";
const API = "https://data.gov.lv/dati/api/3/action/datastore_search";
const DATASET = "https://data.gov.lv/dati/eng/dataset/uz/resource/25e80bf3-f107-4ab4-89ef-251b5b9374e9";
const TIMEOUT_MS = 15000;
const UA = "AgentReader/1.43 (+https://api.axiomworks.co.uk; Latvian company research via data.gov.lv)";
const DISCLAIMER =
  "Latvian company profile from the official Register of Enterprises open dataset on data.gov.lv (CKAN). Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm identifiers at ur.gov.lv before onboarding, contracting, or paying. Source: official open data (CC0-1.0).";

export function normalizeLvRegcode(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(d)) throw new UserError("registration number must be 11 digits (e.g. 40003229495)", 400);
  return d;
}

function isoDate(v: any): string | null {
  if (!v) return null;
  return String(v).slice(0, 10) || null;
}

function isTerminated(rec: any): boolean {
  const t = rec.terminated;
  if (t == null || t === "" || t === "null") return false;
  return true;
}

function redFlags(rec: any): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  if (isTerminated(rec)) flags.push({ code: "terminated", severity: "high", detail: `Terminated on ${isoDate(rec.terminated)}` });
  if (String(rec.closed || "").trim()) flags.push({ code: "closed", severity: "medium", detail: `Closed flag: ${String(rec.closed).trim()}` });
  return flags;
}

function shape(rec: any) {
  return {
    registration_number: rec.regcode != null ? String(rec.regcode) : null,
    name: rec.name || null,
    status: isTerminated(rec) ? "terminated" : "active",
    legal_form: rec.type_text || rec.type || null,
    legal_form_code: rec.type || null,
    register: rec.regtype_text || rec.regtype || null,
    registered: isoDate(rec.registered),
    terminated: isoDate(rec.terminated),
    address: rec.address || null,
    sepa: rec.sepa || null,
    red_flags: redFlags(rec),
  };
}

async function ckan(params: Record<string, string>) {
  const url = `${API}?${new URLSearchParams(params)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`Latvia open data HTTP ${r.status}`);
    const j: any = await r.json();
    if (!j?.success) throw new Error(j?.error?.message || "Latvia open data request failed");
    return { records: (j.result?.records || []) as any[], url, total: Number(j.result?.total || 0) };
  } finally {
    clearTimeout(t);
  }
}

const UPSELL = {
  kyb: { path: "/kyb", price: "$2.50", why: "attach a Latvian registration number into one-shot KYB with VAT + LEI + sanctions" },
  registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch Latvian registration numbers with UK/EU/US-state ids (lv=)" },
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate Latvian VAT via VIES" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
};

/** Latvian company lookup via data.gov.lv CKAN — free official snapshot; CC0; no key. */
export async function lvCompany(input: {
  registration_number?: string;
  regcode?: string;
  lv?: string;
  number?: string;
  name?: string;
  q?: string;
  lite?: boolean;
  preview?: boolean;
  limit?: number;
}) {
  const lite = !!(input.lite || input.preview);
  const rawNum = String(input.registration_number || input.regcode || input.lv || input.number || "").trim();
  const name = String(input.name || input.q || "").trim();
  const limit = Math.min(Math.max(Number(input.limit) || (rawNum ? 1 : 5), 1), 10);

  try {
    if (rawNum) {
      const registration_number = normalizeLvRegcode(rawNum);
      const { records, url } = await ckan({
        resource_id: RESOURCE,
        filters: JSON.stringify({ regcode: registration_number }),
        limit: "1",
      });
      if (!records.length) throw new UserError(`no Latvian company found for registration_number=${registration_number}`, 404);
      return {
        product: "lv-company",
        price: "$0.25",
        disclaimer: DISCLAIMER,
        query: { mode: "registration_number", registration_number },
        ...shape(records[0]),
        source: "Register of Enterprises of the Republic of Latvia (open data on data.gov.lv)",
        source_url: DATASET,
        search_url: url,
        license: "CC0-1.0",
        attribution: "Contains Latvian Register of Enterprises open data (CC0-1.0). Confirm at ur.gov.lv before acting.",
        upsell: UPSELL,
      };
    }
    if (!name || name.length < 2) throw new UserError("provide registration_number (11 digits, e.g. 40003229495) or name", 400);
    const { records, url, total } = await ckan({ resource_id: RESOURCE, q: name, limit: String(limit) });
    if (!records.length) throw new UserError(`no Latvian company found for name=${name}`, 404);
    const q = name.toLowerCase();
    const scored = records.map((rec) => {
      const n = String(rec.name || "").toLowerCase();
      let score = n === q ? 100 : n.includes(q) ? 60 : 10;
      if (!isTerminated(rec)) score += 8;
      return { rec, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return {
      product: "lv-company",
      price: "$0.25",
      disclaimer: DISCLAIMER,
      query: { mode: "name", q: name },
      total_results: total || records.length,
      ...shape(scored[0].rec),
      matches: records.length > 1 ? scored.slice(0, limit).map((x) => ({ registration_number: String(x.rec.regcode), name: x.rec.name, status: isTerminated(x.rec) ? "terminated" : "active", address: x.rec.address || null })) : undefined,
      source: "Register of Enterprises of the Republic of Latvia (open data on data.gov.lv)",
      source_url: DATASET,
      search_url: url,
      license: "CC0-1.0",
      attribution: "Contains Latvian Register of Enterprises open data (CC0-1.0). Confirm at ur.gov.lv before acting.",
      upsell: UPSELL,
    };
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    if (e?.name === "TimeoutError" || e?.name === "AbortError" || /timeout|aborted/i.test(String(e?.message || ""))) {
      throw new UserError(`Latvia open data upstream not responding within ${TIMEOUT_MS / 1000}s — retry shortly; confirm at ur.gov.lv`, 504);
    }
    throw new Error(`Latvian company lookup failed: ${e?.message || e}`);
  }
}

export function lvCompanySlim(d: any) {
  return {
    registration_number: d.registration_number,
    name: d.name,
    status: d.status,
    legal_form: d.legal_form || null,
    address: d.address || null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["sepa", "matches", "register"],
  };
}
