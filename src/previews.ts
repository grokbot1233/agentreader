import { CANONICAL } from "./facilitator";

const PREVIEW_LIMIT = 8; // per IP per UTC day across all preview kinds
const PREVIEW_PREFIX = "prev:";

export type PreviewKind = "headers" | "iban" | "phone" | "meta" | "redirects" | "dns" | "au-company" | "ca-company" | "fr-company" | "no-company" | "dk-company" | "fi-company" | "ch-company" | "pl-company" | "cz-company" | "be-company" | "sk-company" | "us-entity" | "registry-batch" | "domain" | "email-check" | "read" | "links" | "check" | "company" | "uk-company" | "uk-company-lite" | "convert" | "company-full" | "uk-charity" | "uk-charity-full" | "us-sec" | "us-sec-full" | "eu-vat" | "lei" | "lei-full" | "read-batch" | "uk-leads" | "uk-leads-lite" | "uk-leads-feed" | "kyb" | "uk-dd" | "uk-watch" | "sanctions" | "sanctions-batch" | "uk-officer" | "uk-property" | "uk-area" | "uk-postcode" | "siren" | "siret" | "partita-iva" | "orgnr" | "bn-ca" | "cvr" | "fn-at" | "cin-in" | "kvk-nl" | "hr-de" | "nif-es" | "cnpj" | "nip-pl" | "uid-ch";

const PRICE: Record<PreviewKind, string> = {
  read: "$0.002", links: "$0.001", check: "$0.001",
  company: "$0.25", "uk-company": "$0.50", "uk-company-lite": "$0.05",
  convert: "$0.03", "company-full": "$0.65",
  "uk-charity": "$0.05", "uk-charity-full": "$0.25",
  "us-sec": "$0.05", "us-sec-full": "$0.25", "eu-vat": "$0.01", "lei": "$0.005", "lei-full": "$0.05", "read-batch": "$0.015",
  "uk-leads": "$1.00", "uk-leads-lite": "$0.25", "uk-leads-feed": "$25.00", kyb: "$2.50", "uk-dd": "$1.00", "uk-watch": "$5.00", "email-check": "$0.002", domain: "$0.002", dns: "$0.001", redirects: "$0.001", meta: "$0.001", headers: "$0.001", iban: "$0.001", phone: "$0.001", "au-company": "$0.02", "ca-company": "$0.02", "fr-company": "$0.25", "no-company": "$0.25", "dk-company": "$0.25", "fi-company": "$0.25", "ch-company": "$0.25", "pl-company": "$0.25", "cz-company": "$0.25", "be-company": "$0.25", "sk-company": "$0.25", "us-entity": "$0.25", "registry-batch": "$0.30",
  sanctions: "$0.05", "sanctions-batch": "$1.00",
  "uk-officer": "$0.15",
  "uk-property": "$0.01", "uk-area": "$0.005", "uk-postcode": "$0.001", siren: "$0.001", siret: "$0.001", "partita-iva": "$0.001", orgnr: "$0.001", "bn-ca": "$0.001", cvr: "$0.001", "fn-at": "$0.001", "cin-in": "$0.001", "kvk-nl": "$0.001", "hr-de": "$0.001", "nif-es": "$0.001", cnpj: "$0.001", "nip-pl": "$0.001", "uid-ch": "$0.001",
};

const PAID_CALL: Record<PreviewKind, string> = {
  read: `${CANONICAL}/read?url=URL`,
  links: `${CANONICAL}/links?url=URL`,
  check: `${CANONICAL}/check?domain=DOMAIN`,
  company: `${CANONICAL}/company?domain=DOMAIN`,
  "uk-company": `${CANONICAL}/uk-company?number=NUM` ,
  "uk-company-lite": `${CANONICAL}/uk-company-lite?number=NUM`,
  convert: `${CANONICAL}/convert?url=https://pdfobject.com/pdf/sample.pdf`,
  "company-full": `${CANONICAL}/company-full?domain=DOMAIN`,
  "uk-charity": `${CANONICAL}/uk-charity?number=NUM`,
  "uk-charity-full": `${CANONICAL}/uk-charity-full?number=NUM`,
  "us-sec": `${CANONICAL}/us-sec?ticker=TICKER`,
  "us-sec-full": `${CANONICAL}/us-sec-full?ticker=TICKER`,
  "eu-vat": `${CANONICAL}/eu-vat?vat=VAT`,
  "lei": `${CANONICAL}/lei?lei=HWUPKR0MPOU8FGXBT394`,
  "lei-full": `${CANONICAL}/lei-full?name=Apple+Inc.`,
  "read-batch": `${CANONICAL}/read-batch?urls=https://example.com,https://example.org`,
  "uk-leads": `${CANONICAL}/uk-leads?sic=62012`, "uk-leads-lite": `${CANONICAL}/uk-leads-lite?sic=62`, "uk-leads-feed": `POST ${CANONICAL}/uk-leads-feed {sic,webhook}`, "email-check": `${CANONICAL}/email-check?email=info@stripe.com`, domain: `${CANONICAL}/domain?domain=stripe.com`, dns: `${CANONICAL}/dns?name=example.com`, redirects: `${CANONICAL}/redirects?url=https://example.com`, meta: `${CANONICAL}/meta?url=https://example.com`, headers: `${CANONICAL}/headers?url=https://example.com`, iban: `${CANONICAL}/iban?iban=GB82WEST12345698765432`, phone: `${CANONICAL}/phone?phone=%2B447911123456`, "au-company": `${CANONICAL}/au-company?acn=004028077`, "ca-company": `${CANONICAL}/ca-company?number=8660115`, "fr-company": `${CANONICAL}/fr-company?siren=443061841`, "no-company": `${CANONICAL}/no-company?orgnr=923609016`, "dk-company": `${CANONICAL}/dk-company?cvr=24256790`, "fi-company": `${CANONICAL}/fi-company?businessId=0112038-9`, "ch-company": `${CANONICAL}/ch-company?uid=CHE-105.909.036`, "pl-company": `${CANONICAL}/pl-company?krs=0000001538`, "cz-company": `${CANONICAL}/cz-company?ico=27082440`, "be-company": `${CANONICAL}/be-company?enterprise_number=0202239951`, "sk-company": `${CANONICAL}/sk-company?ico=31322832`, "us-entity": `${CANONICAL}/us-entity?name=Etsy+Inc`, "registry-batch": `${CANONICAL}/registry-batch?no=923609016&us=NY:3368051,OR:8739914,CT:2590243`, kyb: `${CANONICAL}/kyb?domain=tesco.com&number=00445790`,
  "uk-dd": `${CANONICAL}/uk-dd?number=00445790`,
  "uk-watch": `POST ${CANONICAL}/uk-watch {number,webhook}`,
  sanctions: `${CANONICAL}/sanctions?name=BANCO+NACIONAL+DE+CUBA`, "sanctions-batch": `${CANONICAL}/sanctions-batch`,
  "uk-officer": `${CANONICAL}/uk-officer?name=Ken+Olisa`,
  "uk-property": `${CANONICAL}/uk-property?postcode=CB1+2AB`,
  "uk-area": `${CANONICAL}/uk-area?postcode=SW1A+2AA`,
  "uk-postcode": `${CANONICAL}/uk-postcode?postcode=SW1A+2AA`,
  siren: `${CANONICAL}/siren?siren=732829320`,
  siret: `${CANONICAL}/siret?siret=73282932000074`,
  "partita-iva": `${CANONICAL}/partita-iva?vat=00488410010`,
  orgnr: `${CANONICAL}/orgnr?orgnr=556012-5790`,
  "bn-ca": `${CANONICAL}/bn-ca?bn=123456789RT0001`,
  cvr: `${CANONICAL}/cvr?cvr=10403782`,
  "fn-at": `${CANONICAL}/fn-at?fn=FN%20575737y`,
  "kvk-nl": `${CANONICAL}/kvk-nl?kvk=69599084`,
  "hr-de": `${CANONICAL}/hr-de?hr=HRB%206684`,
  "nif-es": `${CANONICAL}/nif-es?nif=A28015865`,
  cnpj: `${CANONICAL}/cnpj?cnpj=33000167000101`,
  "nip-pl": `${CANONICAL}/nip-pl?nip=5261040828`,
  "uid-ch": `${CANONICAL}/uid-ch?uid=CHE-109.322.551`,
  "cin-in": `${CANONICAL}/cin-in?cin=U72200KA2013PTC097389`,
};

// Temporary partner allowlist (SwarmMemo, github.com/Hugo0/swarmmemo/issues/49).
// Exempt from the shared preview cap ONLY until expiry; normal limits apply after.
const PREVIEW_ALLOWLIST_EXPIRES = Date.parse("2026-11-13T23:59:59Z");
const PREVIEW_ALLOWLIST = new Set(["2.28.121.78", "2a01:04f8:1c1e:cbe0:0000:0000:0000:0001"]);

function normIp(ip: string): string {
  ip = (ip || "").trim().toLowerCase();
  if (!ip.includes(":")) return ip;
  const [h, t] = ip.split("::");
  const head = h ? h.split(":") : [];
  const tail = t !== undefined && t ? t.split(":") : [];
  const fill = ip.includes("::") ? Array(8 - head.length - tail.length).fill("0") : [];
  return [...head, ...fill, ...tail].map((x) => x.padStart(4, "0")).join(":");
}

export function isPreviewAllowlisted(ip: string, now = Date.now()): boolean {
  return now <= PREVIEW_ALLOWLIST_EXPIRES && PREVIEW_ALLOWLIST.has(normIp(ip));
}

function dayKey() { return new Date().toISOString().slice(0, 10); }

export async function checkPreviewQuota(env: { LOG: KVNamespace }, ip: string): Promise<{ ok: true; remaining: number; kv_write?: boolean } | { ok: false; error: string; reset: string }> {
  if (isPreviewAllowlisted(ip)) return { ok: true, remaining: PREVIEW_LIMIT, kv_write: false };
  const key = `${PREVIEW_PREFIX}${dayKey()}:${ip || "unknown"}`;
  let cur = 0;
  try {
    cur = Number((await env.LOG.get(key)) || "0");
  } catch {
    // KV read failure: fail-open so free previews still work for discovery.
    return { ok: true, remaining: PREVIEW_LIMIT, kv_write: false };
  }
  if (cur >= PREVIEW_LIMIT) {
    return { ok: false, error: `preview rate limit (${PREVIEW_LIMIT}/IP/day). Full reports via x402.`, reset: `${dayKey()}T23:59:59Z` };
  }
  try {
    await env.LOG.put(key, String(cur + 1), { expirationTtl: 172800 });
    return { ok: true, remaining: PREVIEW_LIMIT - cur - 1, kv_write: true };
  } catch {
    // CF free-tier KV daily put limit (or transient write error): fail-open, do not 500.
    return { ok: true, remaining: PREVIEW_LIMIT - cur, kv_write: false };
  }
}

export function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  const cf = c.req.header("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

function upsell(kind: PreviewKind, exampleCall: string) {
  return {
    preview: true,
    truncated: true,
    full_report_price: PRICE[kind],
    full_report_via: "x402 (USDC on Base, HTTP 402 → PAYMENT-SIGNATURE retry)",
    paid_call: exampleCall,
    note: "This is a truncated free sample. Pay via x402 for the complete structured JSON with all fields and sources.",
  };
}

/** Hard truncation: never return the full paid payload. */
export function truncateSample(kind: PreviewKind, data: any, exampleCall?: string): any {
  const u = upsell(kind, exampleCall || PAID_CALL[kind]);
  switch (kind) {
    case "read":
      return {
        ...u,
        url: data.url, title: data.title, word_count: data.word_count, language: data.language,
        markdown_preview: String(data.markdown || "").slice(0, 400) + (data.markdown?.length > 400 ? "…" : ""),
        links_count: data.links_count, links_sample: (data.links || []).slice(0, 3),
        omitted: ["full markdown", "full links array", "author/published details"],
      };
    case "links":
      return {
        ...u, url: data.url, count: data.count,
        links_sample: (data.links || []).slice(0, 5),
        omitted: [`${Math.max(0, (data.count || 0) - 5)} additional links`],
      };
    case "check":
      return {
        ...u, domain: data.domain, score: data.score,
        issues_sample: (data.issues || []).slice(0, 3),
        tls_ok: data.tls?.ok ?? data.tls?.reachable ?? null,
        has_mx: Array.isArray(data.email?.mx) ? data.email.mx.length > 0 : null,
        omitted: ["full DNS records", "full TLS/HTTP details", "SPF/DMARC bodies"],
      };
    case "company":
      return {
        ...u, domain: data.domain,
        homepage: { title: data.homepage?.title, description: (data.homepage?.description || "").slice(0, 160) || null },
        tech_stack_sample: (data.tech_stack?.detected || []).slice(0, 5),
        social_networks: Object.keys(data.social_links || {}).filter((k) => k !== "source" && (data.social_links as any)[k]),
        contacts: { email_count: (data.contacts?.emails || []).length, phone_count: (data.contacts?.phones || []).length },
        dns: { mx_count: (data.dns?.mx || []).length, spf: !!(data.dns?.spf || []).length, dmarc_policy: data.dns?.dmarc_policy || null },
        domain_registration: { registrar: data.domain_registration?.registrar || null, created: data.domain_registration?.registered || data.domain_registration?.created || null },
        news_sample: (data.news?.headlines || []).slice(0, 1).map((h: any) => ({ title: h.title || h })),
        omitted: ["full emails/phones", "key_pages bodies", "full news", "raw sources", "ssl details", "sitemap urls"],
      };
    case "uk-company":
      return {
        ...u,
        company_number: data.company_number || data.profile?.company_number,
        name: data.profile?.name || data.name,
        status: data.profile?.status || data.status,
        sic_codes: (data.profile?.sic_codes || data.sic_codes || []).slice(0, 3),
        officers_count: data.officers?.total_results ?? data.officers?.items?.length ?? null,
        charges_outstanding: data.charges?.outstanding ?? null,
        red_flag_names: (data.red_flags || []).map((f: any) => f.flag),
        mass_formation_office: data.mass_formation_office?.matched ? { matched: true, label: data.mass_formation_office.label } : { matched: false },
        omitted: ["officer names/details", "PSC details", "filing history", "charge particulars", "insolvency cases", "full compliance dates"],
      };
    case "uk-company-lite":
      return {
        ...u,
        company_number: data.company_number, name: data.name, status: data.status,
        incorporation_date: data.incorporation_date,
        red_flag_names: (data.red_flags || []).map((f: any) => f.flag),
        accounts_overdue: data.compliance?.accounts_overdue ?? null,
        omitted: ["registered office full text", "SIC list", "mass-formation address", "compliance date detail"],
      };
    case "convert":
      return {
        ...u, url: data.url, detected_format: data.detected_format, title: data.title,
        pages: data.pages, word_count: data.word_count,
        text_preview: String(data.markdown || data.text || "").slice(0, 350) + "…",
        omitted: ["full markdown/text body"],
      };
    case "uk-charity":
      return {
        ...u,
        name: data.name,
        status: data.status,
        income: data.income,
        spending: data.spending,
        trustees_count: data.trustees_count,
        website: data.contact?.website || null,
        activities_preview: data.activities ? String(data.activities).slice(0, 180) + (String(data.activities).length > 180 ? "…" : "") : null,
        omitted: ["full activities", "classifications detail"],
      };
    case "uk-charity-full":
      return {
        ...u,
        name: data.name,
        status: data.status,
        trustees_preview: (data.trustees || []).slice(0, 2),
        financial_history_years: Array.isArray(data.financial_history) ? data.financial_history.length : 0,
        red_flag_count: data.red_flag_count ?? (data.red_flags || []).length,
        red_flags_preview: (data.red_flags || []).slice(0, 2),
        omitted: ["full trustees", "full financial_history", "assets", "governance", "linked charities"],
      };
    case "company-full":
      return {
        ...u, domain: data.domain,
        company_preview: data.company ? truncateSample("company", data.company, PAID_CALL.company) : null,
        uk_preview: data.uk ? truncateSample("uk-company", data.uk, PAID_CALL["uk-company"]) : { included: false, reason: data.uk_skip_reason || "no UK company detected" },
        charity_preview: data.charity ? { name: data.charity.name, status: data.charity.status, registered_number: data.charity.registered_number } : { included: false, reason: data.charity_skip_reason || "no charity signals" },
        fr_preview: data.fr ? { siren: data.fr.siren, name: data.fr.name, status: data.fr.status } : { included: false, reason: data.fr_skip_reason || "no FR signals" },
        no_preview: data.no ? { orgnr: data.no.orgnr, name: data.no.name, status: data.no.status } : { included: false, reason: data.no_skip_reason || "no NO signals" },
        dk_preview: data.dk ? { cvr: data.dk.cvr, name: data.dk.name, status: data.dk.status } : { included: false, reason: data.dk_skip_reason || "no DK signals" },
        fi_preview: data.fi ? { business_id: data.fi.business_id, name: data.fi.name, status: data.fi.status, city: data.fi.city } : { included: false, reason: data.fi_skip_reason || "no FI signals" },
        au_preview: data.au ? { acn: data.au.acn || data.au.ACN, name: data.au.name, status: data.au.status } : { included: false, reason: data.au_skip_reason || "no AU signals" },
        ca_preview: data.ca ? { corporation_number: data.ca.corporation_number, name: data.ca.name, status: data.ca.status } : { included: false, reason: data.ca_skip_reason || "no CA signals" },
        registries_attached: data.registries_attached || [],
        omitted: ["full company research", "full UK/FR/NO/DK/FI/AU/CA registry packs", "full charity profile"],
      };

    case "us-sec":
      return {
        ...u,
        cik: data.cik, name: data.name, tickers: (data.tickers || []).slice(0, 3),
        sic: data.sic, filings_preview: (data.recent_filings || []).slice(0, 2),
        omitted: ["full filings list", "addresses", "formerNames", "phone/ein detail"],
      };
    case "us-sec-full":
      return {
        ...u,
        cik: data.cik, name: data.name,
        facts_keys: Object.keys(data.companyfacts_highlights || {}).slice(0, 4),
        red_flag_count: data.red_flag_count ?? (data.red_flags || []).length,
        red_flags_preview: (data.red_flags || []).slice(0, 2),
        omitted: ["full companyfacts highlights", "full filings", "addresses"],
      };
    case "eu-vat":
      return {
        ...u,
        valid: data.valid, countryCode: data.countryCode, vatNumber: data.vatNumber,
        name: data.name, address_preview: data.address ? String(data.address).slice(0, 80) : null,
        omitted: ["full address lines"],
      };
    case "uk-leads":
    case "uk-leads-lite":
      return {
        ...u,
        product: data.product, query: data.query, hits_total_unfiltered_by_postcode: data.hits_total_unfiltered_by_postcode,
        returned: data.returned,
        companies_preview: (data.companies || []).slice(0, 2).map((c: any) => ({
          company_number: c.company_number, company_name: c.company_name, sic_codes: c.sic_codes,
          postcode: c.postcode, directors_preview: (c.directors || []).slice(0, 1),
        })),
        omitted: ["full company list", "full director lists"],
        attribution: data.attribution,
      };
    case "uk-leads-feed":
      return {
        ...u,
        id: data.id, kind: data.kind || "uk-leads-feed",
        sic: data.sic, location: data.location, postcode_area: data.postcode_area,
        webhook: data.webhook, created: data.created, expires: data.expires,
        runs: data.runs, last_delivered: data.last_delivered, active: data.active,
        status_url: data.status_url, price: data.price || PRICE["uk-leads-feed"] + "/30d",
        duration_days: data.duration_days ?? 30,
        delivery: data.delivery || "daily UTC morning via cron",
        disclaimer: data.disclaimer || "Static preview sample — not a live feed.",
        omitted: ["seen company numbers", "live daily deliveries", "KV-backed feed id"],
      };
    case "email-check":
      return { ...u, product: data.product, email: data.email, verdict: data.verdict, score: data.score, flags: data.flags, checks: data.checks, provider: data.provider, omitted: ["mx_hosts full", "upsell detail"] };
    case "domain":
      return { ...u, product: data.product, domain: data.domain, registrar: data.registrar, registered: data.registered, expires: data.expires, age_days: data.age_days, status: data.status, flags: data.flags, omitted: ["upsell detail", "full RDAP entities"] };
    case "dns":
      return {
        ...u, product: data.product, name: data.name, type: data.type, flags: data.flags,
        records_preview: data.records ? Object.fromEntries(Object.entries(data.records).map(([k, v]: any) => [k, Array.isArray(v) ? v.slice(0, 2) : v])) : {},
        omitted: ["full TXT/NS lists", "upsell detail"],
      };
    case "redirects":
      return {
        ...u, product: data.product, url: data.url, final_url: data.final_url, status: data.status,
        hops: data.hops, redirect_count: data.redirect_count, ok: data.ok, truncated_chain: data.truncated_chain,
        chain_preview: Array.isArray(data.chain) ? data.chain.slice(0, 3) : [],
        content_type: data.content_type, disclaimer: data.disclaimer,
        omitted: ["full redirect chain", "upsell detail"],
      };
    case "meta":
      return {
        ...u, product: data.product, url: data.url, final_url: data.final_url, title: data.title,
        description: data.description, canonical_url: data.canonical_url, language: data.language,
        site_name: data.site_name, og_keys: data.og ? Object.keys(data.og).slice(0, 8) : [],
        headings_preview: data.headings, disclaimer: data.disclaimer,
        omitted: ["full og/twitter maps", "favicons", "json_ld_types", "upsell detail"],
      };
    case "headers":
      return {
        ...u, product: data.product, url: data.url, final_url: data.final_url, status: data.status,
        score: data.score, missing_critical: data.missing_critical, ok: data.ok,
        headers_preview: data.headers ? Object.fromEntries(Object.entries(data.headers).slice(0, 6)) : {},
        disclaimer: data.disclaimer, omitted: ["full headers map", "upsell detail"],
      };
    case "iban":
      return {
        ...u, product: data.product, iban: data.iban, valid: data.valid, country: data.country,
        length_ok: data.length_ok, mod97_ok: data.mod97_ok, disclaimer: data.disclaimer,
        omitted: ["bban detail", "upsell detail"],
      };
    case "phone":
      return {
        ...u, product: data.product, phone_e164: data.phone_e164, valid: data.valid, country: data.country,
        calling_code: data.calling_code, length_ok: data.length_ok, type_guess: data.type_guess,
        disclaimer: data.disclaimer, omitted: ["national_number detail", "upsell detail"],
      };
    case "uk-postcode":
      return {
        ...u, product: data.product, postcode: data.postcode, postcode_compact: data.postcode_compact,
        valid: data.valid, format_ok: data.format_ok, outward: data.outward, inward: data.inward,
        area: data.area, district: data.district, sector: data.sector, unit: data.unit,
        disclaimer: data.disclaimer, omitted: ["upsell detail"],
      };
    case "siren":
      return {
        ...u, product: data.product, siren: data.siren, valid: data.valid, luhn_ok: data.luhn_ok,
        length_ok: data.length_ok, digits: data.digits, disclaimer: data.disclaimer, omitted: ["upsell detail"],
      };
    case "siret":
      return {
        ...u, product: data.product, siret: data.siret, valid: data.valid, luhn_ok: data.luhn_ok,
        length_ok: data.length_ok, digits: data.digits, nic: data.nic, parent_siren: data.parent_siren,
        disclaimer: data.disclaimer, omitted: ["upsell detail"],
      };
    case "partita-iva":
      return {
        ...u, product: data.product, vat: data.vat, partita_iva: data.partita_iva, valid: data.valid,
        checksum_ok: data.checksum_ok, length_ok: data.length_ok, digits: data.digits,
        province_code: data.province_code, province_ok: data.province_ok,
        disclaimer: data.disclaimer, omitted: ["upsell detail"],
      };
    case "orgnr":
      return {
        ...u, product: data.product, orgnr: data.orgnr, orgnr_formatted: data.orgnr_formatted,
        valid: data.valid, luhn_ok: data.luhn_ok, third_digit_ok: data.third_digit_ok,
        length_ok: data.length_ok, digits: data.digits,
        disclaimer: data.disclaimer, omitted: ["upsell detail"],
      };
    case "bn-ca":
      return {
        ...u, product: data.product, bn: data.bn, bn9: data.bn9, program: data.program,
        reference: data.reference, program_known: data.program_known, program_name: data.program_name,
        shape_ok: data.shape_ok, valid: data.valid, form: data.form,
        disclaimer: data.disclaimer, omitted: ["upsell detail"],
      };
    case "cvr":
      return {
        ...u, product: data.product, cvr: data.cvr, valid: data.valid,
        mod11_ok: data.mod11_ok, no_leading_zero: data.no_leading_zero, length_ok: data.length_ok,
        digits: data.digits, disclaimer: data.disclaimer, upsell: data.upsell,
      };
    case "fn-at":
      return {
        ...u, product: data.product, fn: data.fn, fn_formatted: data.fn_formatted,
        digits: data.digits, check_letter: data.check_letter, expected_check_letter: data.expected_check_letter,
        branch: data.branch, valid: data.valid, letter_ok: data.letter_ok, disclaimer: data.disclaimer, upsell: data.upsell,
      };
    case "kvk-nl":
      return { ...u, ...data, upsell: data.upsell };
    case "hr-de":
      return { ...u, ...data, upsell: data.upsell };
    case "nif-es":
      return { ...u, ...data, upsell: data.upsell };
    case "cnpj":
    case "nip-pl":
    case "uid-ch":
      return { ...u, ...data, upsell: data.upsell };
    case "cin-in":
      return {
        ...u, product: data.product, cin: data.cin, valid: data.valid, shape_ok: data.shape_ok, year_ok: data.year_ok,
        listing: data.listing, listing_status: data.listing_status, nic_code: data.nic_code, state_code: data.state_code,
        year_of_incorporation: data.year_of_incorporation, company_type: data.company_type,
        company_type_known: data.company_type_known, registration_number: data.registration_number,
        disclaimer: data.disclaimer, upsell: data.upsell,
      };
    case "au-company":
      return {
        ...u, acn: data.acn, name: data.name, status: data.status, status_desc: data.status_desc,
        omitted: data.omitted || ["abn", "former_names", "type", "class", "registered", "deregistered"],
      };
    case "ca-company":
      return {
        ...u, corporation_number: data.corporation_number, name: data.name, status: data.status,
        omitted: data.omitted || ["business_number", "registered_office", "filings", "directors", "governing_legislation"],
      };
    case "fr-company":
      return {
        ...u, siren: data.siren, name: data.name, status: data.status, status_label: data.status_label,
        city: data.siege?.city || data.city || null, activity_code: data.activity_code,
        dirigeants_count: data.dirigeants_count, red_flags: (data.red_flags || []).slice(0, 2),
        omitted: data.omitted || ["full dirigeants", "finances", "siege detail", "matches"],
      };
    case "no-company":
      return {
        ...u, orgnr: data.orgnr, name: data.name, status: data.status,
        city: data.forretningsadresse?.city || data.city || null, orgform: data.orgform?.code || data.orgform || null,
        antallAnsatte: data.antallAnsatte ?? null, red_flags: (data.red_flags || []).slice(0, 2),
        omitted: data.omitted || ["forretningsadresse detail", "historiskeNavn", "kapital", "matches"],
      };
    case "dk-company":
      return {
        ...u, cvr: data.cvr, name: data.name, status: data.status,
        city: data.city || null, company_type_short: data.company_type_short || null,
        employees: data.employees ?? null, red_flags: (data.red_flags || []).slice(0, 2),
        omitted: data.omitted || ["direktion detail", "ejere", "fuldt_ansvarlige", "matches"],
      };
    case "fi-company":
      return {
        ...u, business_id: data.business_id, name: data.name, status: data.status,
        city: data.city || null, company_form: data.company_form?.description_en || data.company_form || null,
        main_business_line: data.main_business_line
          ? { code: data.main_business_line.code, description_en: data.main_business_line.description_en }
          : null,
        red_flags: (data.red_flags || []).slice(0, 2),
        omitted: data.omitted || ["names history", "registered_entries detail", "company_situations detail", "matches"],
      };
    case "ch-company":
      return {
        ...u, uid: data.uid, name: data.name, status: data.status,
        legal_seat: data.legal_seat || null,
        legal_form: data.legal_form?.short_en || data.legal_form?.description_en || null,
        red_flags: (data.red_flags || []).slice(0, 2),
        omitted: data.omitted || ["purpose", "address_detail", "recent_shab", "audit_firms", "matches"],
      };
    case "pl-company":
      return {
        ...u, krs: data.krs, nip: data.nip || null, name: data.name,
        legal_form: data.legal_form || null, seat: data.seat || null,
        status_hint: data.status_hint || null, mf_vat_status: data.mf_vat_status || null,
        red_flags: (data.red_flags || []).slice(0, 2),
        omitted: data.omitted || ["representation detail", "address_detail", "full activities", "capital detail"],
      };
    case "cz-company":
      return {
        ...u, ico: data.ico, dic: data.dic || null, name: data.name,
        status: data.status || null, seat: data.seat || null,
        legal_form: data.legal_form?.short_en || data.legal_form?.description_en || data.legal_form || null,
        red_flags: (data.red_flags || []).slice(0, 2),
        omitted: data.omitted || ["address_detail", "status_registers", "full NACE", "capital"],
      };
    case "be-company":
      return {
        ...u, enterprise_number: data.enterprise_number, vat: data.vat || null, name: data.name,
        status: data.status || null, address: data.address || null,
        legal_form: data.legal_form || null,
        red_flags: (data.red_flags || []).slice(0, 2),
        omitted: data.omitted || ["functions", "full NACE", "characteristics", "names"],
      };
    case "sk-company":
      return {
        ...u, ico: data.ico, name: data.name,
        status: data.status || null, seat: data.seat || null,
        legal_form: data.legal_form?.description || data.legal_form || null,
        registration_number: data.registration_number || null,
        red_flags: (data.red_flags || []).slice(0, 2),
        omitted: data.omitted || ["address_detail", "statutory_bodies", "stakeholders", "successors"],
      };
    case "us-entity":
      return {
        ...u, product: data.product, query: data.query, states_supported: data.states_supported,
        total_results: data.total_results,
        best_match: data.best_match ? { state: data.best_match.state, id: data.best_match.id, name: data.best_match.name, status: data.best_match.status, entity_type: data.best_match.entity_type, formed: data.best_match.formed, jurisdiction: data.best_match.jurisdiction } : null,
        other_matches: (data.results || []).slice(1, 4).map((r: any) => ({ state: r.state, id: r.id, name: r.name, status: r.status })),
        red_flags: (data.red_flags || []).slice(0, 2), per_state_counts: data.per_state_counts,
        disclaimer: data.disclaimer, source: data.source,
        omitted: ["registered_agent", "address", "CT principals", "full results (up to 25)", "per_state query urls"],
      };
    case "registry-batch":
      return {
        ...u, count: data.count, found: data.found, query: data.query,
        results: (data.results || []).slice(0, 6).map((r: any) => ({ country: r.country, id: r.id, found: r.found, ...(r.found ? { name: r.data?.name ?? null, status: r.data?.status ?? null } : { error: r.error }) })),
        us_syntax: "us=STATE:ID (comma-separated; STATE in NY, CO, CT, OR, TX). Malformed or unsupported items return an inline per-item error; the rest of the batch still runs.",
        sources: data.sources, sample_fetched: data.sample_fetched,
        omitted: ["full per-company records (type/act, formed, address, registered agent, red flags)", "remaining results"],
      };
    case "uk-dd":
      return {
        ...u,
        product: data.product, disclaimer: data.disclaimer, trust: data.trust,
        has_uk: !!data.uk && !data.uk.error,
        has_sanctions: !!data.sanctions && !data.sanctions.error && !data.sanctions.skipped,
        has_domain: !!data.domain && !data.domain.error,
        has_website: !!data.website && !data.website.error,
        uk_name: data.uk?.name || data.uk?.profile?.company_name || null,
        uk_status: data.uk?.status || data.uk?.profile?.company_status || null,
        omitted: ["full uk/sanctions/domain/website payloads - pay for complete pack"],
        preview_omitted: data.preview_omitted || undefined,
      };
    case "kyb":
      return {
        ...u,
        product: data.product, disclaimer: data.disclaimer, trust: data.trust,
        has_website: !!data.website && !data.website.error,
        has_uk: !!data.uk && !data.uk.error,
        has_fr: !!data.fr && !data.fr.error,
        has_no: !!data.no && !data.no.error,
        has_dk: !!data.dk && !data.dk.error,
        has_fi: !!data.fi && !data.fi.error,
        has_ch: !!data.ch && !data.ch.error,
        has_pl: !!data.pl && !data.pl.error,
        has_cz: !!data.cz && !data.cz.error,
        has_be: !!data.be && !data.be.error,
        has_sk: !!data.sk && !data.sk.error,
        has_us: !!data.us && !data.us.error,
        us: data.us && !data.us.error ? { state: data.us.state, id: data.us.id, name: data.us.name, status: data.us.status, formed: data.us.formed } : undefined,
        has_eu_vat: !!data.eu_vat && !data.eu_vat.error,
        has_au: !!data.au && !data.au.error,
        has_ca: !!data.ca && !data.ca.error,
        directors_checked: (data.directors_appointments || []).length,
        has_sanctions: !!data.sanctions && !data.sanctions.error && !data.sanctions.skipped,
        has_lei: !!data.lei && !data.lei.error,
        omitted: ["full website/uk/eu_vat/sanctions payloads - pay for complete pack"],
        preview_omitted: data.preview_omitted || undefined,
      };
    case "sanctions":
      return {
        ...u,
        product: data.product, disclaimer: data.disclaimer,
        query: data.query, match_count: data.match_count, possible_match: data.possible_match,
        highest_score: data.highest_score,
        matches_preview: (data.matches || []).slice(0, 2),
        lists: data.lists ? Object.keys(data.lists) : [],
        omitted: ["full match list", "full aliases", "list publication detail"],
      };
    case "sanctions-batch":
      return {
        ...u,
        product: data.product, disclaimer: data.disclaimer, count: data.count,
        possible_match_count: data.possible_match_count,
        results_preview: (data.results || []).slice(0, 2),
        omitted: ["full per-name match payloads"],
      };
    case "uk-officer":
      return {
        ...u,
        product: data.product, disclaimer: data.disclaimer, query: data.query,
        hits_total: data.hits_total, returned: data.returned,
        officers_preview: (data.officers || []).slice(0, 2).map((o: any) => ({
          name: o.name, appointment_count: o.appointment_count,
          address_snippet: o.address_snippet,
          date_of_birth: o.date_of_birth,
          flags: (o.flags || []).slice(0, 2),
          appointments_preview: (o.appointments || []).slice(0, 2).map((a: any) => ({
            company_number: a.company_number, company_name: a.company_name, role: a.role, status: a.status,
          })),
        })),
        omitted: ["full officer list beyond 2", "full appointment lists"],
        attribution: data.attribution,
      };
    case "lei":
      return {
        ...u,
        lei: data.lei, legal_name: data.legal_name,
        status: data.status, jurisdiction: data.jurisdiction,
        parents: data.parents ? { direct: data.parents.direct?.lei || null, ultimate: data.parents.ultimate?.lei || null } : null,
        omitted: ["addresses", "other_names", "identifiers", "full parent names"],
      };
    case "lei-full":
      return {
        ...u,
        product: data.product, query: data.query, count: data.count, total_available: data.total_available,
        results_preview: (data.results || []).slice(0, 2).map((r: any) => ({
          lei: r.lei, legal_name: r.legal_name, status: r.status, jurisdiction: r.jurisdiction,
          parents: r.parents ? { direct: r.parents.direct?.lei || null, ultimate: r.parents.ultimate?.lei || null } : null,
        })),
        omitted: ["remaining candidates", "full addresses/identifiers"],
      };
    case "read-batch":
      return {
        ...u,
        product: data.product, count: data.count, ok_count: data.ok_count,
        results_preview: (data.results || []).slice(0, 2).map((r: any) => ({
          url: r.url, ok: r.ok, title: r.title, word_count: r.word_count,
          markdown_preview: r.markdown ? String(r.markdown).slice(0, 200) + (String(r.markdown).length > 200 ? "…" : "") : null,
          error: r.error || null,
        })),
        omitted: ["remaining URLs", "full markdown"],
      };
    case "uk-property":
      return {
        ...u,
        postcode: data.postcode,
        area: data.area ? { district: data.area.district, ward: data.area.ward, region: data.area.region, country: data.area.country } : null,
        summary: data.summary ? {
          sales: data.summary.sales, latest_sale: data.summary.latest_sale,
          median_price: data.summary.median_price, median_last_12m: data.summary.median_last_12m,
          sales_last_12m: data.summary.sales_last_12m,
        } : null,
        sales_preview: Array.isArray(data.sales) ? data.sales.slice(0, 2) : [],
        source: data.source, coverage: data.coverage,
        omitted: ["full sales list", "median_by_type detail", "search postcodes"],
      };
    case "uk-area":
      return {
        ...u,
        postcode: data.postcode,
        location: data.location ? { lat: data.location.lat, lon: data.location.lon } : null,
        geography: data.geography ? {
          country: data.geography.country, region: data.geography.region,
          local_authority: data.geography.local_authority, ward: data.geography.ward,
          constituency: data.geography.constituency,
        } : null,
        crime: data.crime ? { month: data.crime.month, total_within_1mile: data.crime.total_within_1mile } : null,
        food_hygiene: data.food_hygiene ? {
          establishments_within_400m: data.food_hygiene.establishments_within_400m,
          average_rating: data.food_hygiene.average_rating,
        } : null,
        source: data.source,
        omitted: ["crime by_category", "food hygiene lowest_rated", "full geography codes"],
      };

    case "uk-watch":
      return {
        ...u,
        id: data.id, kind: data.kind || "uk-watch",
        company_number: data.company_number, company_name: data.company_name,
        webhook: data.webhook, created: data.created, expires: data.expires,
        snapshot: data.snapshot, status_url: data.status_url,
        price: data.price || PRICE["uk-watch"] + "/30d",
        watches_psc_and_charges: data.watches_psc_and_charges ?? true,
        disclaimer: data.disclaimer || "Static preview sample — not a live watch.",
        omitted: ["live hourly checks", "webhook deliveries", "KV-backed watch id"],
      };

    default:
      return { ...u, error: "unknown preview kind" };
  }
}

/** Frozen real samples (generated offline / first warm). Keep intentionally partial. */
export const STATIC_SAMPLES: Record<string, any> = {
  "uk-watch": {
    id: "preview00000000000000000000000001",
    kind: "uk-watch",
    company_number: "00445790",
    company_name: "TESCO PLC",
    webhook: "https://your.app/hook",
    created: "2026-11-06T12:00:00.000Z",
    expires: "2026-12-06T12:00:00.000Z",
    checks: 1, changes: 0, active: true,
    snapshot: {
      company_number: "00445790",
      name: "TESCO PLC",
      status: "active",
      status_detail: null,
      accounts_overdue: false,
      confirmation_overdue: false,
      sic_codes: ["47110"],
      registered_office: { address_line_1: "Tesco House", postal_code: "AL7 1GA" },
      officers_active: ["director:SAMPLE, Director:2020-01-01"],
      recent_filings: ["TxSample1", "TxSample2"],
      psc_active: ["SAMPLE PSC LTD|ownership-of-shares-75-to-100-percent|2016-06-30"],
      charges_outstanding: 1,
      charges_ids: ["2020-01-15:outstanding:SAMPLE BANK PLC"],
    },
    status_url: "https://api.axiomworks.co.uk/uk-watch/preview00000000000000000000000001",
    price: "$5.00/30d",
    watches_psc_and_charges: true,
    disclaimer: "Static preview sample — not a live watch. Pay via x402 POST /uk-watch to create a real 30-day hourly watch.",
  },
  "uk-leads-feed": {
    id: "preview00000000000000000000000002",
    kind: "uk-leads-feed",
    sic: "62012",
    location: null,
    postcode_area: null,
    webhook: "https://your.app/hook",
    created: "2026-11-06T12:00:00.000Z",
    expires: "2026-12-06T12:00:00.000Z",
    last_run: null,
    last_delivered: 0,
    runs: 0,
    last_error: null,
    active: true,
    status_url: "https://api.axiomworks.co.uk/uk-leads-feed/preview00000000000000000000000002",
    price: "$25.00/30d",
    duration_days: 30,
    delivery: "daily UTC morning via cron",
    disclaimer: "Static preview sample — not a live feed. Pay via x402 POST /uk-leads-feed to create a real 30-day daily webhook of new UK incorporations.",
  },
  "lei": {
    lei: "HWUPKR0MPOU8FGXBT394", legal_name: "Apple Inc.", status: { entity: "ACTIVE", registration: "ISSUED" },
    jurisdiction: "US-CA", parents: { direct: null, ultimate: null },
  },
  "lei-full": {
    product: "lei-full", query: { name: "Apple Inc." }, count: 2, total_available: 24,
    results: [{ lei: "HWUPKR0MPOU8FGXBT394", legal_name: "Apple Inc.", status: { entity: "ACTIVE" }, jurisdiction: "US-CA", parents: { direct: null, ultimate: null } }],
  },
  "read-batch": {
    product: "read-batch", count: 2, ok_count: 2,
    results: [{ url: "https://example.com", ok: true, title: "Example Domain", word_count: 20, markdown: "Example Domain" }],
  },
  "uk-leads-lite": {
    product: "uk-leads-lite", query: { sic: "62012", days: 1 }, returned: 2,
    companies_preview: [{ company_number: "17560814", company_name: "MADE OF WHITE LTD", sic_codes: ["62012"], postcode: "W1" }],
    attribution: "Contains public sector information licensed under the Open Government Licence v3.0.",
  },
  "uk-leads": {
    product: "uk-leads", query: { sic: "62012", days: 1 }, returned: 1,
    companies_preview: [{ company_number: "17560814", company_name: "MADE OF WHITE LTD", directors_preview: [{ name: "MADUBUIKE, Precious Emmanuel", role: "director" }] }],
  },
  kyb: {
    product: "kyb", trust: { flag: "CLEAR", score: 85, reasons: ["UK company status active", "website research completed"] },
    disclaimer: "Screening over public registries and public sanctions lists only. Not a regulated KYC/KYB/AML determination.",
  },
  "uk-dd": {
    product: "uk-dd", trust: { flag: "CLEAR", score: 80, reasons: ["UK company status active"] },
    disclaimer: "UK due-diligence screening over public Companies House data and public sanctions lists only. Not a regulated KYC/KYB/AML determination.",
  },
  "email-check": {
    product: "email-check", email: "info@stripe.com", syntax_ok: true, verdict: "risky", score: 90,
    flags: ["role_account"], checks: { mx: true, a: true, disposable: false, free_provider: false, role_account: true },
    provider: "Google Workspace / Gmail",
    disclaimer: "Heuristics over public DNS only. Not a guarantee of deliverability.",
  },
  domain: {
    product: "domain", domain: "stripe.com", registrar: "SafeNames Ltd.", registered: "1995-09-12T04:00:00Z",
    expires: "2027-09-11T04:00:00Z", age_days: 11377, status: ["clientDeleteProhibited", "clientTransferProhibited"],
    flags: [], disclaimer: "Public RDAP registration data only. Not proof of ownership.",
  },
  dns: {
    product: "dns", name: "example.com", type: ["A","AAAA","MX","TXT","NS","CNAME"],
    records: {
      A: ["93.184.216.34"], AAAA: ["2606:2800:220:1:248:1893:25c8:1946"],
      MX: [], TXT: ["v=spf1 -all"], NS: ["a.iana-servers.net", "b.iana-servers.net"], CNAME: [],
    },
    flags: [], disclaimer: "Public DNS via Cloudflare DoH only. Not authoritative proof.",
  },
  meta: {
    product: "meta", url: "https://example.com", final_url: "https://example.com/",
    title: "Example Domain", description: null, canonical_url: "https://example.com/",
    language: "en", site_name: null, og: {}, twitter: {}, favicons: [], json_ld_types: [],
    headings: { h1: ["Example Domain"], h2: [] },
    disclaimer: "Live HTML head/meta extract. Not a ranking or safety verdict.",
  },
  headers: {
    product: "headers", url: "https://example.com", final_url: "https://example.com/",
    status: 200, score: 55, missing_critical: ["content-security-policy", "x-frame-options"],
    ok: { https: true, hsts: false, csp: false, x_frame_options: false, x_content_type_options: false },
    headers: { "strict-transport-security": null, "content-type": "text/html" },
    disclaimer: "Live HTTP header probe. Not a security audit.",
  },
  iban: {
    product: "iban", iban: "GB82WEST12345698765432", valid: true, country: "GB",
    check_digits: "82", length: 22, length_ok: true, mod97_ok: true,
    disclaimer: "Checksum only — not proof account exists.",
  },
  phone: {
    product: "phone", phone_e164: "+447911123456", valid: true, country: "GB",
    calling_code: "44", national_number: "7911123456", length_ok: true, country_known: true,
    type_guess: "mobile", disclaimer: "Structure only — not HLR/carrier/assigned.",
  },
  "uk-postcode": {
    product: "uk-postcode", postcode: "SW1A 2AA", postcode_compact: "SW1A2AA", valid: true,
    outward: "SW1A", inward: "2AA", area: "SW", district: "1A", sector: "2", unit: "AA",
    format_ok: true, disclaimer: "Offline Royal Mail postcode format check only.",
  },
  siren: {
    product: "siren", siren: "732829320", valid: true, luhn_ok: true, length_ok: true, digits: 9,
    disclaimer: "French SIREN structure + Luhn only.",
  },
  siret: {
    product: "siret", siret: "73282932000074", valid: true, luhn_ok: true, length_ok: true, digits: 14,
    nic: "00074", parent_siren: "732829320", disclaimer: "French SIRET structure + Luhn only.",
  },
  "partita-iva": {
    product: "partita-iva", vat: "00488410010", partita_iva: "00488410010", valid: true,
    checksum_ok: true, length_ok: true, digits: 11, province_code: "001", province_ok: true,
    disclaimer: "Italian Partita IVA structure + checksum only.",
  },
  orgnr: {
    product: "orgnr", orgnr: "5560125790", orgnr_formatted: "556012-5790", valid: true,
    luhn_ok: true, third_digit_ok: true, length_ok: true, digits: 10,
    disclaimer: "Swedish organisationsnummer structure + Luhn only.",
  },
  "bn-ca": {
    product: "bn-ca", bn: "123456789RT0001", bn9: "123456789", program: "RT", reference: "0001",
    program_known: true, program_name: "GST/HST", shape_ok: true, valid: true, form: "program_account",
    disclaimer: "Canadian CRA BN shape only — not proof of issuance.",
  },
  cvr: {
    product: "cvr", cvr: "10403782", valid: true, mod11_ok: true, no_leading_zero: true, length_ok: true, digits: 8,
    price: "$0.001", disclaimer: "preview", source: "Danish CVR modulus-11 (offline)",
  },
  "fn-at": {
    product: "fn-at", fn: "575737y", fn_formatted: "FN 575737y", digits: "575737", check_letter: "y",
    expected_check_letter: "y", branch: null, valid: true, letter_ok: true, letter_in_alphabet: true, length_ok: true,
    price: "$0.001", disclaimer: "preview", source: "Austrian Firmenbuchnummer check letter (offline; mod-17)",
  },
  "kvk-nl": {
    product: "kvk-nl", kvk: "69599084", valid: true, length_ok: true, digits: 8, elfproef_ok: false, price: "$0.001", disclaimer: "preview", source: "offline",
  },
  "hr-de": {
    product: "hr-de", hr: "HRB 6684", register_type: "HRB", number: "6684", suffix: null, court: null, valid: true, shape_ok: true, price: "$0.001", disclaimer: "preview", source: "offline",
  },
  "nif-es": {
    product: "nif-es", nif: "A28015865", kind: "CIF", control: "5", expected_control: "5", control_ok: true, valid: true, shape_ok: true, price: "$0.001", disclaimer: "preview", source: "offline",
  },
  cnpj: {
    product: "cnpj", cnpj: "33000167000101", cnpj_formatted: "33.000.167/0001-01", valid: true, checksum_ok: true, length_ok: true, not_all_same_digits: true, digits: 14, root: "33000167", branch: "0001", is_head_office: true, price: "$0.001", disclaimer: "preview", source: "offline",
  },
  "nip-pl": {
    product: "nip-pl", nip: "5261040828", valid: true, mod11_ok: true, length_ok: true, digits: 10, price: "$0.001", disclaimer: "preview", source: "offline",
  },
  "uid-ch": {
    product: "uid-ch", uid: "109322551", uid_formatted: "CHE-109.322.551", valid: true, mod11_ok: true, length_ok: true, digits: 9, price: "$0.001", disclaimer: "preview", source: "offline",
  },
  "cin-in": {
    product: "cin-in", cin: "U72200KA2013PTC097389", valid: true, shape_ok: true, year_ok: true,
    listing: "U", listing_status: "unlisted", nic_code: "72200", state_code: "KA", year_of_incorporation: 2013,
    company_type: "PTC", company_type_known: true, company_type_name: "Private Limited Company",
    registration_number: "097389", price: "$0.001", disclaimer: "preview", source: "Indian MCA CIN structure (offline; no check digit)",
  },
  redirects: {
    product: "redirects", url: "https://example.com", final_url: "https://example.com/",
    status: 200, hops: 1, redirect_count: 0, ok: true, truncated_chain: false,
    chain: [{ url: "https://example.com", status: 200 }],
    content_type: "text/html; charset=UTF-8",
    disclaimer: "Live HTTP redirect follow with SSRF guards. Not a malware verdict.",
  },
  "au-company": {
    acn: "004028077", name: "BHP GROUP LIMITED", status: "REGD", status_desc: "Registered",
    omitted: ["abn", "former_names", "type", "class", "registered", "deregistered"],
  },
  "ca-company": {
    corporation_number: "8660115", name: "MINDANGLER CAPITAL INC.", status: "Active",
    omitted: ["business_number", "registered_office", "filings", "directors", "governing_legislation"],
  },
  "fr-company": {
    siren: "443061841", name: "GOOGLE FRANCE", status: "A", status_label: "active",
    city: "PARIS", activity_code: "62.02A", dirigeants_count: 3,
    red_flags: [], omitted: ["full dirigeants", "finances", "siege detail", "matches"],
  },
  "no-company": {
    orgnr: "923609016", name: "EQUINOR ASA", status: "active",
    city: "STAVANGER", orgform: "ASA", antallAnsatte: 21231,
    red_flags: [], omitted: ["forretningsadresse detail", "historiskeNavn", "kapital", "matches"],
  },
  "dk-company": {
    cvr: "24256790", name: "NOVO NORDISK A/S", status: "NORMAL",
    city: "Bagsværd", company_type_short: "A/S", employees: 27151,
    red_flags: [], omitted: ["direktion detail", "ejere", "fuldt_ansvarlige", "matches"],
  },
  "fi-company": {
    business_id: "0112038-9", name: "Nokia Oyj", status: "registered",
    city: "ESPOO", company_form: "Public limited company",
    main_business_line: { code: "70100", description_en: "Activities of head offices" },
    website: "www.nokia.com", red_flags: [],
    omitted: ["names history", "registered_entries detail", "company_situations detail", "matches"],
  },
  "ch-company": {
    uid: "CHE-105.909.036", name: "Nestlé S.A.", status: "existing",
    legal_seat: "Vevey", legal_form: "Ltd",
    red_flags: [], omitted: ["purpose", "address_detail", "recent_shab", "audit_firms", "matches"],
  },
  "pl-company": {
    krs: "0000001538", nip: "5260300291", name: "BANK HANDLOWY W WARSZAWIE SPÓŁKA AKCYJNA",
    legal_form: "SPÓŁKA AKCYJNA", seat: "WARSZAWA, MAZOWIECKIE, POLSKA",
    status_hint: "current_extract", mf_vat_status: "Czynny",
    red_flags: [], omitted: ["representation detail", "address_detail", "full activities", "capital detail"],
  },
  "cz-company": {
    ico: "27082440", dic: "CZ27082440", name: "Alza.cz a.s.", status: "active",
    seat: "Praha", legal_form: "JSC",
    red_flags: [], omitted: ["address_detail", "status_registers", "full NACE", "capital"],
  },
  "be-company": {
    enterprise_number: "0202.239.951", vat: "BE0202239951", name: "PROXIMUS", status: "active",
    address: "Boulevard du Roi AlbertII 27 1030 Schaerbeek", legal_form: "Public limited company",
    red_flags: [], omitted: ["functions", "full NACE", "characteristics", "names"],
  },
  "sk-company": {
    ico: "31322832", name: "SLOVNAFT, a.s.", status: "active",
    seat: "Bratislava", legal_form: "Akciová spoločnosť", registration_number: "Sa/426/B",
    red_flags: [], omitted: ["address_detail", "statutory_bodies", "stakeholders", "successors"],
  },
  // Real records fetched 2026-11-07 ~14:32 GMT from the official state Socrata APIs (data.ny.gov, data.ct.gov, data.texas.gov, data.colorado.gov, data.oregon.gov).
  "us-entity": {
    product: "us-entity", query: { mode: "name", name: "Etsy Inc", states: ["NY", "CO", "CT", "OR", "TX"] }, states_supported: ["NY", "CO", "CT", "OR", "TX"],
    total_results: 17,
    best_match: { state: "CT", id: "2590243", name: "ETSY, INC.", status: "Active", entity_type: "Stock", formed: "2022-06-28", jurisdiction: "DELAWARE" },
    results: [
      { state: "CT", id: "2590243", name: "ETSY, INC.", status: "Active" },
      { state: "NY", id: "3368051", name: "ETSY, INC.", status: "active" },
      { state: "TX", id: "32050743551", name: "ETSY, INC.", status: "active (right to transact)" },
      { state: "CO", id: "20161660970", name: "ETSY, INC.", status: "Good Standing" },
    ],
    red_flags: ["same exact name registered in multiple states — confirm which entity you are dealing with"],
    per_state_counts: { NY: 3, CO: 8, CT: 3, OR: 1, TX: 2 },
    disclaimer: "US state business-entity records from official state open-data portals. Screening aid only — not a KYB/AML determination or good-standing certificate. Confirm on the state SOS site before acting.",
    source: "Official state open-data portals (Socrata SODA): data.ny.gov n9v6-gdp6, data.colorado.gov 4ykn-tg5h, data.ct.gov n7gp-d28j, data.oregon.gov tckn-sxa6, data.texas.gov 9cir-efmm",
  },
  // Real batch fetched 2026-11-07 ~14:32 GMT (Brreg + NY DOS / OR SOS / CT SOTS open data); last two items show per-item errors.
  "registry-batch": {
    query: { no: "923609016", us: "NY:3368051,OR:8739914,CT:2590243,ZZ:123,NY3368051" },
    count: 6, found: 4,
    results: [
      { country: "NO", id: "923609016", found: true, data: { name: "EQUINOR ASA", status: "active" } },
      { country: "US", id: "NY:3368051", found: true, data: { name: "ETSY, INC.", status: "active" } },
      { country: "US", id: "OR:8739914", found: true, data: { name: "NIKE, INC.", status: "active" } },
      { country: "US", id: "CT:2590243", found: true, data: { name: "ETSY, INC.", status: "Active" } },
      { country: "US", id: "ZZ:123", found: false, error: "unsupported US state \"ZZ\" in \"ZZ:123\" — supported: NY, CO, CT, OR, TX" },
      { country: "US", id: "NY3368051", found: false, error: "invalid us item \"NY3368051\" — use STATE:ID, e.g. NY:3368051 (states: NY, CO, CT, OR, TX)" },
    ],
    sources: ["Brønnøysundregistrene Enhetsregisteret (NO, NLOD)", "US state SOS open data (NY DOS, CO SOS, CT SOTS, OR SOS, TX Comptroller; Socrata)"],
    sample_fetched: "2026-11-07",
  },
  "uk-officer": {
    product: "uk-officer", query: { name: "Ken Olisa", limit: 10 }, hits_total: 3, returned: 2,
    disclaimer: "Public Companies House register data (OGL). Screening/research aid only - not a credit check.",
    officers: [
      { name: "Sir Kenneth Aphunezi OLISA", appointment_count: 49, address_snippet: "London", date_of_birth: { month: 10, year: 1951 },
        flags: [{ flag: "elevated_appointment_count", severity: "low" }],
        appointments: [{ company_number: "123", company_name: "Example Ltd", role: "director", status: "active" }] },
      { name: "Ken OLISA", appointment_count: 1, appointments: [] },
    ],
    attribution: "Contains public sector information licensed under the Open Government Licence v3.0.",
  },
  "uk-property": {
    postcode: "CB1 2AB",
    area: { district: "Cambridge", ward: "Petersfield", region: "East of England", country: "England" },
    summary: { sales: 50, latest_sale: "2026-05-28", median_price: 590000, median_last_12m: 453000, sales_last_12m: 10 },
    sales: [
      { date: "2026-05-28", price: 715000, postcode: "CB1 2AW", address: "75, MILL ROAD, CAMBRIDGE", property_type: "terraced", tenure: "freehold" },
      { date: "2026-05-21", price: 445000, postcode: "CB1 1BB", address: "34, PETERSFIELD MANSIONS, PETERSFIELD, CAMBRIDGE", property_type: "flat-maisonette", tenure: "leasehold" },
    ],
    source: "HM Land Registry Price Paid Data (OGL v3) + postcodes.io",
    coverage: "England & Wales, sales since 1995",
  },
  "uk-area": {
    postcode: "SW1A 2AA",
    location: { lat: 51.503541, lon: -0.12767 },
    geography: { country: "England", region: "London", local_authority: "Westminster", ward: "St James's", constituency: "Cities of London and Westminster" },
    crime: { month: "2026-08", total_within_1mile: 3908 },
    food_hygiene: { establishments_within_400m: 5000, average_rating: 5 },
    source: "postcodes.io + data.police.uk + FSA (OGL v3)",
  },

  sanctions: {
    product: "sanctions", possible_match: true, match_count: 1, highest_score: 1,
    query: { name: "BANCO NACIONAL DE CUBA" },
    matches_preview: [{ score: 1, list: "OFAC-SDN", name: "BANCO NACIONAL DE CUBA", program: "CUBA" }],
    disclaimer: "Screening aid only; not a regulated AML/KYC determination.",
  },
  "sanctions-batch": {
    product: "sanctions-batch", count: 2, possible_match_count: 1,
    results_preview: [{ name: "BANCO NACIONAL DE CUBA", possible_match: true }],
  },

  company: {
    domain: "example.com",
    homepage: { title: "Example Domain", description: "This domain is for use in illustrative examples in documents." },
    tech_stack_sample: [],
    social_networks: [],
    contacts: { email_count: 0, phone_count: 0 },
    dns: { mx_count: 0, spf: false, dmarc_policy: null },
    domain_registration: { registrar: "RESERVED-Internet Assigned Numbers Authority", created: null },
    news_sample: [],
  },
  "uk-company": {
    company_number: "00445790", name: "TESCO PLC", status: "active", sic_codes: ["47110"],
    officers_count: 74, charges_outstanding: 2, red_flag_names: ["outstanding_charges"],
    mass_formation_office: { matched: false },
  },
  "uk-charity": {
    name: "CANCER RESEARCH UK", status: "Registered", income: 734753802, spending: 714723789,
    trustees_count: 14, contact: { website: "www.cancerresearchuk.org" },
    activities: "Cancer Research UK is dedicated to saving lives through research…",
    source: "Contains public sector information licensed under the Open Government Licence v3.0 (Charity Commission for England & Wales)",
  },
  "uk-charity-full": {
    name: "CANCER RESEARCH UK", status: "Registered", trustees: [{ name: "Example Trustee" }],
    financial_history: [{ period_end: "2025-03-31", income: 734753802 }], red_flags: [], red_flag_count: 0,
  },
  "uk-company-lite": {
    company_number: "00445790", name: "TESCO PLC", status: "active", incorporation_date: "1947-11-27",
    red_flag_names: ["outstanding_charges"], accounts_overdue: false,
  },
  convert: {
    url: "https://pdfobject.com/pdf/sample.pdf",
    detected_format: "pdf", title: null, pages: 1, word_count: 416,
    text_preview: "Sample PDF\nThis is a simple PDF file. Fun fun fun.\nLorem ipsum dolor sit amet…",
  },
  "us-sec": {
    cik: "0000320193", name: "Apple Inc.", tickers: ["AAPL"], sic: "3571",
    recent_filings: [{ form: "10-K", filed: "2025-11-01" }],
  },
  "us-sec-full": {
    cik: "0000320193", name: "Apple Inc.", companyfacts_highlights: { Assets: { value: 1 } }, red_flags: [], red_flag_count: 0,
  },
  "eu-vat": {
    valid: true, countryCode: "IE", vatNumber: "6388047V", name: "GOOGLE IRELAND LIMITED",
    address: "3RD FLOOR, GORDON HOUSE, BARROW STREET, DUBLIN 4",
  },
  "company-full": {
    domain: "tesco.com",
    company: {
      domain: "tesco.com",
      homepage: { title: "Tesco", description: "Tesco grocery and general merchandise retailer." },
      tech_stack: { detected: ["Cloudflare"] },
      social_links: { twitter: "https://twitter.com/Tesco" },
      contacts: { emails: ["help@tesco.com"], phones: [] },
      dns: { mx: ["tesco-com.mail.protection.outlook.com"], spf: true, dmarc: { policy: "reject" } },
      whois: { registrar: "Example Registrar", created: "1996-01-01" },
      news: [],
    },
    uk: {
      company_number: "00445790", name: "TESCO PLC", status: "active", sic_codes: ["47110"],
      officers: [{ name: "Example Director" }], officers_count: 74,
      charges: [{ status: "outstanding" }], charges_outstanding: 2,
      red_flags: [{ flag: "outstanding_charges" }], red_flag_names: ["outstanding_charges"],
      mass_formation_office: { matched: false },
    },
    uk_included: true,
    charity_included: false,
    charity_skip_reason: "No charity signals (no registered charity number or charity keywords).",
    fr_included: false, fr_skip_reason: "No French company signals (.fr TLD, SIREN/SIRET, or FR keywords).",
    no_included: false, no_skip_reason: "No Norwegian company signals (.no TLD, orgnr, or NO keywords).",
    dk_included: false, dk_skip_reason: "No Danish company signals (.dk TLD, CVR, or DK keywords).",
    fi_included: false, fi_skip_reason: "No Finnish company signals (.fi TLD, Y-tunnus, or FI keywords).",
    au_included: false, au_skip_reason: "No Australian company signals (.com.au TLD or ACN/ABN).",
    ca_included: false, ca_skip_reason: "No Canadian company signals (.ca TLD or corporation number/BN).",
    registries_attached: ["UK CH"],
    note: "Includes company research + auto-attached registries: UK CH. Soft-skipped jurisdictions list *_skip_reason.",
  },
  links: {
    url: "https://example.com", count: 1,
    links: [{ url: "https://www.iana.org/domains/example", text: "More information...", internal: false }],
  },
  check: {
    domain: "example.com", score: 92,
    issues: [{ code: "info", message: "No critical issues in sample" }],
    tls: { ok: true, reachable: true },
    email: { mx: ["mail.example.com"] },
  },
  read: {
    url: "https://example.com", title: "Example Domain", word_count: 16, language: "en",
    markdown_preview: "Example Domain\n\nThis domain is for use in illustrative examples…",
    links_count: 1, links_sample: [{ url: "https://www.iana.org/domains/example", text: "More information...", internal: false }],
  },
};
