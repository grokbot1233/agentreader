# AgentReader — pay-per-call web reader & domain checker for AI agents (x402)

**Live:** https://agentreader.yasirawouda1.workers.dev · **MCP:** https://agentreader.yasirawouda1.workers.dev/mcp (streamable HTTP)

No API keys, no accounts, no subscriptions. Agents pay per request in **USDC on Base mainnet** using the [x402](https://x402.org) protocol (HTTP 402).

| Endpoint | MCP tool | Price | Returns |
|---|---|---|---|
| `GET/POST /read?url=` | `read_url` | $0.002 | Clean Markdown + metadata (title, description, canonical, author, date, language, word count, links) |
| `GET/POST /links?url=` | `extract_links` | $0.001 | De-duplicated absolute links with anchor text + internal flag |
| `GET/POST /check?domain=` | `check_domain` | $0.001 | DNS via DoH (A/AAAA/CNAME/MX/TXT/NS/CAA/SOA, DNSSEC), TLS/HTTPS, redirects, HSTS, MX/SPF/DMARC, issues + score |

Payment: x402 v2, scheme `exact`, network `eip155:8453`, asset USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, payTo `0xB1A4e2C441fa896AF010222659AAbBb71E9Ef1D1`, facilitator PayAI. Payers sign an EIP-3009 authorization — **no ETH gas needed**.

Free discovery: [`/llms.txt`](https://agentreader.yasirawouda1.workers.dev/llms.txt) · [`/openapi.json`](https://agentreader.yasirawouda1.workers.dev/openapi.json) · [`/.well-known/x402`](https://agentreader.yasirawouda1.workers.dev/.well-known/x402) · `/health`

## HTTP: @x402/fetch

```ts
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const client = new x402Client().register("eip155:8453", new ExactEvmScheme(privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)));
const fetchPaid = wrapFetchWithPayment(fetch, client);
const r = await fetchPaid("https://agentreader.yasirawouda1.workers.dev/read?url=https://example.com");
console.log((await r.json()).markdown);
```

## HTTP: x402-axios

```ts
import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";
import { privateKeyToAccount } from "viem/accounts";

const api = withPaymentInterceptor(axios.create({ baseURL: "https://agentreader.yasirawouda1.workers.dev" }), privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`));
const { data } = await api.get("/check", { params: { domain: "example.com" } });
```

Or with plain curl: call without payment, read the base64 `PAYMENT-REQUIRED` header, sign, retry with `PAYMENT-SIGNATURE`.

## MCP (paid tools via @x402/mcp)

Remote MCP server, streamable HTTP, stateless: `https://agentreader.yasirawouda1.workers.dev/mcp`

Tools: `read_url`, `extract_links`, `check_domain` (paid) and `pricing` (free). Calling a paid tool without payment returns an x402 `PaymentRequired` result (code 402) containing the requirements; the client retries with the payment in `_meta["x402/payment"]`. This is the official [`@x402/mcp`](https://www.npmjs.com/package/@x402/mcp) pattern, so an x402-aware MCP client pays automatically:

```ts
import { createx402MCPClient } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { privateKeyToAccount } from "viem/accounts";

const client = createx402MCPClient({
  name: "my-agent", version: "1.0.0",
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)) }],
  autoPayment: true,
  onPaymentRequested: async ({ paymentRequired }) => BigInt(paymentRequired.accepts[0].amount) <= 2000n, // cap $0.002
});
await client.connect(new StreamableHTTPClientTransport(new URL("https://agentreader.yasirawouda1.workers.dev/mcp")));
const res = await client.callTool("read_url", { url: "https://example.com" });
```

Plain MCP clients (Claude Desktop, Cursor, etc.) can connect too and call `pricing`; paid tools will return the payment requirements.

## Limits

Public http(s) URLs only (private/internal IPs blocked), 3 MB max, 10 s timeout, 5 redirects, results cached ~5 min.

## Self-host

Cloudflare Worker (Hono + `@x402/hono` + `@x402/mcp`). `npm i && npx wrangler deploy`; set `PAY_TO` in `wrangler.toml`, plus secrets `STATS_SECRET` and `DASHBOARD_KEY`.

MIT licensed.
