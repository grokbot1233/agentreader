import { CANONICAL } from "./facilitator";

const PREVIEW_LIMIT = 8; // per IP per UTC day across all preview kinds
const PREVIEW_PREFIX = "prev:";

export type PreviewKind = "read" | "links" | "check" | "company" | "uk-company" | "uk-company-lite" | "convert" | "company-full" | "uk-charity" | "uk-charity-full";

const PRICE: Record<PreviewKind, string> = {
  read: "$0.002", links: "$0.001", check: "$0.001",
  company: "$0.25", "uk-company": "$0.50", "uk-company-lite": "$0.05",
  convert: "$0.03", "company-full": "$0.65",
  "uk-charity": "$0.05", "uk-charity-full": "$0.25",
};

const PAID_CALL: Record<PreviewKind, string> = {
  read: `${CANONICAL}/read?url=URL`,
  links: `${CANONICAL}/links?url=URL`,
  check: `${CANONICAL}/check?domain=DOMAIN`,
  company: `${CANONICAL}/company?domain=DOMAIN`,
  "uk-company": `${CANONICAL}/uk-company?number=NUM` ,
  "uk-company-lite": `${CANONICAL}/uk-company-lite?number=NUM`,
  convert: `${CANONICAL}/convert?url=URL`,
  "company-full": `${CANONICAL}/company-full?domain=DOMAIN`,
  "uk-charity": `${CANONICAL}/uk-charity?number=NUM`,
  "uk-charity-full": `${CANONICAL}/uk-charity-full?number=NUM`,
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
    default:
      return { ...u, error: "unknown preview kind" };
  }
}

/** Frozen real samples (generated offline / first warm). Keep intentionally partial. */
export const STATIC_SAMPLES: Record<string, any> = {
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
    url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    detected_format: "pdf", title: null, pages: 1, word_count: 1,
    text_preview: "Dummy PDF file…",
  },
  read: {
    url: "https://example.com", title: "Example Domain", word_count: 16, language: "en",
    markdown_preview: "Example Domain\n\nThis domain is for use in illustrative examples…",
    links_count: 1, links_sample: [{ url: "https://www.iana.org/domains/example", text: "More information...", internal: false }],
  },
};
