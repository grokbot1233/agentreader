import { UserError } from "./core";

const API = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";
const UA =
  "AgentReader/1.37 (+https://api.axiomworks.co.uk; Czech company research via ARES REST)";
const DISCLAIMER =
  "Czech company profile from ARES (Administrativní registr ekonomických subjektů, Ministry of Finance). Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm identifiers at justice.cz / ARES before onboarding, contracting, or paying. Source: ares.gov.cz REST (free, no key; subject to MF rate limits).";

/** Common ARES právní forma codes → EN/CS short labels (static; avoids ciselnik hop). */
const LEGAL_FORMS: Record<string, { en: string; cs: string; short_en: string }> = {
  "100": { en: "Entrepreneur (natural person)", cs: "Podnikající fyzická osoba", short_en: "Sole" },
  "101": { en: "General partnership (v.o.s.)", cs: "Veřejná obchodní společnost", short_en: "GP" },
  "102": { en: "Limited partnership (k.s.)", cs: "Komanditní společnost", short_en: "LP" },
  "105": { en: "Partnership of lawyers", cs: "Společnost s ručením omezeným advokátů", short_en: "Law" },
  "111": { en: "Komanditní společnost (legacy)", cs: "Komanditní společnost", short_en: "LP" },
  "112": { en: "Limited liability company (s.r.o.)", cs: "Společnost s ručením omezeným", short_en: "LLC" },
  "121": { en: "Joint-stock company (a.s.)", cs: "Akciová společnost", short_en: "JSC" },
  "141": { en: "European company (SE)", cs: "Evropská společnost", short_en: "SE" },
  "145": { en: "European economic interest grouping", cs: "Evropské hospodářské zájmové sdružení", short_en: "EEIG" },
  "201": { en: "State enterprise", cs: "Státní podnik", short_en: "SOE" },
  "205": { en: "Cooperative", cs: "Družstvo", short_en: "Coop" },
  "231": { en: "Foundation", cs: "Nadace", short_en: "Found" },
  "232": { en: "Endowment fund", cs: "Nadační fond", short_en: "Fund" },
  "233": { en: "Institute", cs: "Ústav", short_en: "Inst" },
  "301": { en: "Association / spolek", cs: "Spolek", short_en: "Asso" },
  "325": { en: "Organisational unit of the state", cs: "Organizační složka státu", short_en: "State" },
  "331": { en: "Municipality", cs: "Obec", short_en: "Mun" },
  "353": { en: "Foreign branch", cs: "Odštěpný závod zahraniční osoby", short_en: "FB" },
  "361": { en: "Church / religious community", cs: "Církev / náboženská společnost", short_en: "Rel" },
  "421": { en: "Foreign legal entity", cs: "Zahraniční právnická osoba", short_en: "For" },
  "701": { en: "Association of legal entities", cs: "Zájmové sdružení právnických osob", short_en: "Assoc" },
  "932": { en: "Branch / plant", cs: "Odštěpný závod", short_en: "Bran" },
};

function digits(s: string): string {
  return String(s || "").replace(/\D/g, "");
}

/** Czech IČO check digit: weights 8..2 on first 7 digits; rem 0→1, rem 1→0, else 11-rem. */
export function icoCheckDigitOk(ico8: string): boolean {
  if (!/^\d{8}$/.test(ico8)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += (ico8.charCodeAt(i) - 48) * (8 - i);
  const rem = sum % 11;
  const expected = rem === 0 ? 1 : rem === 1 ? 0 : 11 - rem;
  return ico8[7] === String(expected);
}

/** Normalize Czech IČO → 8 zero-padded digits with check digit. Accepts CZ prefix / DIC. */
export function normalizeIco(raw: string): string {
  let cleaned = String(raw || "").replace(/[\s\-./]/g, "").toUpperCase();
  if (cleaned.startsWith("CZ")) cleaned = cleaned.slice(2);
  const d = digits(cleaned);
  if (!d || !/^\d+$/.test(d)) {
    throw new UserError("ico must be numeric (8 digits, e.g. 27082440)", 400);
  }
  if (d.length > 8) {
    throw new UserError("ico must be at most 8 digits", 400);
  }
  const padded = d.padStart(8, "0");
  if (!icoCheckDigitOk(padded)) {
    throw new UserError(`invalid Czech IČO check digit for ${padded.slice(0, 7)}?`, 400);
  }
  return padded;
}

function mapLegalForm(code: any) {
  const c = code == null ? "" : String(code);
  const hit = LEGAL_FORMS[c];
  return {
    code: c || null,
    description_en: hit?.en || null,
    description_cs: hit?.cs || null,
    short_en: hit?.short_en || null,
  };
}

function formatAddress(sidlo: any): string | null {
  if (!sidlo || typeof sidlo !== "object") return null;
  if (sidlo.textovaAdresa) return String(sidlo.textovaAdresa);
  const street = [sidlo.nazevUlice, sidlo.cisloDomovni, sidlo.cisloOrientacni].filter((x) => x != null && x !== "").join(" ").trim();
  const cityLine = [sidlo.psc, sidlo.nazevObce || sidlo.nazevCastiObce].filter(Boolean).join(" ");
  const parts = [street, cityLine, sidlo.nazevStatu].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function registryStatus(seznam: any): { status: string; registers: Record<string, string> } {
  const registers: Record<string, string> = {};
  if (seznam && typeof seznam === "object") {
    for (const [k, v] of Object.entries(seznam)) {
      const key = String(k).replace(/^stavZdroje/i, "").replace(/^./, (c) => c.toLowerCase());
      registers[key || k] = String(v);
    }
  }
  const vr = String(seznam?.stavZdrojeVr || "").toUpperCase();
  const ros = String(seznam?.stavZdrojeRos || "").toUpperCase();
  const dph = String(seznam?.stavZdrojeDph || "").toUpperCase();
  const ceu = String(seznam?.stavZdrojeCeu || "").toUpperCase();
  let status = "unknown";
  if (ceu === "AKTIVNI") status = "insolvent";
  else if (vr === "AKTIVNI" || ros === "AKTIVNI") status = "active";
  else if (vr === "ZANIKLY" || ros === "ZANIKLY" || vr === "VYMAZANY" || ros === "VYMAZANY") status = "dissolved";
  else if (vr === "HISTORICKY" || ros === "HISTORICKY") status = "historical";
  else if (dph === "AKTIVNI") status = "active";
  else if (vr || ros) status = (vr || ros).toLowerCase();
  return { status, registers };
}

function redFlags(opts: {
  status: string;
  address: string | null;
  nace: string[];
  dissolved_date: string | null;
  registers: Record<string, string>;
}): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  if (opts.status === "insolvent") {
    flags.push({ code: "insolvent", severity: "high", detail: "ARES CEU (insolvency) register status AKTIVNI" });
  }
  if (opts.status === "dissolved" || opts.dissolved_date) {
    flags.push({
      code: "dissolved",
      severity: "high",
      detail: `Entity dissolved${opts.dissolved_date ? ` on ${opts.dissolved_date}` : ""}`,
    });
  }
  if (!opts.address) {
    flags.push({ code: "missing_address", severity: "medium", detail: "No seat/address on ARES record" });
  }
  if (!opts.nace.length) {
    flags.push({ code: "missing_nace", severity: "low", detail: "No CZ-NACE activity codes on ARES record" });
  }
  const vr = String(opts.registers.vr || opts.registers.Vr || "").toUpperCase();
  if (vr === "NEEXISTUJICI" && opts.status === "active") {
    flags.push({
      code: "not_in_commercial_register",
      severity: "low",
      detail: "Active in ROS/other sources but not in Veřejný rejstřík (VR) — may be sole trader / non-commercial",
    });
  }
  return flags;
}

function slimSubject(s: any, lite = false, vr?: any) {
  const { status, registers } = registryStatus(s.seznamRegistraci);
  const nace = Array.isArray(s.czNace2008) ? s.czNace2008.map(String) : [];
  const address = formatAddress(s.sidlo);
  const legal = mapLegalForm(s.pravniForma);
  const dissolved = s.datumZaniku || null;

  let court_file: string | null = null;
  let capital: any = null;
  if (vr && Array.isArray(vr.zaznamy) && vr.zaznamy.length) {
    const z = vr.zaznamy.find((x: any) => x.primarniZaznam) || vr.zaznamy[0];
    const sp = Array.isArray(z?.spisovaZnacka) ? z.spisovaZnacka.find((x: any) => !x.datumVymazu) || z.spisovaZnacka[0] : null;
    if (sp) {
      court_file = [sp.soud, sp.oddil, sp.vlozka != null ? String(sp.vlozka) : null].filter(Boolean).join(" ") || null;
    }
    const kap = Array.isArray(z?.zakladniKapital)
      ? z.zakladniKapital.find((x: any) => !x.datumVymazu) || z.zakladniKapital[0]
      : null;
    if (kap?.vklad) {
      capital = {
        amount: kap.vklad.hodnota != null ? String(kap.vklad.hodnota).replace(";", ".") : null,
        currency: kap.vklad.typObnos === "KORUNY" ? "CZK" : kap.vklad.typObnos || null,
        paid_in_pct: kap.splaceni?.hodnota != null ? String(kap.splaceni.hodnota) : null,
      };
    }
  }

  const out: any = {
    ico: s.ico || null,
    dic: s.dic || (s.ico ? `CZ${s.ico}` : null),
    name: s.obchodniJmeno || null,
    legal_form: legal,
    status,
    status_registers: lite ? undefined : registers,
    seat: s.sidlo?.nazevObce || null,
    address,
    address_detail: lite
      ? undefined
      : s.sidlo
        ? {
            street: s.sidlo.nazevUlice || null,
            house_number: s.sidlo.cisloDomovni ?? null,
            orientation_number: s.sidlo.cisloOrientacni ?? null,
            district: s.sidlo.nazevCastiObce || null,
            city: s.sidlo.nazevObce || null,
            postcode: s.sidlo.psc ?? null,
            region: s.sidlo.nazevKraje || null,
            country: s.sidlo.nazevStatu || s.sidlo.kodStatu || null,
          }
        : null,
    founded: s.datumVzniku || null,
    dissolved: dissolved,
    updated: s.datumAktualizace || null,
    activities_nace: lite ? nace.slice(0, 5) : nace.slice(0, 40),
    court_file: court_file,
    capital: capital,
    country: "CZ",
    red_flags: redFlags({ status, address, nace, dissolved_date: dissolved, registers }),
  };
  if (lite) out.preview_omitted = ["status_registers", "address_detail", "full NACE", "VR capital/court soft-attach"];
  return out;
}

async function aresGet(ico: string): Promise<any> {
  const url = `${API}/ekonomicke-subjekty/${ico}`;
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 404) throw new UserError(`no Czech company found for ico=${ico}`, 404);
  if (r.status === 429) throw new UserError("ARES API rate limited — retry shortly", 429);
  if (!r.ok) throw new Error(`ares get http ${r.status}`);
  const data: any = await r.json();
  if (data?.kod === "NENALEZENO" || !data?.ico) {
    throw new UserError(`no Czech company found for ico=${ico}`, 404);
  }
  return { data, url };
}

async function aresSearch(name: string, limit = 5): Promise<any[]> {
  const r = await fetch(`${API}/ekonomicke-subjekty/vyhledat`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({ obchodniJmeno: name, start: 0, pocet: Math.min(Math.max(limit, 1), 10) }),
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 429) throw new UserError("ARES API rate limited — retry shortly", 429);
  if (!r.ok) throw new Error(`ares search http ${r.status}`);
  const data: any = await r.json();
  return Array.isArray(data?.ekonomickeSubjekty) ? data.ekonomickeSubjekty : [];
}

async function aresVrSoft(ico: string): Promise<any | null> {
  try {
    const r = await fetch(`${API}/ekonomicke-subjekty-vr/${ico}`, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

const UPSELL = {
  kyb: { path: "/kyb", price: "$2.50", why: "attach CZ IČO into one-shot KYB with VAT + LEI + sanctions" },
  registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch CZ IČO with UK/AU/CA/FR/NO/DK/FI/CH/PL ids" },
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate CZ VAT via VIES (DIC = CZ + IČO)" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
};

/** Czech company lookup via ARES REST (free official; no key). */
export async function czCompany(input: {
  ico?: string;
  number?: string;
  cz?: string;
  dic?: string;
  name?: string;
  q?: string;
  lite?: boolean;
  preview?: boolean;
  limit?: number;
}) {
  const lite = !!(input.lite || input.preview);
  const rawIco = String(input.ico || input.number || input.cz || input.dic || "").trim();
  const name = String(input.name || input.q || "").trim();
  const limit = Math.min(Math.max(Number(input.limit) || (rawIco ? 1 : 5), 1), 10);

  let mode: "ico" | "name";
  let ico: string | null = null;

  if (rawIco) {
    ico = normalizeIco(rawIco);
    mode = "ico";
  } else if (name) {
    if (name.length < 2) throw new UserError("name too short", 400);
    mode = "name";
  } else {
    throw new UserError("provide ico (8 digits) or name", 400);
  }

  try {
    if (mode === "ico") {
      const { data, url } = await aresGet(ico!);
      const vr = lite ? null : await aresVrSoft(ico!);
      const primary = slimSubject(data, lite, vr);
      return {
        product: "cz-company",
        price: "$0.25",
        disclaimer: DISCLAIMER,
        query: { mode, ico },
        ...primary,
        source: "ARES (Administrativní registr ekonomických subjektů, MF ČR)",
        source_url: url,
        attribution:
          "Contains ARES data from the Czech Ministry of Finance. Confirm at ares.gov.cz / justice.cz before acting.",
        upsell: UPSELL,
      };
    }

    const hits = await aresSearch(name, limit);
    if (!hits.length) throw new UserError(`no Czech company found for name=${name}`, 404);

    // Prefer exact/starts-with match, then first a.s./s.r.o.
    const q = name.toLowerCase();
    const exact = hits.find((h) => String(h.obchodniJmeno || "").toLowerCase() === q);
    const starts = hits.find((h) => String(h.obchodniJmeno || "").toLowerCase().startsWith(q));
    const as = hits.find((h) => String(h.pravniForma) === "121");
    const chosen = exact || starts || as || hits[0];
    const chosenIco = normalizeIco(String(chosen.ico));
    const { data, url } = await aresGet(chosenIco);
    const vr = lite ? null : await aresVrSoft(chosenIco);
    const primary = slimSubject(data, lite, vr);
    const matches = hits.slice(0, limit).map((h) => ({
      ico: h.ico || null,
      name: h.obchodniJmeno || null,
      legal_form: mapLegalForm(h.pravniForma),
      address: formatAddress(h.sidlo),
      status: registryStatus(h.seznamRegistraci).status,
    }));

    return {
      product: "cz-company",
      price: "$0.25",
      disclaimer: DISCLAIMER,
      query: { mode, q: name },
      total_results: hits.length,
      ...primary,
      matches: hits.length > 1 ? matches : undefined,
      source: "ARES (Administrativní registr ekonomických subjektů, MF ČR)",
      source_url: url,
      attribution:
        "Contains ARES data from the Czech Ministry of Finance. Confirm at ares.gov.cz / justice.cz before acting.",
      upsell: UPSELL,
    };
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    throw new Error(`Czech company lookup failed: ${e?.message || e}`);
  }
}

export function czCompanySlim(d: any) {
  return {
    ico: d.ico,
    dic: d.dic || null,
    name: d.name,
    status: d.status,
    seat: d.seat || null,
    legal_form: d.legal_form?.short_en || d.legal_form?.description_en || null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["address_detail", "status_registers", "full NACE", "capital", "matches"],
  };
}
