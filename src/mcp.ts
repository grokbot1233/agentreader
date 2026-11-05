import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPaymentWrapper, x402ResourceServer } from "@x402/mcp";
import { facilitatorClient } from "./facilitator";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { readUrl, linksFor, checkDomain } from "./core";

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
    resource: { url: `mcp://tool/${tool}`, description: `AgentReader ${tool}`, mimeType: "application/json", serviceName: "AgentReader", tags: ["web", "scraping", "markdown", "dns"] },
    accepts: await rs.buildPaymentRequirements({ scheme: "exact", network: NETWORK, payTo: env.PAY_TO, price, maxTimeoutSeconds: 120 }),
    hooks: { onAfterSettlement: async ({ settlement }: any) => {
      await log({ endpoint: `mcp:${tool}`, payer: settlement?.payer || null, amount: settlement?.amount || String(atomic), network: settlement?.network, tx: settlement?.transaction, success: settlement?.success });
    } },
  } as any);
  const server = new McpServer({ name: "agentreader", version: "1.0.0" });
  const json = (d: any) => ({ content: [{ type: "text" as const, text: JSON.stringify(d) }] });
  const err = (e: any) => ({ isError: true, content: [{ type: "text" as const, text: String(e?.message || e) }] });
  const wrap = (fn: (v: string) => Promise<any>, k: string) => async (a: any) => { try { return json(await fn(a[k])); } catch (e) { return err(e); } };
  server.tool("read_url", "Fetch a public web page and return clean Markdown + metadata (title, author, date, language, word count, links). Costs $0.002 USDC on Base via x402.",
    { url: z.string().url() }, (await mk("$0.002", "read_url", 2000))(wrap(readUrl, "url")) as any);
  server.tool("extract_links", "Extract all de-duplicated absolute links (with anchor text, internal flag) from a public web page. Costs $0.001 USDC on Base via x402.",
    { url: z.string().url() }, (await mk("$0.001", "extract_links", 1000))(wrap(linksFor, "url")) as any);
  server.tool("check_domain", "Domain health check: DNS (DoH), DNSSEC, TLS/HTTPS, redirects, HSTS, MX/SPF/DMARC, issues and score. Costs $0.001 USDC on Base via x402.",
    { domain: z.string() }, (await mk("$0.001", "check_domain", 1000))(wrap(checkDomain, "domain")) as any);
  server.tool("pricing", "Free: list AgentReader tools, prices and payment details.", {}, async () => json({
    network: NETWORK, asset: "USDC", payTo: env.PAY_TO, tools: { read_url: "$0.002", extract_links: "$0.001", check_domain: "$0.001" },
    how: "Paid tools return an x402 PaymentRequired error; retry with _meta['x402/payment'] (use @x402/mcp createx402MCPClient)." }));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}
