#!/usr/bin/env node
/**
 * AgentReader stdio MCP for Glama / local introspection.
 * - tools/list works with no secrets / no network (static catalog)
 * - tool calls proxy to https://api.axiomworks.co.uk (HTTP or /mcp) and surface x402 Payment Required when unpaid
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const ORIGIN = process.env.AGENTREADER_ORIGIN || "https://api.axiomworks.co.uk";
const VERSION = "1.2.0";

const TOOLS = [
  {
    name: "read_url",
    description: "Use this when you need clean Markdown + metadata from a public URL (not raw HTML). $0.002 USDC on Base via x402.",
    schema: { url: z.string().url() },
    http: (a) => `${ORIGIN}/read?url=${encodeURIComponent(a.url)}`,
  },
  {
    name: "extract_links",
    description: "Use this when you only need de-duplicated absolute links. $0.001 USDC.",
    schema: { url: z.string().url() },
    http: (a) => `${ORIGIN}/links?url=${encodeURIComponent(a.url)}`,
  },
  {
    name: "check_domain",
    description: "Use this when vetting domain health: DNS/TLS/MX/SPF/DMARC + score. $0.001 USDC.",
    schema: { domain: z.string() },
    http: (a) => `${ORIGIN}/check?domain=${encodeURIComponent(a.domain)}`,
  },
  {
    name: "company_research",
    description: "Website company research (tech, contacts, DNS, RDAP, news) with sources — not UK Companies House. $0.25 USDC.",
    schema: { domain: z.string() },
    http: (a) => `${ORIGIN}/company?domain=${encodeURIComponent(a.domain)}`,
  },
  {
    name: "uk_company",
    description: "Full UK Companies House due diligence (number or name) + red flags. $0.50 USDC. Prefer uk_company_lite for a cheap snapshot.",
    schema: { number: z.string().optional(), name: z.string().optional() },
    http: (a) => a.number
      ? `${ORIGIN}/uk-company?number=${encodeURIComponent(a.number)}`
      : `${ORIGIN}/uk-company?name=${encodeURIComponent(a.name || "")}`,
  },
  {
    name: "uk_company_lite",
    description: "Cheap UK company snapshot: status, compliance, red flags. $0.05 USDC.",
    schema: { number: z.string().optional(), name: z.string().optional() },
    http: (a) => a.number
      ? `${ORIGIN}/uk-company-lite?number=${encodeURIComponent(a.number)}`
      : `${ORIGIN}/uk-company-lite?name=${encodeURIComponent(a.name || "")}`,
  },
  {
    name: "company_full",
    description: "Website company research + UK CH pack when detected ($0.65 vs $0.75 separate).",
    schema: { domain: z.string() },
    http: (a) => `${ORIGIN}/company-full?domain=${encodeURIComponent(a.domain)}`,
  },
  {
    name: "convert_document",
    description: "Convert public PDF/DOCX/HTML/text URL to markdown or text. $0.03 USDC.",
    schema: { url: z.string().url(), format: z.enum(["markdown", "text"]).optional() },
    http: (a) => `${ORIGIN}/convert?url=${encodeURIComponent(a.url)}&format=${encodeURIComponent(a.format || "markdown")}`,
  },
  {
    name: "create_monitor",
    description: "30-day hourly web change monitor → webhook. $1.00 USDC. POST body.",
    schema: {
      url: z.string().url(),
      webhook: z.string().url(),
      selector: z.string().optional(),
      keyword: z.string().optional(),
    },
    http: () => `${ORIGIN}/monitor`,
    method: "POST",
    body: (a) => a,
  },
  {
    name: "pricing",
    description: "Free: list AgentReader tools, prices and payment details.",
    schema: {},
    http: () => `${ORIGIN}/.well-known/x402`,
    free: true,
  },
];

function b64json(header) {
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return { raw: header.slice(0, 200) };
  }
}

async function callHttp(tool, args) {
  const url = tool.http(args);
  const init = {
    method: tool.method || "GET",
    headers: { accept: "application/json", "user-agent": `agentreader-glama-mcp/${VERSION}` },
  };
  if (tool.method === "POST") {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(tool.body ? tool.body(args) : args);
  }
  const res = await fetch(url, init);
  const pr = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }

  if (res.status === 402 || pr) {
    const payment = b64json(pr);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "payment_required",
          status: 402,
          message: "This tool is paid via x402 (USDC on Base). Retry the HTTP URL with an x402 client (@x402/fetch) or MCP client (@x402/mcp).",
          paid_http: url,
          mcp: `${ORIGIN}/mcp`,
          payment_required: payment,
          body,
        }, null, 2),
      }],
    };
  }
  if (!res.ok) {
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({ error: body.error || `HTTP ${res.status}`, status: res.status, body }, null, 2) }],
    };
  }
  return { content: [{ type: "text", text: typeof body === "string" ? body : JSON.stringify(body) }] };
}

async function main() {
  const server = new McpServer({ name: "agentreader", version: VERSION });
  for (const t of TOOLS) {
    const shape = t.schema;
    server.tool(t.name, t.description, shape, async (args) => {
      try {
        return await callHttp(t, args || {});
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text", text: String(e?.message || e) }],
        };
      }
    });
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
