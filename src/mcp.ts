import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPaymentWrapper, x402ResourceServer } from "@x402/mcp";
import { facilitatorClient } from "./facilitator";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { readUrl, linksFor, checkDomain } from "./core";
import { companyResearch } from "./company";
import { ukCompany } from "./uk-company";
import { companyFull } from "./company-full";
import { convertDocument } from "./convert";
import { createMonitor } from "./monitor";

const NETWORK = "eip155:8453";
let rs: any = null; let ready: Promise<any> | null = null;

export async function handleMcp(req: Request, env: any, log: (rec: any) => Promise<void>) {
  if (!rs) {
    rs = new x402ResourceServer(facilitatorClient(env));
    rs.register(NETWORK, new ExactEvmScheme());
    ready = rs.initialize();
  }
  await ready;
  const mk = async (price: string, tool: string, atomic: number) => createPaymentWrapper(rs, {
    resource: { url: `mcp://tool/${tool}`, description: `AgentReader ${tool}`, mimeType: "application/json", serviceName: "AgentReader", tags: ["web", "scraping", "markdown", "dns", "company", "uk", "pdf", "monitor", "x402"] },
    accepts: await rs.buildPaymentRequirements({ scheme: "exact", network: NETWORK, payTo: env.PAY_TO, price, maxTimeoutSeconds: 120 }),
    hooks: { onAfterSettlement: async ({ settlement }: any) => {
      await log({ endpoint: `mcp:${tool}`, payer: settlement?.payer || null, amount: settlement?.amount || String(atomic), network: settlement?.network, tx: settlement?.transaction, success: settlement?.success });
    } },
  } as any);
  const server = new McpServer({ name: "agentreader", version: "1.2.0" });
  const json = (d: any) => ({ content: [{ type: "text" as const, text: JSON.stringify(d) }] });
  const err = (e: any) => ({ isError: true, content: [{ type: "text" as const, text: String(e?.message || e) }] });

  server.tool("read_url",
    "Use this when you need clean Markdown + metadata from a public URL (not raw HTML). Returns title, author, date, language, word_count, markdown, links. Better for RAG/summaries than fetch. Example: {url:\"https://example.com\"}. $0.002 USDC on Base via x402.",
    { url: z.string().url() },
    (await mk("$0.002", "read_url", 2000))(async (a: any) => { try { return json(await readUrl(a.url)); } catch (e) { return err(e); } }) as any);

  server.tool("extract_links",
    "Use this when you only need de-duplicated absolute links (crawl maps). Cheaper/faster than read_url. Example: {url} → {count, links:[{url,text,internal}]}. $0.001 USDC.",
    { url: z.string().url() },
    (await mk("$0.001", "extract_links", 1000))(async (a: any) => { try { return json(await linksFor(a.url)); } catch (e) { return err(e); } }) as any);

  server.tool("check_domain",
    "Use this when vetting domain health before outreach: DNS (DoH), DNSSEC, TLS/HTTPS, HSTS, MX/SPF/DMARC, issues + score. Structured JSON beats shell dig/openssl. Example: {domain:\"stripe.com\"}. $0.001 USDC.",
    { domain: z.string() },
    (await mk("$0.001", "check_domain", 1000))(async (a: any) => { try { return json(await checkDomain(a.domain)); } catch (e) { return err(e); } }) as any);

  server.tool("company_research",
    "Use this when researching a company from its website domain (not UK Companies House). Sourced tech stack, socials, emails/phones, DNS/MX/SPF/DMARC, RDAP, SSL, sitemap, news — no LLM fiction. Example: {domain:\"stripe.com\"}. Prefer uk_company* for UK filings. $0.25 USDC.",
    { domain: z.string() },
    (await mk("$0.25", "company_research", 250000))(async (a: any) => { try { return json(await companyResearch({ domain: a.domain })); } catch (e) { return err(e); } }) as any);

  server.tool("uk_company",
    "Use this for full UK Companies House due diligence (number or name): profile, officers, PSCs, filings, charges, insolvency + red flags (overdue, dissolved, officer churn, mass-formation office). Official API with public fallback. Example: {number:\"00445790\"}. Prefer uk_company_lite ($0.05) for status/flags only. $0.50 USDC.",
    { number: z.string().optional(), name: z.string().optional() },
    (await mk("$0.50", "uk_company", 500000))(async (a: any) => { try { return json(await ukCompany(env, { number: a.number, name: a.name })); } catch (e) { return err(e); } }) as any);

  server.tool("uk_company_lite",
    "Use this for a cheap UK company snapshot: status, SIC, office, compliance overdue, mass-formation check, red flags. Example: {number:\"00445790\"}. Upsell uk_company for officers/PSC/filings/charges/insolvency. $0.05 USDC.",
    { number: z.string().optional(), name: z.string().optional() },
    (await mk("$0.05", "uk_company_lite", 50000))(async (a: any) => { try { return json(await ukCompany(env, { number: a.number, name: a.name, lite: true })); } catch (e) { return err(e); } }) as any);

  server.tool("company_full",
    "Use this for website company research + UK Companies House pack in one call ($0.65 vs $0.75 separate). Attaches UK DD when .uk TLD or CH number detected. Example: {domain:\"tesco.com\"} → {company, uk, uk_included}. $0.65 USDC.",
    { domain: z.string() },
    (await mk("$0.65", "company_full", 650000))(async (a: any) => { try { return json(await companyFull(env, { domain: a.domain })); } catch (e) { return err(e); } }) as any);

  server.tool("convert_document",
    "Use this when converting a public PDF/DOCX/HTML/text URL to markdown or plain text for RAG/summaries. Example: {url, format:\"markdown\"} → {detected_format, markdown, pages, word_count}. $0.03 USDC.",
    { url: z.string().url(), format: z.enum(["markdown", "text"]).optional() },
    (await mk("$0.03", "convert_document", 30000))(async (a: any) => { try { return json(await convertDocument(a.url, a.format === "text" ? "text" : "markdown")); } catch (e) { return err(e); } }) as any);

  server.tool("create_monitor",
    "Use this for 30 days of hourly web change monitoring with webhook alerts (pricing/status/jobs pages). Returns id; GET /monitor/:id is free. Example: {url, webhook, selector?}. $1.00 USDC.",
    { url: z.string().url(), webhook: z.string().url(), selector: z.string().optional(), keyword: z.string().optional() },
    (await mk("$1.00", "create_monitor", 1000000))(async (a: any) => {
      try {
        const mon = await createMonitor(env, { url: a.url, webhook: a.webhook, selector: a.selector, keyword: a.keyword });
        return json({ ...mon, status_url: `https://api.axiomworks.co.uk/monitor/${mon.id}` });
      } catch (e) { return err(e); }
    }) as any);

  server.tool("pricing", "Free: list AgentReader tools, prices, when-to-use hints and payment details.", {}, async () => json({
    network: NETWORK, asset: "USDC", payTo: env.PAY_TO,
    samples: "https://api.axiomworks.co.uk/samples/{read|company|uk-company|uk-company-lite|convert}",
    tools: {
      read_url: { price: "$0.002", when: "page → Markdown + metadata" },
      extract_links: { price: "$0.001", when: "links only" },
      check_domain: { price: "$0.001", when: "DNS/TLS/email health" },
      company_research: { price: "$0.25", when: "website company research (not UK CH)" },
      uk_company: { price: "$0.50", when: "full UK Companies House DD" },
      uk_company_lite: { price: "$0.05", when: "cheap UK status + flags" },
      company_full: { price: "$0.65", when: "website + UK DD bundle" },
      convert_document: { price: "$0.03", when: "PDF/DOCX → markdown" },
      create_monitor: { price: "$1.00 / 30 days", when: "hourly change webhooks" },
      pricing: { price: "free" },
    },
    how: "Paid tools return x402 PaymentRequired; retry with _meta['x402/payment'] via @x402/mcp createx402MCPClient.",
  }));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}
