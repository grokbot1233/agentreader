#!/usr/bin/env node
/**
 * @axiomworks/agentreader-mcp
 * Stdio MCP server for Axiom Works AgentReader.
 * Proxies tool calls to https://api.axiomworks.co.uk (same surface as /mcp).
 * Optional AGENTREADER_PRIVATE_KEY / EVM_PRIVATE_KEY enables auto x402 payment (USDC on Base).
 * Without a key, free previews (&preview=1) still work; paid calls return payment requirements.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS, VERSION, ORIGIN, type ToolDef } from "./tools.js";
import { createFetch } from "./payment.js";

function b64json(header: string | null) {
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return { raw: header.slice(0, 200) };
  }
}

function withPreview(url: string, tool: ToolDef, paying: boolean, args: Record<string, any>): string {
  if (paying || tool.free || tool.method === "POST" || !tool.previewable) return url;
  // Explicit preview:false disables free truncated mode
  if (args?.preview === false || args?.preview === "0") return url;
  const u = new URL(url);
  if (!u.searchParams.has("preview")) u.searchParams.set("preview", "1");
  return u.toString();
}

async function callHttp(
  tool: ToolDef,
  args: Record<string, any>,
  fetchFn: typeof fetch,
  paying: boolean,
) {
  let url = tool.http(args || {});
  url = withPreview(url, tool, paying, args || {});
  const init: RequestInit = {
    method: tool.method || "GET",
    headers: {
      accept: "application/json",
      "user-agent": `axiomworks-agentreader-mcp/${VERSION}`,
    },
  };
  if (tool.method === "POST") {
    (init.headers as Record<string, string>)["content-type"] = "application/json";
    init.body = JSON.stringify(tool.body ? tool.body(args) : args);
  }
  const res = await fetchFn(url, init);
  const pr = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 2000) };
  }

  if (res.status === 402 || pr) {
    const payment = b64json(pr);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: "payment_required",
              status: 402,
              message:
                "This tool is paid via x402 (USDC on Base). Set AGENTREADER_PRIVATE_KEY (or EVM_PRIVATE_KEY) so this MCP server can auto-pay, or retry the HTTP URL with @x402/fetch / @axiomworks/agentreader.",
              paid_http: url.replace(/([?&])preview=1(&|$)/, "$1").replace(/\?$/, ""),
              mcp: `${ORIGIN}/mcp`,
              preview_hint:
                "Without a key, GET tools are called with preview=1 (free truncated sample, 8/IP/day).",
              payment_required: payment,
              body,
            },
            null,
            2,
          ),
        },
      ],
    };
  }
  if (!res.ok) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { error: body?.error || `HTTP ${res.status}`, status: res.status, body },
            null,
            2,
          ),
        },
      ],
    };
  }
  return {
    content: [{ type: "text" as const, text: typeof body === "string" ? body : JSON.stringify(body) }],
  };
}

async function main() {
  const { fetch: fetchFn, paying } = createFetch();
  const server = new McpServer({
    name: "agentreader",
    title: "Axiom Works AgentReader",
    version: VERSION,
  });

  for (const t of TOOLS) {
    server.tool(t.name, t.description, t.schema, async (args) => {
      try {
        return await callHttp(t, (args as Record<string, any>) || {}, fetchFn, paying);
      } catch (e: any) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(e?.message || e) }],
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
