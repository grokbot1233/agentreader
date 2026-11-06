import { UserError } from "./core";

const SEARCH = "https://data.brreg.no/enhetsregisteret/api/enheter";
const UA = "AgentReader/1.0 (+https://api.axiomworks.co.uk; Norwegian company research via Brønnøysundregistrene Enhetsregisteret)";
const DISCLAIMER =
  "Norwegian company profile from Brønnøysundregistrene Enhetsregisteret (open data, NLOD). Screening aid only — not a KYB/AML determination, credit score, or legal advice. Confirm identifiers at source before onboarding, contracting, or paying.";

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

function pickQuery(input: { orgnr?: string; name?: string; q?: string }): { q: string; mode: "orgnr" | "name" } {
  const orgnr = digits(String(input.orgnr || ""));
  const name = String(input.name || input.q || "").trim();
  if (orgnr) {
    if (orgnr.length !== 9) throw new UserError("orgnr must be exactly 9 digits", 400);
    return { q: orgnr, mode: "orgnr" };
  }
  if (name) {
    if (name.length < 2) throw new UserError("name too short", 400);
    return { q: name, mode: "name" };
  }
  throw new UserError("provide orgnr or name", 400);
}

function mapAddress(a: any) {
  if (!a || typeof a !== "object") return null;
  const lines = Array.isArray(a.adresse) ? a.adresse.filter(Boolean) : a.adresse ? [a.adresse] : [];
  return {
    address: lines.length ? lines.join(", ") : null,
    lines: lines.length ? lines : null,
    postal_code: a.postnummer || null,
    city: a.poststed || null,
    municipality: a.kommune || null,
    municipality_number: a.kommunenummer || null,
    country: a.land || null,
    country_code: a.landkode || null,
  };
}

function mapNaering(n: any) {
  if (!n || typeof n !== "object") return null;
  return { code: n.kode || null, description: n.beskrivelse || null };
}

function redFlags(r: any): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  if (r.konkurs === true) {
    flags.push({ code: "bankrupt", severity: "high", detail: "Marked konkurs (bankruptcy) in Enhetsregisteret" });
  }
  if (r.underAvvikling === true) {
    flags.push({ code: "under_liquidation", severity: "high", detail: "Marked underAvvikling (under liquidation)" });
  }
  if (r.underTvangsavviklingEllerTvangsopplosning === true) {
    flags.push({
      code: "forced_liquidation",
      severity: "high",
      detail: "Marked underTvangsavviklingEllerTvangsopplosning (forced liquidation/dissolution)",
    });
  }
  const addr = r.forretningsadresse;
  const hasAddr =
    addr &&
    ((Array.isArray(addr.adresse) && addr.adresse.some(Boolean)) ||
      addr.postnummer ||
      addr.poststed);
  if (!hasAddr) {
    flags.push({ code: "missing_address", severity: "medium", detail: "No forretningsadresse (business address) on file" });
  }
  return flags;
}

function statusLabel(r: any): string {
  if (r.konkurs === true) return "bankrupt";
  if (r.underTvangsavviklingEllerTvangsopplosning === true) return "forced_liquidation";
  if (r.underAvvikling === true) return "under_liquidation";
  return "active";
}

function slimRecord(r: any, lite = false) {
  const naeringskoder = [r.naeringskode1, r.naeringskode2, r.naeringskode3].map(mapNaering).filter(Boolean);
  const historiske = Array.isArray(r.historiskeNavn)
    ? r.historiskeNavn.map((h: any) => ({
        name: h.navn || null,
        from: h.fraDato || null,
        to: h.tilDato || null,
      }))
    : [];
  const out: any = {
    orgnr: r.organisasjonsnummer || null,
    name: r.navn || null,
    orgform: r.organisasjonsform
      ? { code: r.organisasjonsform.kode || null, description: r.organisasjonsform.beskrivelse || null }
      : null,
    status: statusLabel(r),
    konkurs: !!r.konkurs,
    underAvvikling: !!r.underAvvikling,
    underTvangsavviklingEllerTvangsopplosning: !!r.underTvangsavviklingEllerTvangsopplosning,
    forretningsadresse: mapAddress(r.forretningsadresse),
    postadresse: lite ? undefined : mapAddress(r.postadresse),
    naeringskode: mapNaering(r.naeringskode1),
    naeringskoder: lite ? naeringskoder.slice(0, 1) : naeringskoder,
    antallAnsatte: r.antallAnsatte ?? null,
    stiftelsesdato: r.stiftelsesdato || null,
    hjemmeside: r.hjemmeside || null,
    telefon: lite ? undefined : r.telefon || null,
    registreringsdatoEnhetsregisteret: r.registreringsdatoEnhetsregisteret || null,
    registrertIForetaksregisteret: r.registrertIForetaksregisteret ?? null,
    registrertIMvaregisteret: r.registrertIMvaregisteret ?? null,
    erIKonsern: lite ? undefined : r.erIKonsern ?? null,
    red_flags: redFlags(r),
  };
  if (!lite && historiske.length) out.historiskeNavn = historiske;
  if (!lite && r.kapital) out.kapital = r.kapital;
  if (!lite && Array.isArray(r.aktivitet)) out.aktivitet = r.aktivitet;
  if (lite) out.preview_omitted = ["historiskeNavn", "kapital", "aktivitet", "postadresse", "extra naeringskoder"];
  return out;
}

/** Norwegian company lookup via Brønnøysundregistrene Enhetsregisteret (free open data). */
export async function noCompany(input: { orgnr?: string; name?: string; q?: string; lite?: boolean; limit?: number }) {
  const { q, mode } = pickQuery(input);
  const lite = !!input.lite;
  const limit = Math.min(Math.max(Number(input.limit) || (mode === "name" ? 5 : 1), 1), 10);

  let url: string;
  let data: any;
  try {
    if (mode === "orgnr") {
      url = `${SEARCH}/${q}`;
      const r = await fetch(url, {
        headers: { accept: "application/json", "user-agent": UA },
        signal: AbortSignal.timeout(12000),
      });
      if (r.status === 404) throw new UserError(`no Norwegian company found for orgnr=${q}`, 404);
      if (r.status === 429) throw new UserError("Norwegian company API rate limited — retry shortly", 429);
      if (!r.ok) throw new Error(`brreg http ${r.status}`);
      data = await r.json();
      const primary = slimRecord(data, lite);
      return {
        product: "no-company",
        price: "$0.25",
        disclaimer: DISCLAIMER,
        query: { mode, q },
        total_results: 1,
        ...primary,
        source: "Brønnøysundregistrene Enhetsregisteret — open data (NLOD)",
        source_url: url,
        attribution: "Contains data from Brønnøysundregistrene Enhetsregisteret under the Norwegian Licence for Open Government Data (NLOD).",
        upsell: {
          kyb: { path: "/kyb", price: "$2.50", why: "attach NO registry into one-shot KYB with VAT + LEI + sanctions" },
          registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch NO orgnrs with UK/AU/CA/FR ids" },
          sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
        },
      };
    }

    url = `${SEARCH}?navn=${encodeURIComponent(q)}&size=${limit}`;
    const r = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (r.status === 429) throw new UserError("Norwegian company API rate limited — retry shortly", 429);
    if (!r.ok) throw new Error(`brreg http ${r.status}`);
    data = await r.json();
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    throw new Error(`Norwegian company lookup failed: ${e?.message || e}`);
  }

  const results = Array.isArray(data?._embedded?.enheter) ? data._embedded.enheter : [];
  if (!results.length) {
    throw new UserError(`no Norwegian company found for name=${q}`, 404);
  }

  const chosen = results[0];
  const primary = slimRecord(chosen, lite);
  const matches = results.slice(0, limit).map((r: any) => ({
    orgnr: r.organisasjonsnummer,
    name: r.navn,
    status: statusLabel(r),
    city: r.forretningsadresse?.poststed || null,
    orgform: r.organisasjonsform?.kode || null,
  }));

  return {
    product: "no-company",
    price: "$0.25",
    disclaimer: DISCLAIMER,
    query: { mode, q },
    total_results: data?.page?.totalElements ?? results.length,
    ...primary,
    matches,
    source: "Brønnøysundregistrene Enhetsregisteret — open data (NLOD)",
    source_url: url!,
    attribution: "Contains data from Brønnøysundregistrene Enhetsregisteret under the Norwegian Licence for Open Government Data (NLOD).",
    upsell: {
      kyb: { path: "/kyb", price: "$2.50", why: "attach NO registry into one-shot KYB with VAT + LEI + sanctions" },
      registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch NO orgnrs with UK/AU/CA/FR ids" },
      sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
    },
  };
}

export function noCompanySlim(d: any) {
  return {
    orgnr: d.orgnr,
    name: d.name,
    status: d.status,
    city: d.forretningsadresse?.city || null,
    orgform: d.orgform?.code || null,
    antallAnsatte: d.antallAnsatte ?? null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["forretningsadresse detail", "historiskeNavn", "kapital", "matches", "aktivitet"],
  };
}
