import { companyResearch } from "./company";
import { ukCompany } from "./uk-company";
import { ukCharity } from "./uk-charity";
import { frCompany } from "./fr-company";
import { noCompany } from "./no-company";
import { dkCompany } from "./dk-company";
import { luhnOk } from "./fr-company-id";
import type { KybRegistries } from "./kyb";

const UK_TLDS = /\.(co\.uk|org\.uk|me\.uk|gov\.uk|ac\.uk|uk)$/i;
const FR_TLDS = /\.fr$/i;
const NO_TLDS = /\.no$/i;
const DK_TLDS = /\.dk$/i;
const AU_TLDS = /\.(com\.au|net\.au|org\.au|edu\.au|gov\.au|au)$/i;
const CA_TLDS = /\.ca$/i;
const WELL_KNOWN_UK = /^(tesco|sainsbury|sainsburys|barclays|lloyds|bt|vodafone|easyjet|bbc|revolut|monzo|wise)$/i;
const LA_POSTE_SIREN = "356000000";

function extractPossibleName(company: any): string | null {
  const t = company?.homepage?.title || "";
  if (!t) return null;
  return t.split(/[|\-–—:]/)[0].trim().slice(0, 80) || null;
}

function findChNumberInText(text: string): string | null {
  for (const m of text.matchAll(/\b(?:company\s*(?:no\.?|number)|companies\s*house)[:\s#]*([A-Z]{0,2}\d{6,8})\b/gi)) {
    return m[1].toUpperCase();
  }
  const bare = text.match(/\b(SC\d{6}|NI\d{6}|OC\d{6}|SO\d{6}|\d{8})\b/);
  return bare ? bare[1] : null;
}

function findSirenInText(text: string): string | null {
  for (const m of text.matchAll(/\b(?:SIREN|n[°o]?\s*SIREN|RCS)[:\s#]*(\d{3}\s?\d{3}\s?\d{3})\b/gi)) {
    const d = m[1].replace(/\D/g, "");
    if (d.length === 9 && (d === LA_POSTE_SIREN || luhnOk(d))) return d;
  }
  for (const m of text.matchAll(/\b(?:SIRET)[:\s#]*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/gi)) {
    const d = m[1].replace(/\D/g, "");
    if (d.length === 14) {
      const siren = d.slice(0, 9);
      if (siren === LA_POSTE_SIREN || luhnOk(d) || luhnOk(siren)) return siren;
    }
  }
  return null;
}

function findSiretInText(text: string): string | null {
  for (const m of text.matchAll(/\b(?:SIRET)[:\s#]*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/gi)) {
    const d = m[1].replace(/\D/g, "");
    if (d.length === 14 && (d.slice(0, 9) === LA_POSTE_SIREN || luhnOk(d))) return d;
  }
  return null;
}

function findNoOrgnrInText(text: string): string | null {
  for (const m of text.matchAll(/\b(?:org\.?\s*nr\.?|organisasjonsnummer|brreg)[:\s#]*(\d{3}\s?\d{3}\s?\d{3})\b/gi)) {
    const d = m[1].replace(/\D/g, "");
    if (d.length === 9) return d;
  }
  return null;
}

function findDkCvrInText(text: string): string | null {
  for (const m of text.matchAll(/\b(?:CVR|CVR-?nr\.?|CVR\s*(?:no\.?|nummer))[:\s#]*(?:DK)?[\s-]*(\d{2}\s?\d{2}\s?\d{2}\s?\d{2}|\d{8})\b/gi)) {
    const d = m[1].replace(/\D/g, "");
    if (d.length === 8 && d[0] !== "0") return d;
  }
  return null;
}

function danishSignals(domain: string, blob: string, desc: string): boolean {
  return (
    DK_TLDS.test(domain) ||
    !!findDkCvrInText(blob) ||
    /\b(denmark|danish|danmark|dansk|cvr)\b/i.test(blob) ||
    /\bdenmark\b/i.test(desc)
  );
}

function findAuAcnOrAbn(text: string): { acn?: string; abn?: string } | null {
  for (const m of text.matchAll(/\bABN[:\s#]*(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b/gi)) {
    const d = m[1].replace(/\D/g, "");
    if (d.length === 11) return { abn: d };
  }
  for (const m of text.matchAll(/\bACN[:\s#]*(\d{3}\s?\d{3}\s?\d{3})\b/gi)) {
    const d = m[1].replace(/\D/g, "");
    if (d.length === 9) return { acn: d };
  }
  return null;
}

function findCaNumberOrBn(text: string): { number?: string; bn?: string } | null {
  for (const m of text.matchAll(/\b(?:corporation\s*(?:no\.?|number)|corp\.?\s*(?:no\.?|number)|federal\s*corporation)[:\s#]*(\d{1,8})\b/gi)) {
    return { number: m[1].replace(/\D/g, "") };
  }
  for (const m of text.matchAll(/\b(?:business\s*number|BN|GST\/HST)[:\s#]*(\d{9})(?:\s?[A-Z]{2}\s?\d{4})?\b/gi)) {
    const d = m[1].replace(/\D/g, "");
    if (d.length === 9) return { bn: d };
  }
  return null;
}

function frenchSignals(domain: string, blob: string, desc: string): boolean {
  return (
    FR_TLDS.test(domain) ||
    !!findSirenInText(blob) ||
    !!findSiretInText(blob) ||
    /\b(france|français|société|SIREN|SIRET|RCS)\b/i.test(blob) ||
    /\bfrance\b/i.test(desc)
  );
}

function norwegianSignals(domain: string, blob: string, desc: string): boolean {
  return (
    NO_TLDS.test(domain) ||
    !!findNoOrgnrInText(blob) ||
    /\b(norge|norwegian|brreg|organisasjonsnummer)\b/i.test(blob) ||
    /\bnorway\b/i.test(desc)
  );
}

export async function companyFull(env: any, opts: { domain: string }, reg: KybRegistries = {}) {
  const domain = opts.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  const sld = domain.split(".")[0].replace(/-/g, " ");
  let company: any = null;
  let company_error: string | null = null;
  try {
    company = await companyResearch({ domain });
  } catch (e: any) {
    company_error = e?.message || String(e);
    company = { domain, error: company_error, homepage: { title: sld } };
  }

  let uk: any = null;
  let uk_skip_reason: string | null = null;
  const blob = JSON.stringify({
    title: company.homepage?.title,
    desc: company.homepage?.description,
    pages: company.key_pages,
  }).slice(0, 50000);
  const desc = company.homepage?.description || "";

  const number = findChNumberInText(blob);
  const looksUk = UK_TLDS.test(domain) || /\buk\b/i.test(desc) || !!number || WELL_KNOWN_UK.test(sld);

  if (number) {
    try { uk = await ukCompany(env, { number }); }
    catch (e: any) { uk_skip_reason = `CH lookup failed: ${e?.message || e}`; }
  } else if (looksUk) {
    const name = extractPossibleName(company) || sld.toUpperCase();
    try { uk = await ukCompany(env, { name }); }
    catch (e: any) { uk_skip_reason = `CH name search failed: ${e?.message || e}`; }
  } else {
    uk_skip_reason = "No UK company signals (non-UK TLD and no Companies House number on site).";
  }

  let charity: any = null;
  let charity_skip_reason: string | null = null;
  const charityNum = (() => {
    for (const m of blob.matchAll(/\b(?:registered\s+)?charity(?:\s+(?:no\.?|number))?\s*[:#]?\s*(\d{5,7})\b/gi)) return m[1];
    return null;
  })();
  try {
    if (charityNum) {
      charity = await ukCharity(env, { number: charityNum });
    } else if (/charit/i.test(domain) || /charit/i.test(company.homepage?.title || "") || /charit/i.test(desc) || /registered charity/i.test(blob)) {
      const name = extractPossibleName(company) || sld;
      charity = await ukCharity(env, { name });
    } else {
      charity_skip_reason = "No charity signals (no registered charity number or charity keywords).";
    }
  } catch (e: any) {
    charity_skip_reason = `Charity lookup skipped: ${e?.message || e}`;
    charity = null;
  }

  let fr: any = null;
  let fr_skip_reason: string | null = null;
  const siren = findSirenInText(blob);
  const siret = findSiretInText(blob);
  const looksFr = frenchSignals(domain, blob, desc);
  try {
    if (siret) {
      fr = await frCompany({ siret, lite: true });
    } else if (siren) {
      fr = await frCompany({ siren, lite: true });
    } else if (FR_TLDS.test(domain) || (looksFr && /SIREN|SIRET|RCS|société|france/i.test(blob))) {
      const name = extractPossibleName(company) || sld;
      fr = await frCompany({ name, lite: true });
    } else {
      fr_skip_reason = "No French company signals (.fr TLD, SIREN/SIRET, or FR keywords).";
    }
  } catch (e: any) {
    fr_skip_reason = `FR lookup skipped: ${e?.message || e}`;
    fr = null;
  }

  let no: any = null;
  let no_skip_reason: string | null = null;
  const orgnr = findNoOrgnrInText(blob);
  const looksNo = norwegianSignals(domain, blob, desc);
  try {
    if (orgnr) {
      no = await noCompany({ orgnr, lite: true });
    } else if (NO_TLDS.test(domain) || (looksNo && /organisasjonsnummer|brreg|org\.?\s*nr/i.test(blob))) {
      const name = extractPossibleName(company) || sld;
      no = await noCompany({ name, lite: true });
    } else {
      no_skip_reason = "No Norwegian company signals (.no TLD, orgnr, or NO keywords).";
    }
  } catch (e: any) {
    no_skip_reason = `NO lookup skipped: ${e?.message || e}`;
    no = null;
  }

  let dk: any = null;
  let dk_skip_reason: string | null = null;
  const cvr = findDkCvrInText(blob);
  const looksDk = danishSignals(domain, blob, desc);
  try {
    if (cvr) {
      dk = await dkCompany({ cvr, lite: true });
    } else if (DK_TLDS.test(domain) || (looksDk && /\bcvr\b|denmark|danmark/i.test(blob))) {
      const titleGuess = extractPossibleName(company);
      const cleanedTitle = titleGuess
        ? titleGuess.replace(/^(velkommen\s+til|welcome\s+to|officiel(?:le)?\s+side\s+(?:for|til)?|official\s+site\s+of)\s+/i, "").trim()
        : null;
      // Prefer cleaned title (e.g. "Novo Nordisk Danmark"), then raw SLD
      const candidates = [cleanedTitle, titleGuess, sld.replace(/\s+/g, " ")].filter((x): x is string => !!x && x.length >= 2);
      let lastErr: any = null;
      for (const name of [...new Set(candidates)]) {
        try { dk = await dkCompany({ name, lite: true }); lastErr = null; break; }
        catch (e: any) { lastErr = e; }
      }
      if (!dk && lastErr) throw lastErr;
    } else {
      dk_skip_reason = "No Danish company signals (.dk TLD, CVR, or DK keywords).";
    }
  } catch (e: any) {
    dk_skip_reason = `DK lookup skipped: ${e?.message || e}`;
    dk = null;
  }

  let au: any = null;
  let au_skip_reason: string | null = null;
  const auId = findAuAcnOrAbn(blob);
  try {
    if (auId && reg.au) {
      au = await reg.au(auId);
    } else if (auId && !reg.au) {
      au_skip_reason = "ACN/ABN found but AU registry backend not bound.";
    } else if (AU_TLDS.test(domain)) {
      au_skip_reason = "Australian TLD detected but no ACN/ABN on page (AU attach needs identifier; use /au-company or /kyb?acn=).";
    } else {
      au_skip_reason = "No Australian company signals (.com.au TLD or ACN/ABN).";
    }
  } catch (e: any) {
    au_skip_reason = `AU lookup skipped: ${e?.message || e}`;
    au = null;
  }

  let ca: any = null;
  let ca_skip_reason: string | null = null;
  const caId = findCaNumberOrBn(blob);
  try {
    if (caId && reg.ca) {
      ca = await reg.ca(caId);
      if (ca?.matches) ca = ca.matches[0];
    } else if (caId && !reg.ca) {
      ca_skip_reason = "CA number/BN found but CA registry backend not bound.";
    } else if (CA_TLDS.test(domain)) {
      ca_skip_reason = "Canadian TLD detected but no corporation number/BN on page (CA attach needs identifier; use /ca-company or /kyb?ca_number=).";
    } else {
      ca_skip_reason = "No Canadian company signals (.ca TLD or corporation number/BN).";
    }
  } catch (e: any) {
    ca_skip_reason = `CA lookup skipped: ${e?.message || e}`;
    ca = null;
  }

  const attached = [
    uk && "UK CH",
    charity && "UK charity",
    fr && "FR",
    no && "NO",
    dk && "DK",
    au && "AU",
    ca && "CA",
  ].filter(Boolean);

  return {
    queried_at: new Date().toISOString(),
    domain,
    bundle: "company-full",
    price: "$0.65",
    savings_vs_separate: "Cheaper than /company + separate UK/FR/NO/DK/AU/CA/charity calls when those registries auto-attach",
    company,
    company_error,
    uk,
    uk_included: !!uk,
    uk_skip_reason,
    charity,
    charity_included: !!charity,
    charity_skip_reason,
    fr,
    fr_included: !!fr,
    fr_skip_reason,
    no,
    no_included: !!no,
    no_skip_reason,
    dk,
    dk_included: !!dk,
    dk_skip_reason,
    au,
    au_included: !!au,
    au_skip_reason,
    ca,
    ca_included: !!ca,
    ca_skip_reason,
    registries_attached: attached,
    note: attached.length
      ? `Includes company research + auto-attached registries: ${attached.join(", ")}. Soft-skipped jurisdictions list *_skip_reason.`
      : "Includes company research. UK/FR/NO/DK/AU/CA/charity packs attach when domain/page signals match; otherwise see *_skip_reason fields.",
  };
}
