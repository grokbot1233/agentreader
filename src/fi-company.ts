import { UserError } from "./core";

const API = "https://avoindata.prh.fi/opendata-ytj-api/v3";
const UA =
  "AgentReader/1.34 (+https://api.axiomworks.co.uk; Finnish company research via PRH YTJ open data)";
const DISCLAIMER =
  "Finnish company profile from PRH / Finnish Trade Register (YTJ open data API v3, CC BY 4.0). Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm identifiers at source before onboarding, contracting, or paying. Source: PRH (Finnish Patent and Registration Office).";

const YT_WEIGHTS = [7, 9, 10, 5, 8, 4, 2];

/** Digits only. */
function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Finnish business ID check digit (modulus-11 with weights 7,9,10,5,8,4,2). */
export function ytunnusCheckDigit(seven: string): number | null {
  if (!/^\d{7}$/.test(seven)) return null;
  const sum = YT_WEIGHTS.reduce((acc, w, i) => acc + w * Number(seven[i]), 0);
  const rem = sum % 11;
  if (rem === 0) return 0;
  if (rem === 1) return null; // invalid sequence
  return 11 - rem;
}

/**
 * Normalize Y-tunnus: accept `0112038-9`, `01120389`, spaces; format as `NNNNNNN-C`.
 * Validates check digit. Throws UserError 400 on bad length / bad check digit.
 */
export function normalizeYtunnus(raw: string): string {
  const cleaned = String(raw || "").replace(/[\s.]/g, "");
  const d = digits(cleaned);
  if (d.length !== 8) {
    throw new UserError("ytunnus/businessId must be 7 digits + check digit (e.g. 0112038-9)", 400);
  }
  const seven = d.slice(0, 7);
  const check = Number(d[7]);
  const expected = ytunnusCheckDigit(seven);
  if (expected == null || expected !== check) {
    throw new UserError(`invalid Finnish business ID check digit for ${seven}-?`, 400);
  }
  return `${seven}-${check}`;
}

function pickDesc(descriptions: any[] | undefined, preferLang = "3"): string | null {
  if (!Array.isArray(descriptions) || !descriptions.length) return null;
  const pref = descriptions.find((d) => String(d.languageCode) === preferLang);
  if (pref?.description) return String(pref.description);
  const en = descriptions.find((d) => /en|3/i.test(String(d.languageCode || "")));
  if (en?.description) return String(en.description);
  return descriptions[0]?.description ? String(descriptions[0].description) : null;
}

function pickCity(postOffices: any[] | undefined): string | null {
  if (!Array.isArray(postOffices) || !postOffices.length) return null;
  // Prefer Finnish (1) then Swedish (2) then English (3)
  for (const code of ["1", "3", "2"]) {
    const hit = postOffices.find((p) => String(p.languageCode) === code && p.city);
    if (hit) return String(hit.city);
  }
  return postOffices[0]?.city ? String(postOffices[0].city) : null;
}

function formatAddress(a: any): string | null {
  if (!a || typeof a !== "object") return null;
  const parts: string[] = [];
  if (a.co) parts.push(`c/o ${a.co}`);
  const street = [a.street, a.buildingNumber, a.entrance, a.apartmentNumber, a.apartmentIdSuffix]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (street) parts.push(street);
  if (a.postOfficeBox) parts.push(`PO Box ${a.postOfficeBox}`);
  return parts.length ? parts.join(", ") : null;
}

function currentPrimaryName(names: any[] | undefined): string | null {
  if (!Array.isArray(names)) return null;
  const current = names.filter((n) => !n.endDate && String(n.type) === "1");
  if (current.length) return String(current[0].name || "") || null;
  const anyCurrent = names.find((n) => !n.endDate && n.name);
  if (anyCurrent) return String(anyCurrent.name);
  return names[0]?.name ? String(names[0].name) : null;
}

function mapNames(names: any[] | undefined, lite = false) {
  if (!Array.isArray(names)) return [];
  const typeLabel = (t: any) =>
    String(t) === "1" ? "company" : String(t) === "2" ? "parallel" : String(t) === "3" ? "auxiliary" : String(t);
  const mapped = names.map((n) => ({
    name: n.name || null,
    type: typeLabel(n.type),
    type_code: n.type != null ? String(n.type) : null,
    registration_date: n.registrationDate || null,
    end_date: n.endDate || null,
    current: !n.endDate,
  }));
  return lite ? mapped.filter((n) => n.current).slice(0, 5) : mapped;
}

function mapCompanyForm(forms: any[] | undefined) {
  if (!Array.isArray(forms) || !forms.length) return null;
  const current = forms.find((f) => !f.endDate) || forms[0];
  return {
    code: current.type != null ? String(current.type) : null,
    description_en: pickDesc(current.descriptions, "3"),
    description_fi: pickDesc(current.descriptions, "1"),
    registration_date: current.registrationDate || null,
  };
}

function mapMainBusinessLine(mbl: any) {
  if (!mbl || typeof mbl !== "object") return null;
  return {
    code: mbl.type != null ? String(mbl.type) : null,
    description_en: pickDesc(mbl.descriptions, "3"),
    description_fi: pickDesc(mbl.descriptions, "1"),
    registration_date: mbl.registrationDate || null,
  };
}

function mapRegisteredEntries(entries: any[] | undefined, lite = false) {
  if (!Array.isArray(entries)) return [];
  const mapped = entries.map((e) => ({
    type: e.type != null ? String(e.type) : null,
    description_en: pickDesc(e.descriptions, "3"),
    description_fi: pickDesc(e.descriptions, "1"),
    registration_date: e.registrationDate || null,
    register: e.register != null ? String(e.register) : null,
    authority: e.authority != null ? String(e.authority) : null,
    end_date: e.endDate || null,
  }));
  return lite ? mapped.slice(0, 5) : mapped;
}

function mapSituations(sits: any[] | undefined) {
  if (!Array.isArray(sits)) return [];
  return sits.map((s) => ({
    type: s.type != null ? String(s.type) : null,
    description_en: pickDesc(s.descriptions, "3"),
    description_fi: pickDesc(s.descriptions, "1"),
    registration_date: s.registrationDate || null,
    end_date: s.endDate || null,
  }));
}

/** PRH company status codes (simplified). */
function statusLabel(r: any): string {
  const code = String(r.status ?? "");
  // 1 = unregistered, 2 = registered/active (common for live companies)
  if (code === "2") return "registered";
  if (code === "1") return "unregistered";
  if (code) return `status_${code}`;
  return "unknown";
}

function redFlags(r: any, situations: ReturnType<typeof mapSituations>): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  const st = statusLabel(r);
  if (st === "unregistered") {
    flags.push({ code: "unregistered", severity: "high", detail: "PRH company status unregistered" });
  }
  for (const s of situations) {
    if (s.end_date) continue;
    const blob = `${s.description_en || ""} ${s.description_fi || ""} ${s.type || ""}`.toLowerCase();
    if (/bankrupt|konkurssi|konkurs/.test(blob)) {
      flags.push({ code: "bankrupt", severity: "high", detail: s.description_en || s.description_fi || "Bankruptcy situation" });
    } else if (/liquidat|selvitystil|upplösning|dissolv/.test(blob)) {
      flags.push({ code: "liquidation", severity: "high", detail: s.description_en || s.description_fi || "Liquidation/dissolution situation" });
    } else if (/restructur|yrityssaneeraus|sanering/.test(blob)) {
      flags.push({ code: "restructuring", severity: "high", detail: s.description_en || s.description_fi || "Restructuring situation" });
    } else if (s.description_en || s.description_fi) {
      flags.push({
        code: "company_situation",
        severity: "medium",
        detail: s.description_en || s.description_fi || `situation type ${s.type}`,
      });
    }
  }
  const addrs = Array.isArray(r.addresses) ? r.addresses : [];
  const hasStreet = addrs.some((a: any) => a && (a.street || a.postCode || a.postOfficeBox));
  if (!hasStreet) {
    flags.push({ code: "missing_address", severity: "medium", detail: "No street/PO Box address on file" });
  }
  return flags;
}

function pickPostalAddress(addresses: any[] | undefined) {
  if (!Array.isArray(addresses) || !addresses.length) return { address: null, city: null, postcode: null, type: null };
  // type 1 = visiting / street, type 2 = postal
  const street = addresses.find((a) => Number(a.type) === 1) || addresses[0];
  return {
    address: formatAddress(street),
    city: pickCity(street?.postOffices),
    postcode: street?.postCode || null,
    type: street?.type != null ? Number(street.type) : null,
  };
}

function slimRecord(r: any, lite = false) {
  const names = mapNames(r.names, lite);
  const situations = mapSituations(r.companySituations);
  const addr = pickPostalAddress(r.addresses);
  const form = mapCompanyForm(r.companyForms);
  const mbl = mapMainBusinessLine(r.mainBusinessLine);
  const entries = mapRegisteredEntries(r.registeredEntries, lite);
  const out: any = {
    business_id: r.businessId?.value || null,
    name: currentPrimaryName(r.names),
    status: statusLabel(r),
    status_code: r.status != null ? String(r.status) : null,
    trade_register_status: r.tradeRegisterStatus != null ? String(r.tradeRegisterStatus) : null,
    company_form: form,
    address: addr.address,
    city: addr.city,
    postcode: addr.postcode,
    country: "FI",
    main_business_line: mbl,
    website: r.website?.url || null,
    eu_id: r.euId?.value || null,
    registration_date: r.registrationDate || r.businessId?.registrationDate || null,
    last_modified: r.lastModified || null,
    registered_entries: entries,
    company_situations: lite ? situations.slice(0, 3) : situations,
    names,
    red_flags: redFlags(r, situations),
  };
  if (lite) {
    out.preview_omitted = ["full names history", "full registered_entries", "full company_situations"];
  }
  return out;
}

function nameScore(company: any, q: string): number {
  const qn = q.trim().toLowerCase();
  const names = Array.isArray(company.names) ? company.names : [];
  let best = 0;
  for (const n of names) {
    if (n.endDate) continue;
    const nm = String(n.name || "").toLowerCase();
    if (!nm) continue;
    if (nm === qn) best = Math.max(best, 100);
    else if (nm.startsWith(qn)) best = Math.max(best, 80);
    else if (nm.includes(qn)) best = Math.max(best, String(n.type) === "1" ? 60 : 40);
  }
  return best;
}

function pickQuery(input: {
  ytunnus?: string;
  businessId?: string;
  fi?: string;
  number?: string;
  name?: string;
  q?: string;
}): { q: string; mode: "id" | "name" } {
  const rawId = String(input.ytunnus || input.businessId || input.fi || input.number || "").trim();
  const name = String(input.name || input.q || "").trim();
  if (rawId) {
    return { q: normalizeYtunnus(rawId), mode: "id" };
  }
  if (name) {
    if (name.length < 2) throw new UserError("name too short", 400);
    return { q: name, mode: "name" };
  }
  throw new UserError("provide ytunnus (or businessId/fi) or name", 400);
}

/** Finnish company lookup via PRH YTJ open data (no key, CC BY 4.0). */
export async function fiCompany(input: {
  ytunnus?: string;
  businessId?: string;
  fi?: string;
  number?: string;
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
    if (mode === "id") {
      url = `${API}/companies?businessId=${encodeURIComponent(q)}`;
      const r = await fetch(url, {
        headers: { accept: "application/json", "user-agent": UA },
        signal: AbortSignal.timeout(12000),
      });
      if (r.status === 404) throw new UserError(`no Finnish company found for businessId=${q}`, 404);
      if (r.status === 429) throw new UserError("PRH YTJ API rate limited — retry shortly", 429);
      if (!r.ok) throw new Error(`prh ytj http ${r.status}`);
      data = await r.json();
      const companies = Array.isArray(data?.companies) ? data.companies : [];
      if (!companies.length) throw new UserError(`no Finnish company found for businessId=${q}`, 404);
      const primary = slimRecord(companies[0], lite);
      return {
        product: "fi-company",
        price: "$0.25",
        disclaimer: DISCLAIMER,
        query: { mode, q },
        total_results: data.totalResults ?? 1,
        ...primary,
        source: "PRH / Finnish Trade Register (YTJ open data, CC BY 4.0)",
        source_url: url,
        attribution: "Contains data from the Finnish Patent and Registration Office (PRH). Licensed under CC BY 4.0. Confirm at ytj.fi / prh.fi before acting.",
        upsell: {
          kyb: { path: "/kyb", price: "$2.50", why: "attach FI Y-tunnus into one-shot KYB with VAT + LEI + sanctions" },
          registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch FI Y-tunnukset with UK/AU/CA/FR/NO/DK ids" },
          sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
          eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate FI VAT via VIES" },
        },
      };
    }

    url = `${API}/companies?name=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (r.status === 429) throw new UserError("PRH YTJ API rate limited — retry shortly", 429);
    if (!r.ok) throw new Error(`prh ytj search http ${r.status}`);
    data = await r.json();
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    throw new Error(`Finnish company lookup failed: ${e?.message || e}`);
  }

  const results = Array.isArray(data?.companies) ? data.companies : [];
  if (!results.length) {
    throw new UserError(`no Finnish company found for name=${q}`, 404);
  }

  const ranked = [...results].sort((a, b) => nameScore(b, q) - nameScore(a, q));
  const chosen = ranked[0];
  const primary = slimRecord(chosen, lite);
  const matches = ranked.slice(0, limit).map((c: any) => ({
    business_id: c.businessId?.value || null,
    name: currentPrimaryName(c.names),
    status: statusLabel(c),
    city: pickPostalAddress(c.addresses).city,
    company_form: mapCompanyForm(c.companyForms)?.description_en || null,
  }));

  return {
    product: "fi-company",
    price: "$0.25",
    disclaimer: DISCLAIMER,
    query: { mode, q },
    total_results: data.totalResults ?? results.length,
    ...primary,
    matches,
    source: "PRH / Finnish Trade Register (YTJ open data, CC BY 4.0)",
    source_url: url!,
    attribution: "Contains data from the Finnish Patent and Registration Office (PRH). Licensed under CC BY 4.0. Confirm at ytj.fi / prh.fi before acting.",
    upsell: {
      kyb: { path: "/kyb", price: "$2.50", why: "attach FI Y-tunnus into one-shot KYB with VAT + LEI + sanctions" },
      registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch FI Y-tunnukset with UK/AU/CA/FR/NO/DK ids" },
      sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
      eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate FI VAT via VIES" },
    },
  };
}

export function fiCompanySlim(d: any) {
  return {
    business_id: d.business_id,
    name: d.name,
    status: d.status,
    city: d.city || null,
    company_form: d.company_form?.description_en || d.company_form || null,
    main_business_line: d.main_business_line
      ? { code: d.main_business_line.code, description_en: d.main_business_line.description_en }
      : null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["names history", "registered_entries detail", "company_situations detail", "matches"],
  };
}
