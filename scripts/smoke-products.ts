import { companyResearch } from "../src/company.ts";
import { ukCompany } from "../src/uk-company.ts";
import { convertDocument } from "../src/convert.ts";

async function main() {
  const t0 = Date.now();
  console.log("=== convert PDF ===");
  const conv = await convertDocument("https://pdfobject.com/pdf/sample.pdf");
  console.log({ detected: conv.detected_format, words: conv.word_count, pages: (conv as any).pages, text: ((conv as any).text || (conv as any).markdown || "").slice(0, 80) });

  console.log("=== company example.com ===");
  const co = await companyResearch({ domain: "example.com" });
  console.log({ domain: co.domain, title: co.homepage.title, tech: co.tech_stack.detected, emails: co.contacts.emails.length, mx: co.dns.mx.length, news: co.news.headlines.length, rdap: co.domain_registration.registrar });

  console.log("=== uk-company 00445790 (public fallback harness) ===");
  const uk = await ukCompany({ LOG: { get: async () => null, put: async () => {} } as any, CH_API_KEY: "" }, { number: "00445790" });
  console.log({ name: uk.profile?.name, status: uk.profile?.status, officers: uk.officers?.total_results ?? uk.officers?.items?.length, flags: uk.red_flags?.map((f: any) => f.flag), sic: uk.profile?.sic_codes, mode: uk.mode });

  console.log("done in", Date.now() - t0, "ms");
}
main().catch((e) => { console.error(e); process.exit(1); });
