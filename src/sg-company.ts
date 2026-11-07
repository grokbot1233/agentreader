import { UserError } from "./core";

const RESOURCE = "d_3f960c10fed6145404ca7b821f263b87";
const API = "https://data.gov.sg/api/action/datastore_search";
const DATASET = "https://data.gov.sg/datasets/d_3f960c10fed6145404ca7b821f263b87/view";
const TIMEOUT_MS = 8000;
const UA = "AgentReader/1.45 (+https://api.axiomworks.co.uk; Singapore company research via data.gov.sg ACRA open data)";
const LICENSE = "Singapore Open Data Licence v1.0";
const ATTRIBUTION = "Contains information from Entities with UEN (ACRA) accessed from data.gov.sg, made available under the terms of the Singapore Open Data Licence version 1.0. Confirm at bizfile.gov.sg before acting.";
const DISCLAIMER =
  "Singapore entity profile from ACRA's 'Entities with UEN' open dataset on data.gov.sg (CKAN datastore). Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm the UEN and status at bizfile.gov.sg before onboarding, contracting, or paying. Source: official data.gov.sg (Singapore Open Data Licence v1.0).";

/** UEN: 9-10 alphanumeric chars (e.g. 196800306E, 53123456X, T08LL1234A). Uppercase, spaces/dashes stripped. */
export function normalizeSgUen(raw: string): string {
  const u = String(raw || "").toUpperCase().replace(/[\s\-.]/g, "");
  if (!u) throw new UserError("uen is required (e.g. 196800306E)", 400);
  if (!/^[0-9A-Z]{9,10}$/.test(u) || !/[A-Z]$/.test(u) || !/\d/.test(u)) throw new UserError("uen must be 9-10 alphanumeric characters ending in a letter (e.g. 196800306E, 53123456X, T08LL1234A)", 400);
  return u;
}

function isoDate(v: any): string | null {
  if (!v) return null;
  return String(v).slice(0, 10) || null;
}

function statusOf(rec: any): string {
  return String(rec.uen_status_desc || "").trim() || "unknown";
}

function isLive(rec: any): boolean {
  return /^(registered|live|live company)$/i.test(statusOf(rec));
}

function address(rec: any): string | null {
  const parts = [rec.reg_street_name, rec.reg_postal_code ? `Singapore ${rec.reg_postal_code}` : ""].map((x) => (x == null ? "" : String(x).trim())).filter((x) => x && x.toLowerCase() !== "na");
  return parts.length ? parts.join(", ") : null;
}

function redFlags(rec: any): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  const st = statusOf(rec);
  if (!isLive(rec)) {
    const high = /deregistered|struck|cancel|wound|dissolv|terminat|ceased|expired|revoked/i.test(st);
    flags.push({ code: "status", severity: high ? "high" : "medium", detail: `ACRA UEN status is ${st}` });
  }
  return flags;
}

function shape(rec: any, lite: boolean) {
  return {
    uen: rec.uen ? String(rec.uen) : null,
    name: rec.entity_name || null,
    status: statusOf(rec),
    entity_type: rec.entity_type_desc || null,
    registered: isoDate(rec.uen_issue_date),
    address: address(rec),
    postal_code: rec.reg_postal_code || null,
    red_flags: redFlags(rec),
    ...(lite ? {} : { street_name: rec.reg_street_name || null, issuance_agency: rec.issuance_agency_desc || null }),
  };
}

async function ckan(params: Record<string, string>) {
  const url = `${API}?${new URLSearchParams(params)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctrl.signal });
    if (r.status === 429) throw new UserError("data.gov.sg rate limit reached (HTTP 429) — retry in a few seconds; confirm at bizfile.gov.sg", 503);
    if (r.status === 400 || r.status === 409) throw new UserError("data.gov.sg rejected the query — use a UEN (e.g. 196800306E) or a plain-text name", 400);
    if (!r.ok) throw new Error(`data.gov.sg HTTP ${r.status}`);
    const j: any = await r.json();
    if (!j?.success) throw new Error(j?.error?.message || "data.gov.sg request failed");
    return { records: (j.result?.records || []) as any[], url, total: Number(j.result?.total || 0) };
  } finally {
    clearTimeout(t);
  }
}

const UPSELL = {
  kyb: { path: "/kyb", price: "$2.50", why: "attach a Singapore UEN into one-shot KYB with LEI + sanctions + website (sg=)" },
  registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch Singapore UENs with UK/EU/US-state ids (sg=)" },
  lei: { path: "/lei", price: "$0.01", why: "check the entity's GLEIF LEI" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
};

/** Singapore entity lookup via ACRA 'Entities with UEN' on data.gov.sg — free official open data; no key. */
export async function sgCompany(input: {
  uen?: string;
  sg?: string;
  number?: string;
  company_number?: string;
  name?: string;
  q?: string;
  lite?: boolean;
  preview?: boolean;
  limit?: number;
}) {
  const lite = !!(input.lite || input.preview);
  const rawUen = String(input.uen || input.sg || input.number || input.company_number || "").trim();
  const name = String(input.name || input.q || "").trim();
  const limit = Math.min(Math.max(Number(input.limit) || (rawUen ? 1 : 5), 1), 10);
  const common = {
    source: "ACRA Entities with UEN (data.gov.sg)",
    source_url: DATASET,
    license: LICENSE,
    attribution: ATTRIBUTION,
    upsell: UPSELL,
  };

  try {
    if (rawUen) {
      const uen = normalizeSgUen(rawUen);
      const { records, url } = await ckan({ resource_id: RESOURCE, filters: JSON.stringify({ uen }), limit: "1" });
      if (!records.length) throw new UserError(`no Singapore entity found for uen=${uen}`, 404);
      return {
        product: "sg-company",
        price: "$0.25",
        disclaimer: DISCLAIMER,
        query: { mode: "uen", uen },
        ...shape(records[0], lite),
        search_url: url,
        ...common,
      };
    }
    if (!name || name.length < 2) throw new UserError("provide uen (Singapore UEN, e.g. 196800306E) or name", 400);
    // Exact (case-normalised) legal-name match first; fall back to full-text search with punctuation stripped (data.gov.sg rejects q with symbols).
    let res = await ckan({ resource_id: RESOURCE, filters: JSON.stringify({ entity_name: name.toUpperCase() }), limit: String(Math.max(limit, 5)) });
    if (!res.records.some(isLive)) {
      const qText = name.replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
      if (qText.length < 2) throw new UserError("name must contain letters or digits", 400);
      const fts = await ckan({ resource_id: RESOURCE, q: qText, limit: String(Math.max(limit, 10)) });
      const seen = new Set(res.records.map((r) => r.uen));
      res = { records: [...res.records, ...fts.records.filter((r) => !seen.has(r.uen))], url: res.records.length ? res.url : fts.url, total: res.records.length + fts.total };
    }
    const { records, url, total } = res;
    if (!records.length) throw new UserError(`no Singapore entity found for name=${name}`, 404);
    const q = name.toLowerCase().replace(/[.,]/g, "").trim();
    const scored = records.map((rec) => {
      const n = String(rec.entity_name || "").toLowerCase().replace(/[.,]/g, "").trim();
      let score = n === q ? 100 : n.startsWith(q) ? 80 : n.includes(q) ? 50 : 10;
      if (isLive(rec)) score += 8;
      return { rec, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const primary = shape(scored[0].rec, lite);
    return {
      product: "sg-company",
      price: "$0.25",
      disclaimer: DISCLAIMER,
      query: { mode: "name", q: name },
      total_results: total || records.length,
      ...primary,
      matches: records.length > 1 ? scored.slice(0, limit).map((x) => ({ uen: String(x.rec.uen), name: x.rec.entity_name, status: statusOf(x.rec), entity_type: x.rec.entity_type_desc || null, address: address(x.rec) })) : undefined,
      search_url: url,
      ...common,
    };
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    if (e?.name === "TimeoutError" || e?.name === "AbortError" || /timeout|aborted/i.test(String(e?.message || ""))) {
      throw new UserError(`data.gov.sg upstream not responding within ${TIMEOUT_MS / 1000}s — retry shortly; confirm at bizfile.gov.sg`, 504);
    }
    throw new Error(`Singapore company lookup failed: ${e?.message || e}`);
  }
}

export function sgCompanySlim(d: any) {
  return {
    uen: d.uen,
    name: d.name,
    status: d.status,
    entity_type: d.entity_type || null,
    registered: d.registered || null,
    address: d.address || null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["street_name", "issuance_agency", "matches"],
  };
}
