import { UserError } from "./core";
import { parseHTML } from "linkedom";

const BASE = "https://kbopub.economie.fgov.be/kbopub";
const UA =
  "AgentReader/1.38 (+https://api.axiomworks.co.uk; Belgian company research via CBE/KBO Public Search)";
const DISCLAIMER =
  "Belgian company profile from CBE/KBO Public Search (Crossroads Bank for Enterprises, FPS Economy). Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm identifiers at kbopub.economie.fgov.be before onboarding, contracting, or paying. Source: official public HTML search (free, no key; subject to FPS rate/availability limits).";

function digits(s: string): string {
  return String(s || "").replace(/\D/g, "");
}

/** Mod-97 check: last 2 digits == 97 - (first 8 % 97); rem 0 → 97. */
export function enterpriseCheckDigitOk(n10: string): boolean {
  if (!/^\d{10}$/.test(n10)) return false;
  if (n10[0] !== "0" && n10[0] !== "1") return false;
  const rem = Number(n10.slice(0, 8)) % 97;
  const expected = rem === 0 ? 97 : 97 - rem;
  return Number(n10.slice(8)) === expected;
}

/** Format 10-digit enterprise number as 0xxx.xxx.xxx */
export function formatEnterpriseNumber(n10: string): string {
  const d = digits(n10).padStart(10, "0").slice(0, 10);
  return `${d.slice(0, 4)}.${d.slice(4, 7)}.${d.slice(7, 10)}`;
}

/**
 * Normalize Belgian enterprise / VAT number → 10 digits with mod-97 check.
 * Accepts BE prefix, dots/spaces, 9-digit (leading 0) or 10-digit forms.
 */
export function normalizeEnterpriseNumber(raw: string): string {
  let cleaned = String(raw || "").replace(/[\s\-./]/g, "").toUpperCase();
  if (cleaned.startsWith("BE")) cleaned = cleaned.slice(2);
  const d = digits(cleaned);
  if (!d || !/^\d+$/.test(d)) {
    throw new UserError("enterprise number must be numeric (10 digits, e.g. 0202239951 or 0202.239.951)", 400);
  }
  if (d.length === 9) {
    const padded = "0" + d;
    if (!enterpriseCheckDigitOk(padded)) {
      throw new UserError(`invalid Belgian enterprise number check digit for ${formatEnterpriseNumber(padded)}?`, 400);
    }
    return padded;
  }
  if (d.length !== 10) {
    throw new UserError("enterprise number must be 9 or 10 digits (optional BE / dots)", 400);
  }
  if (!enterpriseCheckDigitOk(d)) {
    throw new UserError(`invalid Belgian enterprise number check digit for ${formatEnterpriseNumber(d)}?`, 400);
  }
  return d;
}

function cellText(el: any): string {
  if (!el) return "";
  return String(el.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findRowByLabel(doc: any, labelRe: RegExp): any | null {
  const rows = Array.from(doc.querySelectorAll("tr")) as any[];
  for (const tr of rows) {
    // Only top-level label cells (class QL/RL), skip nested function tables for general fields
    const cells = Array.from(tr.children).filter((c: any) => /^T[DH]$/i.test(c.tagName)) as any[];
    if (!cells.length) continue;
    const label = cellText(cells[0]).replace(/:$/, "").trim() + (String(cells[0].textContent || "").includes(":") ? ":" : "");
    const labelNorm = cellText(cells[0]);
    if (!labelRe.test(labelNorm)) continue;
    return tr;
  }
  return null;
}

function valueCell(tr: any): any | null {
  if (!tr) return null;
  const cells = Array.from(tr.children).filter((c: any) => /^T[DH]$/i.test(c.tagName)) as any[];
  return cells[1] || null;
}

function directTextParts(el: any): string[] {
  if (!el) return [];
  const parts: string[] = [];
  for (const node of Array.from(el.childNodes || []) as any[]) {
    if (node.nodeType === 3) {
      const t = String(node.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (t) parts.push(t);
    } else if (node.tagName === "BR") {
      continue;
    } else if (node.tagName === "SPAN" || node.tagName === "STRONG" || node.tagName === "A") {
      const t = cellText(node);
      if (t) parts.push(t);
    }
  }
  return parts;
}

function parseNameFromCell(el: any): { name: string | null; names: { lang: string; name: string; since: string | null }[] } {
  if (!el) return { name: null, names: [] };
  const html = String(el.innerHTML || "");
  // Split on <br>
  const chunks = html.split(/<br\s*\/?>/i).map((c) =>
    c
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim(),
  ).filter(Boolean);
  const names: { lang: string; name: string; since: string | null }[] = [];
  let primary: string | null = null;
  let pendingLang: { lang: string; since: string | null } | null = null;
  for (const ch of chunks) {
    const meta = ch.match(/^Name in\s+([A-Za-z]+),\s*since\s+(.+)$/i);
    if (meta) {
      pendingLang = { lang: meta[1].toLowerCase(), since: meta[2].trim() };
      continue;
    }
    if (!primary) primary = ch;
    if (pendingLang) {
      names.push({ lang: pendingLang.lang, since: pendingLang.since, name: ch });
      pendingLang = null;
    }
  }
  return { name: primary, names };
}

function parseSinceFromCell(el: any): { value: string | null; since: string | null } {
  if (!el) return { value: null, since: null };
  const parts = directTextParts(el);
  if (!parts.length) {
    const t = cellText(el);
    return t && !/^no data/i.test(t) ? { value: t, since: null } : { value: null, since: null };
  }
  const valueParts: string[] = [];
  let since: string | null = null;
  for (const p of parts) {
    const m = p.match(/^Since\s+(.+)$/i);
    if (m) since = m[1].trim();
    else if (!/^no data/i.test(p)) valueParts.push(p);
  }
  const value = valueParts.length ? valueParts.join(" ") : null;
  return { value, since };
}

function parseNace(doc: any, lite: boolean): { code: string; description: string; scheme: string; since: string | null }[] {
  const out: { code: string; description: string; scheme: string; since: string | null }[] = [];
  const rows = Array.from(doc.querySelectorAll("tr")) as any[];
  for (const tr of rows) {
    const t = cellText(tr);
    const m = t.match(/\b(VAT|NSSO)\s*(2025|2008|2003)?\s+(\d{2}\.\d{3})\s*[-–—]\s*(.+)$/i);
    if (!m) continue;
    const scheme = `${m[1].toUpperCase()}${m[2] ? " " + m[2] : ""}`;
    if (lite && !/VAT\s*2025/i.test(scheme)) continue;
    let desc = (m[4] || "").trim().replace(/([a-z])Since\s+/i, "$1 Since ");
    let since: string | null = null;
    const sm = desc.match(/^(.*?)\s+Since\s+(.+)$/i);
    if (sm) {
      desc = sm[1].trim();
      since = sm[2].trim();
    }
    out.push({ code: m[3], description: desc, scheme, since });
  }
  const seen = new Set<string>();
  const uniq = [];
  for (const n of out) {
    const k = `${n.scheme}|${n.code}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(n);
  }
  return lite ? uniq.slice(0, 5) : uniq.slice(0, 20);
}

function parseFunctions(doc: any, lite: boolean): { role: string; name: string; since: string | null }[] {
  const out: { role: string; name: string; since: string | null }[] = [];
  const table = doc.querySelector("#toonfctie") || doc.querySelector("table#toonfctie");
  const rows = table
    ? (Array.from(table.querySelectorAll("tr")) as any[])
    : (Array.from(doc.querySelectorAll("tr")) as any[]);
  const roleRe =
    /^(Director|Managing Director|Permanent representative|Auditor|Liquidator|Trustee|Person in charge|Manager|Partner|Founder|Member|Chairman|Secretary|Treasurer)\b/i;
  for (const tr of rows) {
    const cells = Array.from(tr.querySelectorAll(":scope > td, :scope > th")) as any[];
    if (cells.length < 2) continue;
    const role = cellText(cells[0]);
    if (!roleRe.test(role)) continue;
    // Avoid the giant collapsed summary cell
    if (role.length > 40) continue;
    const name = cellText(cells[1]).replace(/\s*,\s*/g, ", ").trim();
    if (!name || name.length > 120) continue;
    const sinceRaw = cells[2] ? cellText(cells[2]) : "";
    const since = sinceRaw.replace(/^Since\s+/i, "").trim() || null;
    out.push({ role, name, since });
  }
  return lite ? out.slice(0, 5) : out.slice(0, 25);
}

function parseCharacteristics(doc: any): string[] {
  const out: string[] = [];
  let inChars = false;
  const rows = Array.from(doc.querySelectorAll("tr")) as any[];
  for (const tr of rows) {
    const t = cellText(tr);
    if (/^Characteristics$/i.test(t)) {
      inChars = true;
      continue;
    }
    if (inChars) {
      if (/^(Authorisations|Functions|Financial information|Links between entities|External links|Version of the Nacebel)/i.test(t)) break;
      if (t && t.length < 200) out.push(t);
    }
  }
  return out.slice(0, 12);
}

function redFlags(opts: {
  status: string | null;
  legal_situation: string | null;
  address: string | null;
  subject_to_vat: boolean;
}): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  const st = String(opts.status || "").toLowerCase();
  const sit = String(opts.legal_situation || "").toLowerCase();
  if (st && st !== "active") {
    flags.push({ code: "inactive_status", severity: "high", detail: `CBE status: ${opts.status}` });
  }
  if (/bankrupt|faillite|faillissement|liquidat|dissolved|stopped|cessation|ex officio|gestrike|struck/i.test(sit)) {
    flags.push({ code: "adverse_legal_situation", severity: "high", detail: `Legal situation: ${opts.legal_situation}` });
  } else if (sit && !/normal situation/i.test(sit)) {
    flags.push({ code: "non_normal_situation", severity: "medium", detail: `Legal situation: ${opts.legal_situation}` });
  }
  if (!opts.address) {
    flags.push({ code: "missing_address", severity: "medium", detail: "No registered seat address on CBE public record" });
  }
  if (!opts.subject_to_vat) {
    flags.push({ code: "not_subject_to_vat", severity: "low", detail: "Entity does not show 'Subject to VAT' characteristic" });
  }
  return flags;
}

function mapStatus(raw: string | null): string {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();
  if (s === "active") return "active";
  if (/stopped|cessation|closed|inactive|gestrike|struck/i.test(s)) return "stopped";
  return s;
}

async function fetchHtml(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": UA,
      "accept-language": "en",
    },
    signal: AbortSignal.timeout(18000),
    redirect: "follow",
  });
  if (r.status === 429) throw new UserError("CBE Public Search rate limited — retry shortly", 429);
  if (!r.ok) throw new Error(`kbo http ${r.status}`);
  return r.text();
}

function parseEnterprisePage(html: string, n10: string, lite: boolean) {
  if (/does not exist in CBE/i.test(html) || /No entity data found/i.test(html)) {
    throw new UserError(`no Belgian company found for enterprise_number=${formatEnterpriseNumber(n10)}`, 404);
  }
  if (/The number is invalid/i.test(html)) {
    throw new UserError(`invalid Belgian enterprise number ${formatEnterpriseNumber(n10)}`, 400);
  }
  const { document } = parseHTML(html);

  const entTr = findRowByLabel(document, /^Enterprise number:?$/i);
  const statusTr = findRowByLabel(document, /^Status:?$/i);
  const legalSitTr = findRowByLabel(document, /^Legal situation:?$/i);
  const startTr = findRowByLabel(document, /^Start date:?$/i);
  const nameTr = findRowByLabel(document, /^Name:?$/i);
  const addrTr = findRowByLabel(document, /^Registered seat'?s? address:?$/i);
  const phoneTr = findRowByLabel(document, /^Phone number:?$/i);
  const webTr = findRowByLabel(document, /^Web Address:?$/i);
  const entityTypeTr = findRowByLabel(document, /^Entity type:?$/i);
  const legalFormTr = findRowByLabel(document, /^Legal form:?$/i);
  const euCountTr = findRowByLabel(document, /^Number of establishment units/i);
  const capitalTr = findRowByLabel(document, /^Capital:?$/i);

  const statusRaw = cellText(valueCell(statusTr));
  const startRaw = cellText(valueCell(startTr));
  const entityTypeRaw = cellText(valueCell(entityTypeTr));
  const nameBlock = parseNameFromCell(valueCell(nameTr));
  const legalForm = parseSinceFromCell(valueCell(legalFormTr));
  const legalSit = parseSinceFromCell(valueCell(legalSitTr));
  const addr = parseSinceFromCell(valueCell(addrTr));
  const phoneParts = parseSinceFromCell(valueCell(phoneTr));
  const webParts = parseSinceFromCell(valueCell(webTr));
  const capitalRaw = cellText(valueCell(capitalTr));
  const euCountRaw = cellText(valueCell(euCountTr));

  if (!nameBlock.name && !statusRaw && !cellText(valueCell(entTr))) {
    throw new UserError(`no Belgian company found for enterprise_number=${formatEnterpriseNumber(n10)}`, 404);
  }

  const status = mapStatus(statusRaw || null);
  const chars = parseCharacteristics(document);
  const subject_to_vat = chars.some((c) => /subject to vat/i.test(c));
  const nace = parseNace(document, lite);
  const functions = parseFunctions(document, lite);
  const euMatch = (euCountRaw || "").match(/(\d+)/);
  const enterprise_number = formatEnterpriseNumber(n10);
  const vat = subject_to_vat ? `BE${n10}` : null;

  return {
    enterprise_number,
    enterprise_number_raw: n10,
    vat,
    name: nameBlock.name,
    names: lite ? undefined : nameBlock.names,
    status,
    status_raw: statusRaw || null,
    legal_situation: legalSit.value,
    legal_situation_since: legalSit.since,
    start_date: startRaw || null,
    entity_type: entityTypeRaw || null,
    legal_form: legalForm.value,
    legal_form_since: legalForm.since,
    address: addr.value,
    address_since: addr.since,
    phone: phoneParts.value && !/^no data/i.test(phoneParts.value) ? phoneParts.value : null,
    website: webParts.value && !/^no data/i.test(webParts.value) ? webParts.value : null,
    establishment_units: euMatch ? Number(euMatch[1]) : null,
    capital: capitalRaw && !/^no data/i.test(capitalRaw) ? capitalRaw : null,
    characteristics: lite ? chars.slice(0, 4) : chars,
    nace,
    functions,
    red_flags: redFlags({
      status,
      legal_situation: legalSit.value,
      address: addr.value,
      subject_to_vat,
    }),
    country: "BE",
  };
}

type NameHit = {
  enterprise_number: string;
  name: string | null;
  status: string | null;
  kind: string | null;
};

function parseNameResults(html: string, limit: number): NameHit[] {
  const { document } = parseHTML(html);
  const hits: NameHit[] = [];
  const seen = new Set<string>();
  const rows = Array.from(document.querySelectorAll("tr")) as any[];
  for (const tr of rows) {
    const t = cellText(tr);
    const m = t.match(/\b([01]?\d{3}\.\d{3}\.\d{3})\b/);
    if (!m) continue;
    const kind = /\bENT\b/i.test(t) ? "ENT" : /\bEU\b/i.test(t) ? "EU" : null;
    if (kind === "EU") continue;
    let n10: string;
    try {
      n10 = normalizeEnterpriseNumber(m[1]);
    } catch {
      continue;
    }
    if (seen.has(n10)) continue;
    seen.add(n10);
    const statusM = t.match(/\b(Active|Stopped|Published)\b/i);
    const afterNum = t.split(m[1])[1] || "";
    const nameGuess = afterNum
      .replace(/^\s*[\d.]+\s*/, "")
      .replace(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\s*/i, "")
      .replace(/^\s*\d+\s*Establishment units?\s*/i, "")
      .trim();
    const cut = nameGuess.match(/^(.{3,80}?)(?:\s+(?:Rue|Street|Boulevard|Avenue|Chaussée|Steenweg|Straat|Laan)\b.*)?$/i);
    const name = (cut ? cut[1] : nameGuess).replace(/\s+/g, " ").trim().slice(0, 120) || null;
    hits.push({
      enterprise_number: formatEnterpriseNumber(n10),
      name,
      status: statusM ? statusM[1] : null,
      kind,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

async function lookupByNumber(n10: string, lite: boolean) {
  // Prefer number-search EN page; fall back to direct toonondernemingps detail.
  const searchUrl = `${BASE}/zoeknummerform.html?lang=en&nummer=${encodeURIComponent(formatEnterpriseNumber(n10))}&actionLu=Search`;
  let html: string;
  let url = searchUrl;
  try {
    html = await fetchHtml(searchUrl);
  } catch (e: any) {
    const alt = `${BASE}/toonondernemingps.html?ondernemingsnummer=${n10}`;
    url = alt;
    html = await fetchHtml(alt);
  }
  // If search returned empty/error page, try direct toon
  if (/does not exist in CBE|No entity data found|The number is invalid/i.test(html) === false && !/Enterprise number/i.test(html)) {
    const alt = `${BASE}/toonondernemingps.html?ondernemingsnummer=${n10}`;
    url = alt;
    html = await fetchHtml(alt);
  }
  const parsed = parseEnterprisePage(html, n10, lite);
  return { ...parsed, source_url: url };
}

async function searchByName(name: string, limit: number): Promise<NameHit[]> {
  // Warm session on the form page first (FPS sometimes 404s cold phonetic searches).
  try {
    await fetchHtml(`${BASE}/zoeknaamfonetischform.html?lang=en`);
  } catch {
    /* ignore warm-up failures */
  }
  const params = new URLSearchParams({
    lang: "en",
    searchWord: name,
    ondNP: "true",
    _ondNP: "on",
    ondRP: "true",
    _ondRP: "on",
    rechtsvormFonetic: "ALL",
    vest: "true",
    _vest: "on",
    filterEnkelActieve: "true",
    _filterEnkelActieve: "on",
    actionNPRP: "Search",
  });
  const url = `${BASE}/zoeknaamfonetischform.html?${params}`;
  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (e: any) {
    throw new UserError(
      `Belgian name search unavailable from CBE right now (${e?.message || e}). Retry or look up by enterprise_number.`,
      503,
    );
  }
  return parseNameResults(html, limit);
}

const UPSELL = {
  kyb: { path: "/kyb", price: "$2.50", why: "attach BE enterprise number into one-shot KYB with VAT + LEI + sanctions" },
  registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch BE numbers with UK/AU/CA/FR/NO/DK/FI/CH/PL/CZ ids" },
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate BE VAT via VIES (BE + 10 digits)" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
};

/** Belgian company lookup via CBE/KBO Public Search (free official HTML; no key). */
export async function beCompany(input: {
  enterprise_number?: string;
  number?: string;
  be?: string;
  vat?: string;
  bce?: string;
  kbo?: string;
  name?: string;
  q?: string;
  lite?: boolean;
  preview?: boolean;
  limit?: number;
}) {
  const lite = !!(input.lite || input.preview);
  const rawNum = String(
    input.enterprise_number || input.number || input.be || input.vat || input.bce || input.kbo || "",
  ).trim();
  const name = String(input.name || input.q || "").trim();
  const limit = Math.min(Math.max(Number(input.limit) || (rawNum ? 1 : 5), 1), 10);

  let mode: "enterprise_number" | "name";
  let n10: string | null = null;

  if (rawNum) {
    n10 = normalizeEnterpriseNumber(rawNum);
    mode = "enterprise_number";
  } else if (name) {
    if (name.length < 2) throw new UserError("name too short", 400);
    mode = "name";
  } else {
    throw new UserError("provide enterprise_number (10 digits, e.g. 0202239951) or name", 400);
  }

  try {
    if (mode === "enterprise_number") {
      const primary = await lookupByNumber(n10!, lite);
      return {
        product: "be-company",
        price: "$0.25",
        disclaimer: DISCLAIMER,
        query: { mode, enterprise_number: formatEnterpriseNumber(n10!) },
        ...primary,
        source: "CBE/KBO Public Search (FPS Economy, Belgium)",
        attribution:
          "Contains public CBE data from FPS Economy. Confirm at kbopub.economie.fgov.be before acting.",
        upsell: UPSELL,
      };
    }

    const hits = await searchByName(name, Math.max(limit, 5));
    if (!hits.length) throw new UserError(`no Belgian company found for name=${name}`, 404);

    const q = name.toLowerCase();
    const exact = hits.find((h) => String(h.name || "").toLowerCase() === q);
    const starts = hits.find((h) => String(h.name || "").toLowerCase().startsWith(q));
    const chosen = exact || starts || hits[0];
    const chosenN = normalizeEnterpriseNumber(chosen.enterprise_number);
    const primary = await lookupByNumber(chosenN, lite);
    const matches = hits.slice(0, limit).map((h) => ({
      enterprise_number: h.enterprise_number,
      name: h.name,
      status: h.status,
      kind: h.kind,
    }));

    return {
      product: "be-company",
      price: "$0.25",
      disclaimer: DISCLAIMER,
      query: { mode, q: name },
      total_results: hits.length,
      ...primary,
      matches: hits.length > 1 ? matches : undefined,
      source: "CBE/KBO Public Search (FPS Economy, Belgium)",
      attribution:
        "Contains public CBE data from FPS Economy. Confirm at kbopub.economie.fgov.be before acting.",
      upsell: UPSELL,
    };
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    throw new Error(`Belgian company lookup failed: ${e?.message || e}`);
  }
}

export function beCompanySlim(d: any) {
  return {
    enterprise_number: d.enterprise_number,
    vat: d.vat || null,
    name: d.name,
    status: d.status,
    legal_form: d.legal_form || null,
    address: d.address || null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["functions", "full NACE", "characteristics", "names", "matches"],
  };
}
