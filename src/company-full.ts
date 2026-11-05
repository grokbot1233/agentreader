import { companyResearch } from "./company";
import { ukCompany } from "./uk-company";

const UK_TLDS = /\.(co\.uk|org\.uk|me\.uk|gov\.uk|ac\.uk|uk)$/i;
const WELL_KNOWN_UK = /^(tesco|sainsbury|sainsburys|barclays|lloyds|bt|vodafone|easyjet|bbc|revolut|monzo|wise)$/i;

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

export async function companyFull(env: any, opts: { domain: string }) {
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

  const number = findChNumberInText(blob);
  const looksUk = UK_TLDS.test(domain) || /\buk\b/i.test(company.homepage?.description || "") || !!number || WELL_KNOWN_UK.test(sld);

  if (number) {
    try { uk = await ukCompany(env, { number }); }
    catch (e: any) { uk_skip_reason = `CH lookup failed: ${e?.message || e}`; }
  } else if (looksUk) {
    const name = extractPossibleName(company) || sld.toUpperCase();
    try { uk = await ukCompany(env, { name }); }
    catch (e: any) { uk_skip_reason = `CH name search failed: ${e?.message || e}`; }
  } else {
    uk_skip_reason = "No UK company signals (non-UK TLD and no Companies House number on site). company research only; still charged at bundle rate.";
  }

  return {
    queried_at: new Date().toISOString(),
    domain,
    bundle: "company-full",
    price: "$0.65",
    savings_vs_separate: "$0.10 off $0.25+$0.50",
    company,
    company_error,
    uk,
    uk_included: !!uk,
    uk_skip_reason,
    note: uk
      ? "Includes company research + UK Companies House due-diligence pack."
      : "Includes company research. UK pack attached when a UK company is detected; otherwise see uk_skip_reason.",
  };
}
