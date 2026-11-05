import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPaymentWrapper, x402ResourceServer } from "@x402/mcp";
import { facilitatorClient } from "./facilitator";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { readUrl, linksFor, checkDomain } from "./core";
import { companyResearch } from "./company";
import { ukCompany } from "./uk-company";
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
    resource: { url: `mcp://tool/${tool}`, description: `AgentReader ${tool}`, mimeType: "application/json", serviceName: "AgentReader", tags: ["web", "scraping", "markdown", "dns", "company", "uk", "pdf", "monitor"] },
    accepts: await rs.buildPaymentRequirements({ scheme: "exact", network: NETWORK, payTo: env.PAY_TO, price, maxTimeoutSeconds: 120 }),
    hooks: { onAfterSettlement: async ({ settlement }: any) => {
      await log({ endpoint: `mcp:${tool}`, payer: settlement?.payer || null, amount: settlement?.amount || String(atomic), network: settlement?.network, tx: settlement?.transaction, success: settlement?.success });
    } },
  } as any);
  const server = new McpServer({ name: "agentreader", version: "1.1.1" });
  const json = (d: any) => ({ content: [{ type: "text" as const, text: JSON.stringify(d) }] });
  const err = (e: any) => ({ isError: true, content: [{ type: "text" as const, text: String(e?.message || e) }] });
  const wrap = (fn: (v: string) => Promise<any>, k: string) => async (a: any) => { try { return json(await fn(a[k])); } catch (e) { return err(e); } };

  server.tool("read_url", "Fetch a public web page and return clean Markdown + metadata (title, author, date, language, word count, links). Costs $0.002 USDC on Base via x402.",
    { url: z.string().url() }, (await mk("$0.002", "read_url", 2000))(wrap(readUrl, "url")) as any);
  server.tool("extract_links", "Extract all de-duplicated absolute links (with anchor text, internal flag) from a public web page. Costs $0.001 USDC on Base via x402.",
    { url: z.string().url() }, (await mk("$0.001", "extract_links", 1000))(wrap(linksFor, "url")) as any);
  server.tool("check_domain", "Domain health check: DNS (DoH), DNSSEC, TLS/HTTPS, redirects, HSTS, MX/SPF/DMARC, issues and score. Costs $0.001 USDC on Base via x402.",
    { domain: z.string() }, (await mk("$0.001", "check_domain", 1000))(wrap(checkDomain, "domain")) as any);
  server.tool("company_research", "Structured company research from real fetched data (no LLM): homepage + key pages, tech stack, socials, emails/phones, DNS/MX/SPF/DMARC, RDAP, SSL, sitemap, news. Costs $0.25 USDC on Base via x402.",
    { domain: z.string() }, (await mk("$0.25", "company_research", 250000))(async (a: any) => { try { return json(await companyResearch({ domain: a.domain })); } catch (e) { return err(e); } }) as any);
  server.tool("uk_company", "Full UK Companies House due-diligence pack via official REST API (public fallback): profile, officers, PSCs, filings, charges, insolvency, overdue flags, mass-formation office, red-flags. Pass number or name. Costs $0.50 USDC on Base via x402.",
    { number: z.string().optional(), name: z.string().optional() },
    (await mk("$0.50", "uk_company", 500000))(async (a: any) => { try { return json(await ukCompany(env, { number: a.number, name: a.name })); } catch (e) { return err(e); } }) as any);
  server.tool("uk_company_lite", "Cheap UK company snapshot: profile, status, SIC, office, compliance flags and red-flags. Costs $0.05 USDC on Base via x402. Use uk_company for the full pack.",
    { number: z.string().optional(), name: z.string().optional() },
    (await mk("$0.05", "uk_company_lite", 50000))(async (a: any) => { try { return json(await ukCompany(env, { number: a.number, name: a.name, lite: true })); } catch (e) { return err(e); } }) as any);
  server.tool("convert_document", "Convert a public PDF, DOCX, HTML or text URL to markdown or plain text. Costs $0.03 USDC on Base via x402.",
    { url: z.string().url(), format: z.enum(["markdown", "text"]).optional() },
    (await mk("$0.03", "convert_document", 30000))(async (a: any) => { try { return json(await convertDocument(a.url, a.format === "text" ? "text" : "markdown")); } catch (e) { return err(e); } }) as any);
  server.tool("create_monitor", "Create a 30-day hourly web change monitor. POSTs JSON to webhook on change. Returns id; GET /monitor/:id is free. Costs $1.00 USDC on Base via x402.",
    { url: z.string().url(), webhook: z.string().url(), selector: z.string().optional(), keyword: z.string().optional() },
    (await mk("$1.00", "create_monitor", 1000000))(async (a: any) => {
      try {
        const mon = await createMonitor(env, { url: a.url, webhook: a.webhook, selector: a.selector, keyword: a.keyword });
        return json({ ...mon, status_url: `https://api.axiomworks.co.uk/monitor/${mon.id}` });
      } catch (e) { return err(e); }
    }) as any);
  server.tool("pricing", "Free: list AgentReader tools, prices and payment details.", {}, async () => json({
    network: NETWORK, asset: "USDC", payTo: env.PAY_TO,
    tools: {
      read_url: "$0.002", extract_links: "$0.001", check_domain: "$0.001",
      company_research: "$0.25", uk_company: "$0.50", uk_company_lite: "$0.05",
      convert_document: "$0.03", create_monitor: "$1.00 / 30 days", pricing: "free",
    },
    http: {
      "/read": "$0.002", "/links": "$0.001", "/check": "$0.001",
      "/company": "$0.25", "/uk-company": "$0.50", "/uk-company-lite": "$0.05",
      "/convert": "$0.03", "/monitor": "$1.00 / 30 days", "GET /monitor/:id": "free",
    },
    how: "Paid tools return an x402 PaymentRequired error; retry with _meta['x402/payment'] (use @x402/mcp createx402MCPClient).",
  }));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}
