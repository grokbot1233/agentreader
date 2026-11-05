# AgentReader — pay-per-call APIs for AI agents (x402)

**Live:** https://api.axiomworks.co.uk · **MCP:** https://api.axiomworks.co.uk/mcp (streamable HTTP) · Contact: info@axiomworks.co.uk

No API keys, no accounts. Agents pay per request in **USDC on Base mainnet** using the [x402](https://x402.org) protocol (HTTP 402).

| Endpoint | MCP tool | Price | Returns |
|---|---|---|---|
| `GET/POST /read?url=` | `read_url` | $0.002 | Clean Markdown + metadata |
| `GET/POST /links?url=` | `extract_links` | $0.001 | De-duplicated absolute links |
| `GET/POST /check?domain=` | `check_domain` | $0.001 | DNS/TLS/HSTS/MX/SPF/DMARC + score |
| `GET/POST /company?domain=` | `company_research` | $0.25 | Company research report (tech, contacts, DNS, RDAP, SSL, news) with sources |
| `GET/POST /uk-company?number=` / `?name=` | `uk_company` | $0.50 | Full UK Companies House due-diligence (API) + insolvency + red flags |
| `GET/POST /uk-company-lite?number=` / `?name=` | `uk_company_lite` | $0.05 | UK company snapshot: profile, status, compliance + red flags |
| `GET/POST /convert?url=` | `convert_document` | $0.03 | PDF/DOCX/HTML → markdown or text |
| `POST /monitor` | `create_monitor` | $1.00 / 30d | Hourly change monitor → webhook |
| `GET /monitor/:id` | — | free | Monitor status (id is the secret) |

Payment: x402 v2, scheme `exact`, network `eip155:8453`, asset USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, payTo `0xB1A4e2C441fa896AF010222659AAbBb71E9Ef1D1`, facilitator: Coinbase CDP (Bazaar indexing), PayAI fallback. Mirror: https://agentreader.yasirawouda1.workers.dev · Payers sign EIP-3009 — **no ETH gas needed**.

Free discovery: [`/llms.txt`](https://api.axiomworks.co.uk/llms.txt) · [`/openapi.json`](https://api.axiomworks.co.uk/openapi.json) · [`/.well-known/x402`](https://api.axiomworks.co.uk/.well-known/x402) · [`/.well-known/agent.json`](https://api.axiomworks.co.uk/.well-known/agent.json) · `/health`

## HTTP: @x402/fetch

```ts
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const client = new x402Client().register("eip155:8453", new ExactEvmScheme(privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)));
const fetchPaid = wrapFetchWithPayment(fetch, client);
const r = await fetchPaid("https://api.axiomworks.co.uk/company?domain=stripe.com");
console.log(await r.json());
```

## MCP (paid tools via @x402/mcp)

Remote MCP server, streamable HTTP, stateless: `https://api.axiomworks.co.uk/mcp`

Tools: `read_url`, `extract_links`, `check_domain`, `company_research`, `uk_company`, `uk_company_lite`, `convert_document`, `create_monitor` (paid) and `pricing` (free).

```ts
import { createx402MCPClient } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { privateKeyToAccount } from "viem/accounts";

const client = createx402MCPClient({
  name: "my-agent", version: "1.0.0",
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)) }],
  autoPayment: true,
  onPaymentRequested: async ({ paymentRequired }) => BigInt(paymentRequired.accepts[0].amount) <= 250000n, // cap per call
});
await client.connect(new StreamableHTTPClientTransport(new URL("https://api.axiomworks.co.uk/mcp")));
const res = await client.callTool("company_research", { domain: "stripe.com" });
```

## Limits

Public http(s) URLs only (private/internal IPs blocked), 3 MB max, timeouts 10–120 s by route, 5 redirects, read/links/check cached ~5 min, max 40 active monitors.

## Self-host

Cloudflare Worker (Hono + `@x402/hono` + `@x402/mcp`). `npm i && npx wrangler deploy`; set `PAY_TO` in `wrangler.toml`, secrets `STATS_SECRET`, `DASHBOARD_KEY`, optional `CDP_API_KEY_ID`/`CDP_API_KEY_SECRET`. Hourly cron runs monitors.

MIT licensed.
