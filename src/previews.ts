import { CANONICAL } from "./facilitator";

const PREVIEW_LIMIT = 8; // per IP per UTC day across all preview kinds
const PREVIEW_PREFIX = "prev:";

export type PreviewKind = "read" | "links" | "check" | "company" | "uk-company" | "uk-company-lite" | "convert" | "company-full" | "uk-charity" | "uk-charity-full" | "us-sec" | "us-sec-full" | "eu-vat" | "lei" | "lei-full" | "read-batch" | "uk-leads" | "uk-leads-lite" | "kyb" | "sanctions" | "sanctions-batch" | "uk-officer";

const PRICE: Record<PreviewKind, string> = {
  read: "$0.002", links: "$0.001", check: "$0.001",
  company: "$0.25", "uk-company": "$0.50", "uk-company-lite": "$0.05",
  convert: "$0.03", "company-full": "$0.65",
  "uk-charity": "$0.05", "uk-charity-full": "$0.25",
  "us-sec": "$0.05", "us-sec-full": "$0.25", "eu-vat": "$0.01", "lei": "$0.005", "lei-full": "$0.05", "read-batch": "$0.015",
  "uk-leads": "$1.00", "uk-leads-lite": "$0.25", kyb: "$2.50",
  sanctions: "$0.05", "sanctions-batch": "$1.00",
  "uk-officer": "$0.15",
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
  "uk-leads": `${CANONICAL}/uk-leads?sic=62012`, "uk-leads-lite": `${CANONICAL}/uk-leads-lite?sic=62`, kyb: `${CANONICAL}/kyb?domain=tesco.com&number=00445790`,
  sanctions: `${CANONICAL}/sanctions?name=BANCO+NACIONAL+DE+CUBA`, "sanctions-batch": `${CANONICAL}/sanctions-batch`,
  "uk-officer": `${CANONICAL}/uk-officer?name=Ken+Olisa`,
};

function dayKey() { return new Date().toISOString().slice(0, 10); }

export async function checkPreviewQuota(env: { LOG: KVNamespace }, ip: string): Promise<{ ok: true; remaining: number } | { ok: false; error: string; reset: string }> {
  const key = `${PREVIEW_PREFIX}${dayKey()}:${ip || "unknown"}`;
  const cur = Number((await env.LOG.get(key)) || "0");
  if (cur >= PREVIEW_LIMIT) {
    return { ok: false, error: `preview rate limit (${PREVIEW_LIMIT}/IP/day). Full reports via x402.`, reset: `${dayKey()}T23:59:59Z` };
  }
  await env.LOG.put(key, String(cur + 1), { expirationTtl: 172800 });
  return { ok: true, remaining: PREVIEW_LIMIT - cur - 1 };
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
        social_networks: Object.keys(data.social_links || {}).filter((k) => (data.social_links as any)[k]),
        contacts: { email_count: (data.contacts?.emails || []).length, phone_count: (data.contacts?.phones || []).length },
        dns: { mx_count: (data.dns?.mx || []).length, spf: !!(data.dns?.spf || []).length, dmarc_policy: data.dns?.dmarc_policy || null },
        domain_registration: { registrar: data.domain_registration?.registrar || null, created: data.domain_registration?.created || null },
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
        omitted: ["full company research", "full UK due-diligence pack", "full charity profile"],
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
    case "kyb":
      return {
        ...u,
        product: data.product, disclaimer: data.disclaimer, trust: data.trust,
        has_website: !!data.website && !data.website.error,
        has_uk: !!data.uk && !data.uk.error,
        has_eu_vat: !!data.eu_vat && !data.eu_vat.error,
        has_au: !!data.au && !data.au.error,
        has_ca: !!data.ca && !data.ca.error,
        directors_checked: (data.directors_appointments || []).length,
        has_sanctions: !!data.sanctions && !data.sanctions.error && !data.sanctions.skipped,
        has_lei: !!data.lei && !data.lei.error,
        omitted: ["full website/uk/eu_vat/sanctions payloads - pay for complete pack"],
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
    default:
      return { ...u, error: "unknown preview kind" };
  }
}

/** Frozen real samples (generated offline / first warm). Keep intentionally partial. */
export const STATIC_SAMPLES: Record<string, any> = {
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
  read: {
    url: "https://example.com", title: "Example Domain", word_count: 16, language: "en",
    markdown_preview: "Example Domain\n\nThis domain is for use in illustrative examples…",
    links_count: 1, links_sample: [{ url: "https://www.iana.org/domains/example", text: "More information...", internal: false }],
  },
};
