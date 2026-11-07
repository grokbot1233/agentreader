import { UserError } from "./core";

const API = "https://api.statistics.sk/rpo/v1";
// Bounded per RPO hop (search + entity) so a slow/hung ŠÚ SR backend cannot stall /kyb or /registry-batch.
const RPO_TIMEOUT_MS = 7000;
const UA =
  "AgentReader/1.39 (+https://api.axiomworks.co.uk; Slovak company research via RPO / Statistical Office SR)";
const DISCLAIMER =
  "Slovak company profile from RPO (Register právnických osôb, podnikateľov a orgánov verejnej moci — Štatistický úrad SR). Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm identifiers at api.statistics.sk / orsr.sk before onboarding, contracting, or paying. Source: official RPO JSON API (free, CC-BY 4.0; subject to ŠÚ SR rate/availability limits).";

function digits(s: string): string {
  return String(s || "").replace(/\D/g, "");
}

/** Normalize Slovak IČO → 8 zero-padded digits. Accepts SK/SKVAT prefixes. No check-digit gate (overlaps CZ). */
export function normalizeSkIco(raw: string): string {
  let cleaned = String(raw || "").replace(/[\s\-./]/g, "").toUpperCase();
  if (cleaned.startsWith("SK")) cleaned = cleaned.slice(2);
  const d = digits(cleaned);
  if (!d || !/^\d+$/.test(d)) {
    throw new UserError("ico must be numeric (8 digits, e.g. 31322832)", 400);
  }
  if (d.length > 8) {
    throw new UserError("ico must be at most 8 digits", 400);
  }
  if (d.length < 6) {
    throw new UserError("ico must be 6–8 digits (zero-padded to 8)", 400);
  }
  return d.padStart(8, "0");
}

function currentOf<T extends { validTo?: string | null }>(arr: T[] | null | undefined): T | null {
  if (!Array.isArray(arr) || !arr.length) return null;
  const open = arr.filter((x) => !x.validTo);
  return (open.length ? open[open.length - 1] : arr[arr.length - 1]) || null;
}

function pickName(fullNames: any[] | null | undefined): string | null {
  const cur = currentOf(fullNames as any);
  return cur?.value ? String(cur.value) : null;
}

function formatAddress(addr: any): string | null {
  if (!addr || typeof addr !== "object") return null;
  const street = [addr.street, addr.buildingNumber, addr.regNumber && addr.regNumber !== 0 ? addr.regNumber : null]
    .filter((x) => x != null && x !== "")
    .join(" ")
    .trim();
  const pc = Array.isArray(addr.postalCodes) ? addr.postalCodes.filter(Boolean).join(" ") : addr.postalCode || "";
  const city = addr.municipality?.value || addr.municipality || null;
  const country = addr.country?.value || addr.country || null;
  const parts = [street, [pc, city].filter(Boolean).join(" "), country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function addressDetail(addr: any) {
  if (!addr) return null;
  return {
    street: addr.street || null,
    building_number: addr.buildingNumber ?? null,
    reg_number: addr.regNumber ?? null,
    city: addr.municipality?.value || null,
    postcode: Array.isArray(addr.postalCodes) ? addr.postalCodes[0] || null : null,
    country: addr.country?.value || addr.country?.code || null,
  };
}

function mapLegalForm(legalForms: any[] | null | undefined) {
  const cur = currentOf(legalForms as any);
  const v = cur?.value;
  if (!v) return null;
  if (typeof v === "string") return { code: null, description: v, short_en: null };
  return {
    code: v.code != null ? String(v.code) : null,
    description: v.value || null,
    short_en: null,
  };
}

function registrationOffice(sr: any): string | null {
  const offices = sr?.registrationOffices;
  const cur = currentOf(offices);
  return cur?.value ? String(cur.value) : null;
}

function registrationNumber(sr: any): string | null {
  const nums = sr?.registrationNumbers;
  const cur = currentOf(nums);
  return cur?.value ? String(cur.value) : null;
}

function trimPerson(p: any) {
  if (!p) return null;
  const name =
    p.personName?.formatedName ||
    p.personName?.formattedName ||
    [p.personName?.givenNames?.[0], p.personName?.familyNames?.[0]].filter(Boolean).join(" ") ||
    p.fullName ||
    p.name ||
    null;
  const role =
    p.statutoryBodyMember?.value ||
    p.stakeholderType?.value ||
    p.role ||
    null;
  const company = p.entityName || p.companyName || null;
  return {
    name: name || company || null,
    role: role || null,
    valid_from: p.validFrom || null,
    valid_to: p.validTo || null,
  };
}

function redFlags(opts: {
  status: string;
  termination: string | null;
  address: string | null;
  successors: any[];
}): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  if (opts.status === "terminated" || opts.termination) {
    flags.push({
      code: "terminated",
      severity: "high",
      detail: `Entity terminated${opts.termination ? ` on ${opts.termination}` : ""}`,
    });
  }
  if (!opts.address) {
    flags.push({ code: "missing_address", severity: "medium", detail: "No address on RPO record" });
  }
  if (opts.successors?.length) {
    flags.push({
      code: "has_successors",
      severity: "medium",
      detail: `${opts.successors.length} successor(s) recorded`,
    });
  }
  return flags;
}

function slimEntity(entity: any, searchHit: any | null, lite = false) {
  // Merge search hit + entity: entity sometimes has empty fullNames/addresses
  const names = (Array.isArray(entity?.fullNames) && entity.fullNames.length
    ? entity.fullNames
    : searchHit?.fullNames) || [];
  const addrs = (Array.isArray(entity?.addresses) && entity.addresses.length
    ? entity.addresses
    : searchHit?.addresses) || [];
  const legalForms = (Array.isArray(entity?.legalForms) && entity.legalForms.length
    ? entity.legalForms
    : searchHit?.legalForms) || [];
  const sourceRegister = entity?.sourceRegister || searchHit?.sourceRegister || null;
  const identifiers = entity?.identifiers || searchHit?.identifiers || [];
  const ico =
    (identifiers.find((i: any) => i?.value)?.value && String(identifiers.find((i: any) => i?.value).value)) ||
    null;
  const curAddr = currentOf(addrs);
  const address = formatAddress(curAddr);
  const termination = entity?.termination || searchHit?.termination || null;
  const status = termination ? "terminated" : "active";
  const establishment = entity?.establishment || searchHit?.establishment || null;
  const successors = Array.isArray(entity?.successors)
    ? entity.successors.map((s: any) => ({
        ico: s.identifier || null,
        name: s.fullName || null,
        address: formatAddress(s.address),
        valid_from: s.validFrom || null,
      }))
    : [];
  const statutory = Array.isArray(entity?.statutoryBodies)
    ? entity.statutoryBodies.map(trimPerson).filter((x: any) => x?.name)
    : [];
  const stakeholders = Array.isArray(entity?.stakeholders)
    ? entity.stakeholders.map(trimPerson).filter((x: any) => x?.name)
    : [];
  const legal = mapLegalForm(legalForms);
  const mainActivity = entity?.statisticalCodes?.mainActivity
    ? {
        code: entity.statisticalCodes.mainActivity.code || null,
        description: entity.statisticalCodes.mainActivity.value || null,
      }
    : null;

  const out: any = {
    ico,
    rpo_id: entity?.id ?? searchHit?.id ?? null,
    name: pickName(names),
    status,
    legal_form: legal,
    establishment,
    termination,
    address,
    address_detail: lite ? undefined : addressDetail(curAddr),
    seat: curAddr?.municipality?.value || null,
    registration_office: registrationOffice(sourceRegister),
    registration_number: registrationNumber(sourceRegister),
    source_register: sourceRegister?.value?.value || sourceRegister?.value || null,
    statutory_bodies: lite ? statutory.slice(0, 3) : statutory.slice(0, 25),
    stakeholders: lite ? stakeholders.slice(0, 3) : stakeholders.slice(0, 25),
    successors: lite ? successors.slice(0, 3) : successors.slice(0, 10),
    main_activity: lite ? undefined : mainActivity,
    country: "SK",
    red_flags: redFlags({ status, termination, address, successors }),
  };
  if (lite) out.preview_omitted = ["address_detail", "full statutory_bodies", "full stakeholders", "main_activity"];
  return out;
}

async function rpoSearch(params: Record<string, string>): Promise<{ results: any[]; url: string; license: string | null }> {
  const qs = new URLSearchParams(params);
  const url = `${API}/search?${qs}`;
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(RPO_TIMEOUT_MS),
  });
  if (r.status === 429) throw new UserError("RPO API rate limited — retry shortly", 429);
  if (r.status === 400) throw new UserError("invalid RPO search parameters", 400);
  if (!r.ok) throw new Error(`rpo search http ${r.status}`);
  const data: any = await r.json();
  return {
    results: Array.isArray(data?.results) ? data.results : [],
    url,
    license: data?.license ? "CC-BY 4.0 (ŠÚ SR RPO)" : null,
  };
}

async function rpoEntity(id: number | string): Promise<{ data: any; url: string }> {
  const url = `${API}/entity/${id}`;
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(RPO_TIMEOUT_MS),
  });
  if (r.status === 404) throw new UserError(`no Slovak company found for rpo_id=${id}`, 404);
  if (r.status === 429) throw new UserError("RPO API rate limited — retry shortly", 429);
  if (!r.ok) throw new Error(`rpo entity http ${r.status}`);
  return { data: await r.json(), url };
}

const UPSELL = {
  kyb: { path: "/kyb", price: "$2.50", why: "attach SK IČO into one-shot KYB with VAT + LEI + sanctions" },
  registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch SK IČO with UK/AU/CA/FR/NO/DK/FI/CH/PL/CZ/BE + US-state ids" },
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate SK VAT via VIES (SK + IČO)" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
};

/** Slovak company lookup via RPO (Register of Legal Entities, ŠÚ SR) — free official JSON; no key. */
export async function skCompany(input: {
  ico?: string;
  identifier?: string;
  sk?: string;
  ico_sk?: string;
  rpo?: string;
  number?: string;
  name?: string;
  q?: string;
  lite?: boolean;
  preview?: boolean;
  limit?: number;
}) {
  const lite = !!(input.lite || input.preview);
  const rawIco = String(
    input.ico || input.identifier || input.sk || input.ico_sk || input.rpo || input.number || "",
  ).trim();
  const name = String(input.name || input.q || "").trim();
  const limit = Math.min(Math.max(Number(input.limit) || (rawIco ? 1 : 5), 1), 10);

  let mode: "ico" | "name";
  let ico: string | null = null;

  if (rawIco) {
    ico = normalizeSkIco(rawIco);
    mode = "ico";
  } else if (name) {
    if (name.length < 2) throw new UserError("name too short", 400);
    mode = "name";
  } else {
    throw new UserError("provide ico (8 digits) or name", 400);
  }

  try {
    if (mode === "ico") {
      const { results, url: searchUrl, license } = await rpoSearch({ identifier: ico! });
      if (!results.length) throw new UserError(`no Slovak company found for ico=${ico}`, 404);
      const hit = results[0];
      const { data: entity, url: entityUrl } = await rpoEntity(hit.id);
      const primary = slimEntity(entity, hit, lite);
      return {
        product: "sk-company",
        price: "$0.25",
        disclaimer: DISCLAIMER,
        query: { mode, ico },
        ...primary,
        source: "RPO — Register právnických osôb (Štatistický úrad Slovenskej republiky)",
        source_url: entityUrl,
        search_url: searchUrl,
        license: license || "CC-BY 4.0 (ŠÚ SR RPO)",
        attribution:
          "Contains RPO data from the Statistical Office of the Slovak Republic under CC-BY 4.0. Confirm at api.statistics.sk / orsr.sk before acting.",
        upsell: UPSELL,
      };
    }

    // RPO fullName search is sensitive to commas/legal-form punctuation — strip for query.
    const searchName = name
      .replace(/,/g, " ")
      .replace(/\s+(a\.?s\.?|s\.?r\.?o\.?|k\.?s\.?|v\.?o\.?s\.?|spol\.?\s*s\s*r\.?o\.?)\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const { results, url: searchUrl, license } = await rpoSearch({ fullName: searchName || name });
    if (!results.length) throw new UserError(`no Slovak company found for name=${name}`, 404);

    const q = name.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
    const qBase = searchName.toLowerCase();
    const scored = results.map((h) => {
      const n = (pickName(h.fullNames) || "").toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
      let score = 0;
      if (n === q || n === qBase) score = 100;
      else if (n.startsWith(qBase + " ") || n.startsWith(qBase + " a") || n.startsWith(qBase + " s")) score = 92;
      else if (n.startsWith(qBase)) score = 75;
      else if (n.includes(qBase)) score = 50;
      else score = 10;
      // Prefer exact legal-name length closeness + active entities
      score += Math.max(0, 20 - Math.abs(n.length - q.length));
      if (!h.termination) score += 8;
      return { h, score, n };
    });
    scored.sort((a, b) => b.score - a.score);
    const chosen = scored[0].h;
    const { data: entity, url: entityUrl } = await rpoEntity(chosen.id);
    const primary = slimEntity(entity, chosen, lite);
    const matches = results.slice(0, limit).map((h) => ({
      ico: h.identifiers?.[0]?.value || null,
      rpo_id: h.id,
      name: pickName(h.fullNames),
      address: formatAddress(currentOf(h.addresses)),
      status: h.termination ? "terminated" : "active",
      establishment: h.establishment || null,
    }));

    return {
      product: "sk-company",
      price: "$0.25",
      disclaimer: DISCLAIMER,
      query: { mode, q: name },
      total_results: results.length,
      ...primary,
      matches: results.length > 1 ? matches : undefined,
      source: "RPO — Register právnických osôb (Štatistický úrad Slovenskej republiky)",
      source_url: entityUrl,
      search_url: searchUrl,
      license: license || "CC-BY 4.0 (ŠÚ SR RPO)",
      attribution:
        "Contains RPO data from the Statistical Office of the Slovak Republic under CC-BY 4.0. Confirm at api.statistics.sk / orsr.sk before acting.",
      upsell: UPSELL,
    };
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    if (e?.name === "TimeoutError" || e?.name === "AbortError" || /timeout|aborted/i.test(String(e?.message || ""))) {
      throw new UserError(`RPO (Štatistický úrad SR) upstream not responding within ${RPO_TIMEOUT_MS / 1000}s — retry shortly; confirm at orsr.sk`, 504);
    }
    throw new Error(`Slovak company lookup failed: ${e?.message || e}`);
  }
}

export function skCompanySlim(d: any) {
  return {
    ico: d.ico,
    name: d.name,
    status: d.status,
    seat: d.seat || null,
    legal_form: d.legal_form?.description || d.legal_form || null,
    registration_number: d.registration_number || null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["address_detail", "statutory_bodies", "stakeholders", "successors", "matches"],
  };
}
