import { UserError } from "./core";
import { formatUid } from "./ch-uid";

const API = "https://www.zefix.admin.ch/ZefixREST/api/v1";
const UA =
  "AgentReader/1.35 (+https://api.axiomworks.co.uk; Swiss company research via Zefix central business name index)";
const DISCLAIMER =
  "Swiss company profile from Zefix (central business name index / UID register, Federal Office of Justice). Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm identifiers and cantonal excerpt at source before onboarding, contracting, or paying. Source: Zefix REST API (admin.ch).";

/** Common Zefix legalFormId → EN short labels (static; avoids extra API hop). */
const LEGAL_FORMS: Record<number, { en: string; de: string; short_en: string }> = {
  0: { en: "(unknown)", de: "(unbekannt)", short_en: "-" },
  1: { en: "Sole proprietorship", de: "Einzelunternehmen", short_en: "SP" },
  2: { en: "General Partnership", de: "Kollektivgesellschaft", short_en: "GP" },
  3: { en: "Corporation (AG/SA)", de: "Aktiengesellschaft", short_en: "Ltd" },
  4: { en: "Limited Liability Company (GmbH/Sàrl)", de: "Gesellschaft mit beschränkter Haftung", short_en: "LLC" },
  5: { en: "Cooperative", de: "Genossenschaft", short_en: "Coop" },
  6: { en: "Association", de: "Verein", short_en: "Asso" },
  7: { en: "Foundation", de: "Stiftung", short_en: "Found" },
  8: { en: "Public sector institution", de: "Institut des öffentlichen Rechts", short_en: "PSI" },
  9: { en: "Branch", de: "Zweigniederlassung", short_en: "Bran" },
  10: { en: "Limited Partnership", de: "Kommanditgesellschaft", short_en: "LP" },
  11: { en: "Foreign branch", de: "Zweigniederlassung einer ausl. Gesellschaft", short_en: "FB" },
  12: { en: "Corporation with unlimited partners", de: "Kommanditaktiengesellschaft", short_en: "CUP" },
  13: { en: "Special legal form", de: "Besondere Rechtsform", short_en: "SPEC" },
  14: { en: "Ownership in undivided shares", de: "Gemeinderschaft", short_en: "OUS" },
  15: { en: "SICAF", de: "Investmentgesellschaft mit festem Kapital", short_en: "SICAF" },
  16: { en: "SICAV", de: "Investmentgesellschaft mit variablem Kapital", short_en: "SICAV" },
  17: { en: "Limited Partnership for collective investment", de: "Kommanditgesellschaft für kollektive Kapitalanlagen", short_en: "LPCI" },
  18: { en: "Non commercial power of attorney", de: "Nichtkaufmännische Prokura", short_en: "PNC" },
};

const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4];

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Normalize Swiss UID → 9 digits; validates mod-11 check digit. */
export function normalizeUid(raw: string): string {
  let cleaned = String(raw || "").replace(/\s+/g, "").toUpperCase();
  for (const suf of ["MWST", "TVA", "IVA", "VAT"]) {
    if (cleaned.endsWith(suf)) cleaned = cleaned.slice(0, -suf.length);
  }
  if (cleaned.startsWith("CHE-") || cleaned.startsWith("CHE.")) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith("CHE")) cleaned = cleaned.slice(3);
  const uid = digits(cleaned);
  if (uid.length !== 9) {
    throw new UserError("uid must be exactly 9 digits after optional CHE- prefix (e.g. CHE-105.909.036)", 400);
  }
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += (uid.charCodeAt(i) - 48) * WEIGHTS[i];
  const rem = sum % 11;
  const rawCheck = (11 - rem) % 11;
  if (rawCheck === 10 || uid[8] !== String(rawCheck)) {
    throw new UserError(`invalid Swiss UID check digit for ${formatUid(uid.slice(0, 8))}?`, 400);
  }
  return uid;
}

function statusLabel(status: string | null | undefined, deleteDate: string | null | undefined): string {
  const st = String(status || "").toUpperCase();
  if (deleteDate) return "deleted";
  if (st === "EXISTIEREND" || st === "EXISTING") return "existing";
  if (/GEL[OÖ]SCHT|DELETED|RADIERT|STRUCK/i.test(st)) return "deleted";
  if (st) return st.toLowerCase();
  return "unknown";
}

function formatAddress(a: any): string | null {
  if (!a || typeof a !== "object") return null;
  const parts: string[] = [];
  if (a.careOf) parts.push(`c/o ${a.careOf}`);
  const street = [a.street, a.houseNumber, a.addon].filter(Boolean).join(" ").trim();
  if (street) parts.push(street);
  if (a.poBox) parts.push(`PO Box ${a.poBox}`);
  const cityLine = [a.swissZipCode || a.zipCode, a.town].filter(Boolean).join(" ");
  if (cityLine) parts.push(cityLine);
  if (a.country && a.country !== "CH") parts.push(a.country);
  return parts.length ? parts.join(", ") : null;
}

function stripHtml(s: string): string {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function redFlags(r: any): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  const st = statusLabel(r.status, r.deleteDate);
  if (st === "deleted") {
    flags.push({
      code: "deleted",
      severity: "high",
      detail: `Zefix status deleted${r.deleteDate ? `; deleteDate ${r.deleteDate}` : ""}`,
    });
  }
  if (!r.address || !(r.address.street || r.address.town || r.address.swissZipCode)) {
    flags.push({ code: "missing_address", severity: "medium", detail: "No street/town address on Zefix detail" });
  }
  if (Number(r.legalFormId) === 11) {
    flags.push({ code: "foreign_branch", severity: "medium", detail: "Registered as foreign branch in Switzerland" });
  }
  if (Number(r.legalFormId) === 9) {
    flags.push({ code: "branch", severity: "low", detail: "Registered as a branch (Zweigniederlassung), not the parent entity" });
  }
  return flags;
}

function mapLegalForm(id: any) {
  const n = Number(id);
  const hit = LEGAL_FORMS[n];
  return {
    id: Number.isFinite(n) ? n : null,
    description_en: hit?.en || null,
    description_de: hit?.de || null,
    short_en: hit?.short_en || null,
  };
}

function mapShab(pubs: any[] | undefined, lite = false) {
  if (!Array.isArray(pubs)) return [];
  const mapped = pubs.map((p) => ({
    date: p.shabDate || null,
    canton: p.registryOfficeCanton || null,
    journal_date: p.registryOfficeJournalDate || null,
    message: stripHtml(p.message || "").slice(0, lite ? 180 : 600) || null,
    mutation_types: Array.isArray(p.mutationTypes)
      ? p.mutationTypes.map((m: any) => m.key || m.id).filter(Boolean).slice(0, 5)
      : [],
  }));
  return lite ? mapped.slice(0, 2) : mapped.slice(0, 10);
}

function mapAudit(firms: any[] | undefined, lite = false) {
  if (!Array.isArray(firms)) return [];
  const mapped = firms.map((f) => ({
    name: f.name || null,
    uid: f.uid ? formatUid(digits(String(f.uid)).padStart(9, "0").slice(0, 9)) : null,
    uid_raw: f.uid || null,
    legal_seat: f.legalSeat || null,
    status: statusLabel(f.status, f.deleteDate),
  }));
  return lite ? mapped.slice(0, 1) : mapped.slice(0, 5);
}

function slimHit(h: any) {
  return {
    name: h.name || null,
    uid: h.uid ? formatUid(digits(String(h.uid)).slice(0, 9)) : null,
    uid_raw: h.uid || null,
    ehraid: h.ehraid ?? null,
    status: statusLabel(h.status, h.deleteDate),
    legal_seat: h.legalSeat || null,
    legal_form: mapLegalForm(h.legalFormId),
    chid: h.chidFormatted || h.chid || null,
  };
}

function slimDetail(r: any, lite = false) {
  const uidDigits = digits(String(r.uid || ""));
  const out: any = {
    uid: uidDigits.length === 9 ? formatUid(uidDigits) : r.uidFormatted || null,
    uid_raw: r.uid || null,
    ehraid: r.ehraid ?? null,
    chid: r.chidFormatted || r.chid || null,
    name: r.name || null,
    translations: Array.isArray(r.translation) ? r.translation : [],
    status: statusLabel(r.status, r.deleteDate),
    status_raw: r.status || null,
    delete_date: r.deleteDate || null,
    legal_seat: r.legalSeat || null,
    legal_form: mapLegalForm(r.legalFormId),
    address: formatAddress(r.address),
    address_detail: lite
      ? undefined
      : r.address
        ? {
            street: r.address.street || null,
            house_number: r.address.houseNumber || null,
            town: r.address.town || null,
            zip: r.address.swissZipCode || null,
            country: r.address.country || null,
            organisation: r.address.organisation || null,
          }
        : null,
    purpose: lite ? (r.purpose ? String(r.purpose).slice(0, 200) : null) : r.purpose || null,
    shab_date: r.shabDate || null,
    cantonal_excerpt_url: r.cantonalExcerptWeb || null,
    audit_firms: mapAudit(r.auditFirms, lite),
    recent_shab: mapShab(r.shabPub, lite),
    old_names: lite ? undefined : Array.isArray(r.oldNames) ? r.oldNames.slice(0, 10) : [],
    red_flags: redFlags(r),
  };
  if (lite) out.preview_omitted = ["full SHAB history", "address_detail", "old_names", "branch/audit detail"];
  return out;
}

async function zefixSearch(name: string, maxEntries = 10): Promise<any[]> {
  const r = await fetch(`${API}/firm/search`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({ name, maxEntries }),
    signal: AbortSignal.timeout(12000),
  });
  if (r.status === 429) throw new UserError("Zefix API rate limited — retry shortly", 429);
  if (!r.ok) throw new Error(`zefix search http ${r.status}`);
  const data: any = await r.json();
  return Array.isArray(data?.list) ? data.list : [];
}

async function zefixDetail(ehraid: number | string): Promise<any> {
  const r = await fetch(`${API}/firm/${ehraid}`, {
    headers: { accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(12000),
  });
  if (r.status === 404) throw new UserError(`no Swiss company found for ehraid=${ehraid}`, 404);
  if (r.status === 429) throw new UserError("Zefix API rate limited — retry shortly", 429);
  if (!r.ok) throw new Error(`zefix detail http ${r.status}`);
  return r.json();
}

function pickPrimary(hits: any[], preferUid?: string): any | null {
  if (!hits.length) return null;
  let pool = hits;
  if (preferUid) {
    const d = digits(preferUid);
    const matched = hits.filter((h) => digits(String(h.uid || "")) === d);
    if (matched.length) pool = matched;
  }
  const existing = pool.filter((h) => statusLabel(h.status, h.deleteDate) === "existing");
  const cand = existing.length ? existing : pool;
  // Prefer AG/SA (3) over branches/foundations when same UID
  const ag = cand.find((h) => Number(h.legalFormId) === 3);
  return ag || cand[0];
}

const UPSELL = {
  kyb: { path: "/kyb", price: "$2.50", why: "attach CH UID into one-shot KYB with VAT + LEI + sanctions" },
  registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch CH UIDs with UK/AU/CA/FR/NO/DK/FI ids" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
  uid_ch: { path: "/uid-ch", price: "$0.001", why: "offline Swiss UID check-digit only (no registry)" },
};

/** Swiss company lookup via Zefix REST (free official; no key). */
export async function chCompany(input: {
  uid?: string;
  che?: string;
  number?: string;
  ehraid?: string | number;
  name?: string;
  q?: string;
  lite?: boolean;
  limit?: number;
}) {
  const lite = !!input.lite;
  const rawUid = String(input.uid || input.che || input.number || "").trim();
  const name = String(input.name || input.q || "").trim();
  const ehraidIn = input.ehraid != null && String(input.ehraid).trim() !== "" ? String(input.ehraid).trim() : "";
  const limit = Math.min(Math.max(Number(input.limit) || (rawUid || ehraidIn ? 1 : 5), 1), 10);

  let mode: "uid" | "name" | "ehraid";
  let q: string;
  let uidDigits: string | null = null;

  if (ehraidIn && !rawUid && !name) {
    mode = "ehraid";
    q = ehraidIn;
  } else if (rawUid) {
    uidDigits = normalizeUid(rawUid);
    mode = "uid";
    q = formatUid(uidDigits);
  } else if (name) {
    if (name.length < 2) throw new UserError("name too short", 400);
    mode = "name";
    q = name;
  } else {
    throw new UserError("provide uid (or che/number), ehraid, or name", 400);
  }

  try {
    if (mode === "ehraid") {
      const detail = await zefixDetail(q);
      const primary = slimDetail(detail, lite);
      return {
        product: "ch-company",
        price: "$0.25",
        disclaimer: DISCLAIMER,
        query: { mode, q },
        total_results: 1,
        ...primary,
        source: "Zefix (Swiss central business name index / UID register)",
        source_url: `${API}/firm/${q}`,
        attribution: "Contains Zefix data from the Swiss Federal Office of Justice. Confirm at zefix.ch / cantonal excerpt before acting.",
        upsell: UPSELL,
      };
    }

    const searchQ = mode === "uid" ? formatUid(uidDigits!) : q;
    const hits = await zefixSearch(searchQ, mode === "uid" ? 15 : limit);
    const filtered =
      mode === "uid" ? hits.filter((h) => digits(String(h.uid || "")) === uidDigits) : hits;
    if (!filtered.length) {
      throw new UserError(
        mode === "uid" ? `no Swiss company found for uid=${searchQ}` : `no Swiss company found for name=${q}`,
        404,
      );
    }

    const chosen = pickPrimary(filtered, uidDigits || undefined)!;
    const detail = await zefixDetail(chosen.ehraid);
    const primary = slimDetail(detail, lite);
    const matches = filtered.slice(0, limit).map(slimHit);

    return {
      product: "ch-company",
      price: "$0.25",
      disclaimer: DISCLAIMER,
      query: { mode, q: searchQ },
      total_results: filtered.length,
      ...primary,
      matches: mode === "name" || filtered.length > 1 ? matches : undefined,
      source: "Zefix (Swiss central business name index / UID register)",
      source_url: `${API}/firm/${chosen.ehraid}`,
      attribution: "Contains Zefix data from the Swiss Federal Office of Justice. Confirm at zefix.ch / cantonal excerpt before acting.",
      upsell: UPSELL,
    };
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    throw new Error(`Swiss company lookup failed: ${e?.message || e}`);
  }
}

export function chCompanySlim(d: any) {
  return {
    uid: d.uid,
    name: d.name,
    status: d.status,
    legal_seat: d.legal_seat || null,
    legal_form: d.legal_form?.short_en || d.legal_form?.description_en || null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["purpose", "address_detail", "recent_shab", "audit_firms", "matches"],
  };
}
