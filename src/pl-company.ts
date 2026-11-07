import { UserError } from "./core";

const KRS_API = "https://api-krs.ms.gov.pl/api/krs/OdpisAktualny";
const MF_API = "https://wl-api.mf.gov.pl/api/search/nip";
const UA =
  "AgentReader/1.36 (+https://api.axiomworks.co.uk; Polish company research via KRS odpis + MF VAT whitelist)";
const DISCLAIMER =
  "Polish company profile from the National Court Register (KRS) current extract (Ministerstwo Sprawiedliwości api-krs.ms.gov.pl) with optional NIP→KRS via MF VAT whitelist. Screening aid only — not a KYB/AML determination, credit score, or legal advice. Person names/PESEL in representation are often partially redacted by the source (*); we return what we get and do not invent. Confirm identifiers at KRS / CEIDG before onboarding, contracting, or paying.";

const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

function digits(s: string): string {
  return String(s || "").replace(/\D/g, "");
}

/** Normalize KRS to 10 zero-padded digits. Rejects non-numeric / wrong length. */
export function normalizeKrs(raw: string): string {
  const d = digits(raw);
  if (!d || !/^\d+$/.test(d)) {
    throw new UserError("krs must be numeric (10 digits, zero-padded e.g. 0000001538)", 400);
  }
  if (d.length > 10) {
    throw new UserError("krs must be at most 10 digits", 400);
  }
  if (d.length < 1) {
    throw new UserError("krs required", 400);
  }
  // Accept shorter numeric and pad; require at least some digits that become 10
  const padded = d.padStart(10, "0");
  if (padded.length !== 10 || !/^\d{10}$/.test(padded)) {
    throw new UserError("krs must be 10 zero-padded digits (e.g. 0000001538)", 400);
  }
  return padded;
}

/** Normalize Polish NIP to 10 digits with mod-11 check. */
export function normalizeNip(raw: string): string {
  let cleaned = String(raw || "").replace(/[\s\-.]/g, "").toUpperCase();
  if (cleaned.startsWith("PL")) cleaned = cleaned.slice(2);
  const nip = digits(cleaned);
  if (nip.length !== 10) {
    throw new UserError("nip must be exactly 10 digits (optional PL prefix)", 400);
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (nip.charCodeAt(i) - 48) * NIP_WEIGHTS[i];
  const rem = sum % 11;
  if (rem === 10 || nip[9] !== String(rem)) {
    throw new UserError(`invalid Polish NIP check digit for ${nip.slice(0, 9)}?`, 400);
  }
  return nip;
}

/** Soft NIP check for page scraping — returns null if invalid. */
export function nipCheckDigitOk(nip10: string): boolean {
  if (!/^\d{10}$/.test(nip10)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (nip10.charCodeAt(i) - 48) * NIP_WEIGHTS[i];
  const rem = sum % 11;
  return rem !== 10 && nip10[9] === String(rem);
}

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatSeat(siedziba: any): string | null {
  if (!siedziba || typeof siedziba !== "object") return null;
  const parts = [siedziba.miejscowosc, siedziba.wojewodztwo, siedziba.kraj].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function formatAddress(adres: any, siedziba?: any): string | null {
  if (!adres || typeof adres !== "object") return formatSeat(siedziba);
  const street = [adres.ulica, adres.nrDomu, adres.nrLokalu].filter(Boolean).join(" ").trim();
  const cityLine = [adres.kodPocztowy, adres.miejscowosc || adres.poczta].filter(Boolean).join(" ");
  const parts = [street, cityLine, adres.kraj].filter(Boolean);
  return parts.length ? parts.join(", ") : formatSeat(siedziba);
}

function personName(p: any): string | null {
  if (!p || typeof p !== "object") return null;
  const imiona = p.imiona || {};
  const nazwisko = p.nazwisko || {};
  const first = [imiona.imie, imiona.imieDrugie].filter(Boolean).join(" ").trim();
  const last = [nazwisko.nazwiskoICzlon, nazwisko.nazwiskoIICzlon].filter(Boolean).join(" ").trim();
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || null;
}

function mapPerson(p: any) {
  return {
    name: personName(p),
    role: p.funkcjaWOrganie || p.rodzajProkury || null,
    suspended: !!p.czyZawieszona,
    // PESEL often fully redacted; still expose presence only if non-redacted digits exist
    has_pesel: !!(p.identyfikator?.pesel && /\d/.test(String(p.identyfikator.pesel))),
  };
}

function mapPkd(przedmiot: any, lite = false) {
  if (!przedmiot || typeof przedmiot !== "object") return { primary: [], other: [] };
  const mapOne = (x: any) => ({
    code: [x.kodDzial, x.kodKlasa, x.kodPodklasa].filter(Boolean).join(".") || null,
    description: x.opis ? String(x.opis).slice(0, lite ? 180 : 800) : null,
  });
  const primary = Array.isArray(przedmiot.przedmiotPrzewazajacejDzialalnosci)
    ? przedmiot.przedmiotPrzewazajacejDzialalnosci.map(mapOne)
    : [];
  const other = Array.isArray(przedmiot.przedmiotPozostalejDzialalnosci)
    ? przedmiot.przedmiotPozostalejDzialalnosci.map(mapOne)
    : [];
  return {
    primary: lite ? primary.slice(0, 1) : primary.slice(0, 5),
    other: lite ? other.slice(0, 2) : other.slice(0, 15),
  };
}

function mapCapital(kapital: any) {
  if (!kapital || typeof kapital !== "object") return null;
  const zak = kapital.wysokoscKapitaluZakladowego;
  return {
    share_capital: zak?.wartosc || null,
    currency: zak?.waluta || null,
    shares: kapital.lacznaLiczbaAkcjiUdzialow || null,
    share_value: kapital.wartoscJednejAkcji?.wartosc || null,
    paid_in: kapital.czescKapitaluWplaconegoPokrytego?.wartosc || null,
  };
}

function mapRepresentation(dzial2: any, lite = false) {
  if (!dzial2 || typeof dzial2 !== "object") {
    return { organ: null, manner: null, board: [], supervisory: [], prokurenci: [] };
  }
  const rep = dzial2.reprezentacja || {};
  const board = Array.isArray(rep.sklad) ? rep.sklad.map(mapPerson) : [];
  const nadzor = Array.isArray(dzial2.organNadzoru) ? dzial2.organNadzoru : [];
  const supervisory: any[] = [];
  for (const org of nadzor) {
    const members = Array.isArray(org?.sklad) ? org.sklad.map(mapPerson) : [];
    for (const m of members) supervisory.push({ ...m, organ: org?.nazwa || null });
  }
  const prok = Array.isArray(dzial2.prokurenci) ? dzial2.prokurenci.map(mapPerson) : [];
  if (lite) {
    return {
      organ: rep.nazwaOrganu || null,
      manner: rep.sposobReprezentacji ? String(rep.sposobReprezentacji).slice(0, 280) : null,
      board: board.slice(0, 3),
      supervisory: supervisory.slice(0, 2),
      prokurenci: prok.slice(0, 1),
    };
  }
  return {
    organ: rep.nazwaOrganu || null,
    manner: rep.sposobReprezentacji || null,
    board: board.slice(0, 25),
    supervisory: supervisory.slice(0, 25),
    prokurenci: prok.slice(0, 25),
  };
}

function redFlags(opts: {
  website: string | null;
  opp: boolean | null;
  capital: any;
  pkd: any;
  seat: string | null;
  address: string | null;
}): { code: string; severity: string; detail: string }[] {
  const flags: { code: string; severity: string; detail: string }[] = [];
  if (!opts.website) {
    flags.push({ code: "missing_website", severity: "low", detail: "No website on KRS extract" });
  }
  if (!opts.address && !opts.seat) {
    flags.push({ code: "missing_address", severity: "medium", detail: "No seat/address on KRS extract" });
  }
  if (opts.opp === true) {
    flags.push({
      code: "opp_status",
      severity: "low",
      detail: "Entity has OPP (public benefit organisation) status — confirm scope before treating as commercial KYB",
    });
  }
  if (!opts.pkd?.primary?.length && !opts.pkd?.other?.length) {
    flags.push({ code: "missing_pkd", severity: "low", detail: "No PKD / activity codes on extract" });
  }
  return flags;
}

async function fetchOdpis(krs: string): Promise<{ data: any; register: "A" | "B"; url: string }> {
  for (const s of ["A", "B"] as const) {
    const url = `${KRS_API}/${krs}?s=${s}`;
    const r = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(15000),
    });
    if (r.status === 404) continue;
    if (r.status === 429) throw new UserError("KRS API rate limited — retry shortly", 429);
    if (!r.ok) throw new Error(`krs odpis http ${r.status}`);
    const data = await r.json();
    return { data, register: s, url };
  }
  throw new UserError(`no Polish KRS extract found for krs=${krs} (tried registers A and B)`, 404);
}

async function mfLookupByNip(nip: string): Promise<any> {
  const date = todayIsoDate();
  const url = `${MF_API}/${nip}?date=${date}`;
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
    signal: AbortSignal.timeout(12000),
  });
  if (r.status === 404) throw new UserError(`no MF whitelist subject found for nip=${nip}`, 404);
  if (r.status === 429) throw new UserError("MF whitelist API rate limited — retry shortly", 429);
  if (!r.ok) throw new Error(`mf whitelist http ${r.status}`);
  const data: any = await r.json();
  const subject = data?.result?.subject;
  if (!subject) throw new UserError(`no MF whitelist subject found for nip=${nip}`, 404);
  return { subject, url, request_id: data?.result?.requestId || null };
}

function slimFromOdpis(odpis: any, register: "A" | "B", lite = false, mf?: any) {
  const nag = odpis?.naglowekA || {};
  const dzial1 = odpis?.dane?.dzial1 || {};
  const podmiot = dzial1.danePodmiotu || {};
  const ids = podmiot.identyfikatory || {};
  const siedzibaIAdres = dzial1.siedzibaIAdres || {};
  const pkd = mapPkd(odpis?.dane?.dzial3?.przedmiotDzialalnosci, lite);
  const capital = mapCapital(dzial1.kapital);
  const representation = mapRepresentation(odpis?.dane?.dzial2, lite);
  const website = siedzibaIAdres.adresStronyInternetowej
    ? String(siedzibaIAdres.adresStronyInternetowej).trim() || null
    : null;
  const email = siedzibaIAdres.adresPocztyElektronicznej
    ? String(siedzibaIAdres.adresPocztyElektronicznej).trim() || null
    : null;
  const seat = formatSeat(siedzibaIAdres.siedziba);
  const address = formatAddress(siedzibaIAdres.adres, siedzibaIAdres.siedziba);
  const opp = typeof podmiot.czyPosiadaStatusOPP === "boolean" ? podmiot.czyPosiadaStatusOPP : null;

  const out: any = {
    name: podmiot.nazwa || null,
    krs: nag.numerKRS || null,
    nip: ids.nip || (mf?.nip ? String(mf.nip) : null) || null,
    regon: ids.regon || (mf?.regon ? String(mf.regon) : null) || null,
    legal_form: podmiot.formaPrawna || null,
    register: register === "A" ? "Rejestr Przedsiębiorców (A)" : "Rejestr Stowarzyszeń (B)",
    register_code: register,
    status_hint: odpis?.rodzaj === "Aktualny" ? "current_extract" : odpis?.rodzaj || "unknown",
    opp_status: opp,
    seat,
    address,
    address_detail: lite
      ? undefined
      : siedzibaIAdres.adres
        ? {
            street: siedzibaIAdres.adres.ulica || null,
            house_number: siedzibaIAdres.adres.nrDomu || null,
            unit: siedzibaIAdres.adres.nrLokalu || null,
            postcode: siedzibaIAdres.adres.kodPocztowy || null,
            city: siedzibaIAdres.adres.miejscowosc || null,
            country: siedzibaIAdres.adres.kraj || null,
          }
        : null,
    website,
    email,
    capital: lite
      ? capital
        ? { share_capital: capital.share_capital, currency: capital.currency }
        : null
      : capital,
    activities: pkd,
    representation: lite
      ? { organ: representation.organ, manner: representation.manner, board_count: representation.board.length }
      : representation,
    registration_date: nag.dataRejestracjiWKRS || null,
    last_entry_date: nag.dataOstatniegoWpisu || null,
    last_entry_number: nag.numerOstatniegoWpisu ?? null,
    extract_as_of: nag.stanZDnia || null,
    extract_generated: nag.dataCzasOdpisu || null,
    court_last_entry: nag.oznaczenieSaduDokonujacegoOstatniegoWpisu || null,
    country: "PL",
    red_flags: redFlags({ website, opp, capital, pkd, seat, address }),
  };
  if (mf) {
    out.mf_vat_status = mf.statusVat || null;
    out.mf_residence_address = mf.residenceAddress || null;
    out.mf_name = mf.name || null;
  }
  if (lite) {
    out.preview_omitted = ["full representation lists", "address_detail", "full PKD other", "branches"];
  }
  return out;
}

const UPSELL = {
  kyb: { path: "/kyb", price: "$2.50", why: "attach PL KRS/NIP into one-shot KYB with VAT + LEI + sanctions" },
  registry_batch: { path: "/registry-batch", price: "$0.30", why: "batch PL KRS with UK/AU/CA/FR/NO/DK/FI/CH ids" },
  eu_vat: { path: "/eu-vat", price: "$0.01", why: "validate PL VAT via VIES" },
  sanctions: { path: "/sanctions", price: "$0.05", why: "screen entity name" },
  nip_pl: { path: "/nip-pl", price: "$0.001", why: "offline Polish NIP check-digit only (no registry)" },
};

/** Polish company lookup via KRS current extract (+ optional MF NIP→KRS). No free-text name search. */
export async function plCompany(input: {
  krs?: string;
  nip?: string;
  number?: string;
  pl?: string;
  lite?: boolean;
  preview?: boolean;
}) {
  const lite = !!(input.lite || input.preview);
  // pl= and number= are KRS aliases (registry-batch / path alias). nip= is separate (MF hop).
  const rawKrs = String(input.krs || input.number || input.pl || "").trim();
  const rawNip = String(input.nip || "").trim();

  let krs: string | null = null;
  let nip: string | null = null;
  let mfSubject: any = null;
  let mode: "krs" | "nip";

  if (rawKrs) {
    krs = normalizeKrs(rawKrs);
    mode = "krs";
    if (rawNip) {
      try { nip = normalizeNip(rawNip); } catch { /* optional companion nip */ }
    }
  } else if (rawNip) {
    nip = normalizeNip(rawNip);
    mode = "nip";
  } else {
    throw new UserError("provide krs (10-digit) or nip (10-digit). Free-text name search is not available for Poland — use KRS or NIP.", 400);
  }

  try {
    if (mode === "nip" && !krs) {
      const mf = await mfLookupByNip(nip!);
      mfSubject = mf.subject;
      const mfKrs = digits(String(mfSubject.krs || ""));
      if (!mfKrs) {
        throw new UserError(`MF whitelist has no KRS for nip=${nip} (may be CEIDG sole trader — KRS extract unavailable)`, 404);
      }
      krs = normalizeKrs(mfKrs);
    }

    const { data, register, url } = await fetchOdpis(krs!);
    const odpis = data?.odpis;
    if (!odpis) throw new UserError(`empty KRS extract for krs=${krs}`, 404);

    // MF subject already set on nip→krs hop; optional soft attach if caller also passed nip with krs
    if (!mfSubject && nip) {
      try {
        const mf = await mfLookupByNip(nip);
        mfSubject = mf.subject;
      } catch { /* soft */ }
    }

    const primary = slimFromOdpis(odpis, register, lite, mfSubject);
    return {
      product: "pl-company",
      price: "$0.25",
      disclaimer: DISCLAIMER,
      query: { mode, krs, nip: nip || primary.nip || null },
      ...primary,
      source: "KRS Odpis Aktualny (Ministerstwo Sprawiedliwości) + optional MF VAT whitelist",
      source_url: url,
      attribution:
        "Contains data from the Polish National Court Register (KRS) and, when used, the MF VAT whitelist. Confirm at ekrs.ms.gov.pl / CEIDG before acting.",
      upsell: UPSELL,
    };
  } catch (e: any) {
    if (e instanceof UserError) throw e;
    throw new Error(`Polish company lookup failed: ${e?.message || e}`);
  }
}

export function plCompanySlim(d: any) {
  return {
    krs: d.krs,
    nip: d.nip || null,
    name: d.name,
    legal_form: d.legal_form || null,
    seat: d.seat || null,
    status_hint: d.status_hint || null,
    mf_vat_status: d.mf_vat_status || null,
    red_flags: (d.red_flags || []).slice(0, 2),
    omitted: ["representation detail", "address_detail", "full activities", "capital detail"],
  };
}
