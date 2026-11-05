#!/usr/bin/env node
/**
 * Axiom Works AgentReader stdio MCP for Glama / local introspection.
 * - tools/list works with no secrets / no network (static catalog)
 * - tool calls proxy to https://api.axiomworks.co.uk (HTTP or /mcp) and surface x402 Payment Required when unpaid
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const ORIGIN = process.env.AGENTREADER_ORIGIN || "https://api.axiomworks.co.uk";
const VERSION = "1.4.0";

const qs = (a) => new URLSearchParams(Object.entries(a).filter(([, v]) => v != null && v !== "")).toString();
const CH = z.enum(["base", "ethereum", "arbitrum", "optimism", "polygon"]).optional();
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
    description: "Free: list Axiom Works AgentReader tools, prices and payment details.",
    schema: {},
    http: () => `${ORIGIN}/.well-known/x402`,
    free: true,
  },
  { name: "wallet_balances", description: "EVM wallet balances (native + majors), 5 chains. $0.003 USDC.", schema: { address: z.string(), chain: CH, tokens: z.string().optional() }, http: (a) => `${ORIGIN}/wallet?${qs(a)}` },
  { name: "tx_status", description: "Did a tx/payment land: status, confirmations, fee, decoded ERC20 transfers. $0.003 USDC.", schema: { hash: z.string(), chain: CH }, http: (a) => `${ORIGIN}/tx?${qs(a)}` },
  { name: "token_check", description: "ERC20 token risk: owner, proxy, liquidity, flags, score. $0.01 USDC.", schema: { address: z.string(), chain: CH }, http: (a) => `${ORIGIN}/token-check?${qs(a)}` },
  { name: "fx_rates", description: "ECB FX rates, latest/historical, with conversion. $0.002 USDC.", schema: { base: z.string().optional(), symbols: z.string().optional(), date: z.string().optional(), amount: z.string().optional() }, http: (a) => `${ORIGIN}/fx?${qs(a)}` },
  { name: "ens_lookup", description: "ENS name -> address + records, or reverse. $0.002 USDC.", schema: { name: z.string().optional(), address: z.string().optional() }, http: (a) => `${ORIGIN}/ens?${qs(a)}` },
  { name: "token_metadata", description: "ERC20 name/symbol/decimals/supply. $0.001 USDC.", schema: { address: z.string(), chain: CH }, http: (a) => `${ORIGIN}/token?${qs(a)}` },
  { name: "token_allowance", description: "ERC20 allowance owner->spender, unlimited flag. $0.002 USDC.", schema: { token: z.string(), owner: z.string(), spender: z.string(), chain: CH }, http: (a) => `${ORIGIN}/allowance?${qs(a)}` },
  { name: "contract_info", description: "Contract/proxy/clone/7702/standards/Sourcify name. $0.003 USDC.", schema: { address: z.string(), chain: CH }, http: (a) => `${ORIGIN}/contract?${qs(a)}` },
  { name: "gas_fees", description: "Current gas fees + USD cost estimates. $0.001 USDC.", schema: { chain: CH }, http: (a) => `${ORIGIN}/gas?${qs(a)}` },
  { name: "block_lookup", description: "Block by number or timestamp. $0.001 USDC.", schema: { number: z.string().optional(), timestamp: z.string().optional(), chain: CH }, http: (a) => `${ORIGIN}/block?${qs(a)}` },
  { name: "nft_lookup", description: "NFT owner + metadata. $0.002 USDC.", schema: { contract: z.string(), token_id: z.string(), chain: CH }, http: (a) => `${ORIGIN}/nft?${qs(a)}` },
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
  const server = new McpServer({ name: "agentreader", title: "Axiom Works AgentReader", version: VERSION });
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
