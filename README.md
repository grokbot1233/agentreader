# Axiom Works AgentReader — pay-per-call APIs for AI agents (x402)

**Live:** https://api.axiomworks.co.uk · **MCP:** https://api.axiomworks.co.uk/mcp (streamable HTTP) · Contact: info@axiomworks.co.uk

[![grokbot1233/agentreader MCP server](https://glama.ai/mcp/servers/grokbot1233/agentreader/badges/score.svg)](https://glama.ai/mcp/servers/grokbot1233/agentreader)
[![AgentReader MCP connector](https://glama.ai/mcp/connectors/uk.co.axiomworks.api/agent-reader/badges/score.svg)](https://glama.ai/mcp/connectors/uk.co.axiomworks.api/agent-reader)

No API keys, no accounts. Agents pay per request in **USDC on Base mainnet** using the [x402](https://x402.org) protocol (HTTP 402).

| Endpoint | MCP tool | Price | Returns |
|---|---|---|---|
| `GET/POST /read?url=` | `read_url` | $0.002 | Clean Markdown + metadata |
| `GET/POST /links?url=` | `extract_links` | $0.001 | De-duplicated absolute links |
| `GET/POST /check?domain=` | `check_domain` | $0.001 | DNS/TLS/HSTS/MX/SPF/DMARC + score |
| `GET/POST /company?domain=` | `company_research` | $0.25 | Company research report (tech, contacts, DNS, RDAP, SSL, news) with sources |
| `GET/POST /uk-company?number=` / `?name=` | `uk_company` | $0.50 | Full UK Companies House due-diligence (API) + insolvency + red flags |
| `GET/POST /uk-company-lite?number=` / `?name=` | `uk_company_lite` | $0.05 | UK company snapshot: profile, status, compliance + red flags |
| `GET/POST /company-full?domain=` | `company_full` | $0.65 | Bundle: website research + UK DD when detected ($0.10 off); charity lite when signals present |
| `GET/POST /uk-charity?number=` / `?name=` | `uk_charity` | $0.05 | UK Charity Commission snapshot (status, income, trustees count, activities) |
| `GET/POST /uk-charity-full?number=` / `?name=` | `uk_charity_full` | $0.25 | Full charity DD: trustees, 5y finances, assets, governance, regulatory + red flags |
| `GET/POST /convert?url=` | `convert_document` | $0.03 | PDF/DOCX/HTML → markdown or text |
| `GET /samples/:kind` | — | free* | Truncated real sample + upsell (*8/IP/day) |
| `GET/POST /uk-leads-lite?sic=` | `uk_leads_lite` | $0.25 | UK new incorporations by SIC/area (no directors) |
| `GET/POST /uk-leads?sic=` | `uk_leads` | $1.00 | New cos + active director names + mass-formation flags |
| `POST /uk-leads-feed` | `uk_leads_feed` | $25.00 / 30d | Daily webhook of new matches for your filter |
| `POST /uk-watch` | `uk_watch` | $5.00 / 30d | Hourly Companies House status/officers/filings → webhook |
| `GET/POST /kyb` | `kyb_report` | $2.00 | Website + UK CH + EU VAT → trust flag (screening only) |
| `POST /monitor` | `create_monitor` | $1.00 / 30d | Hourly change monitor → webhook |
| `GET /monitor/:id` | — | free | Monitor status (id is the secret) |

Payment: x402 v2, scheme `exact`, network `eip155:8453`, asset USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, payTo `0x88b1c747c33A5868A34057D8C57318E5602b3ff6` (AgentReader treasury, Coinbase CDP Server Wallet; swept to the operator's Coinbase account in batches), facilitator: Coinbase CDP (Bazaar indexing), PayAI fallback. Mirror: https://agentreader.yasirawouda1.workers.dev · Payers sign EIP-3009 — **no ETH gas needed**.

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

Tools: `read_url`, `extract_links`, `check_domain`, `company_research`, `uk_company`, `uk_company_lite`, `company_full`, `uk_charity`, `uk_charity_full`, `convert_document`, `create_monitor`, plus on-chain/FX/search/UK property tools (paid) and `pricing` (free).

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

## Glama / local stdio MCP

For [Glama](https://glama.ai/mcp/servers) “Runs from source” checks and local clients that prefer stdio, this repo includes a minimal Node MCP server that answers `initialize` and `tools/list` with **no secrets**, and proxies paid tool calls to the live API (unpaid calls return x402 `payment-required` JSON).

```bash
# Without Docker
node glama-mcp/index.js

# With Docker
docker build -t agentreader-mcp .
docker run -i --rm agentreader-mcp
```

`glama.json` claims maintainers for the Glama listing. The hosted streamable-HTTP MCP remains `https://api.axiomworks.co.uk/mcp`.

## Integrations

Copy-paste clients in [`examples/`](./examples/): MCP (Claude Desktop / Cursor), `@x402/fetch`, `x402-axios`, Python x402, LangChain, Vercel AI SDK, OpenAI Agents SDK, CrewAI.

Free quality proof: [`/samples/company`](https://api.axiomworks.co.uk/samples/company) (and `uk-company`, `uk-company-lite`, `convert`, `read`) — truncated, rate-limited, with the exact paid call to make. Or add `&preview=1` on a paid GET.

### npm packages (Axiom Works)

```bash
# Typed SDK
npm i @axiomworks/agentreader

# Stdio MCP (Claude Desktop / Cursor / Claude Code)
npx -y @axiomworks/agentreader-mcp
```

```json
{
  "mcpServers": {
    "agentreader": {
      "command": "npx",
      "args": ["-y", "@axiomworks/agentreader-mcp"],
      "env": { "AGENTREADER_PRIVATE_KEY": "0xYOUR_BASE_USDC_PAYER_KEY" }
    }
  }
}
```

- [`@axiomworks/agentreader`](https://www.npmjs.com/package/@axiomworks/agentreader) — `createClient({ privateKey? })`, one method per tool, auto x402, preview mode
- [`@axiomworks/agentreader-mcp`](https://www.npmjs.com/package/@axiomworks/agentreader-mcp) — stdio MCP; set `AGENTREADER_PRIVATE_KEY` / `EVM_PRIVATE_KEY` to auto-pay

> Unscoped `agentreader-mcp` on npm is a **different** product; use the `@axiomworks` scope.

## Limits

Public http(s) URLs only (private/internal IPs blocked), 3 MB max, timeouts 10–120 s by route, 5 redirects, read/links/check cached ~5 min, max 40 active monitors.

## Self-host

Cloudflare Worker (Hono + `@x402/hono` + `@x402/mcp`). `npm i && npx wrangler deploy`; set `PAY_TO` in `wrangler.toml`, secrets `STATS_SECRET`, `DASHBOARD_KEY`, optional `CDP_API_KEY_ID`/`CDP_API_KEY_SECRET`. Hourly cron runs monitors.

MIT licensed.

## On-chain micro-lookups (v1.4.0, Base/Ethereum/Arbitrum/Optimism/Polygon)
| Route | MCP tool | Price |
|---|---|---|
| `/ens?name=` or `?address=` | ens_lookup | $0.002 |
| `/token?address=&chain=` | token_metadata | $0.001 |
| `/allowance?token=&owner=&spender=` | token_allowance | $0.002 |
| `/contract?address=` | contract_info | $0.003 |
| `/gas?chain=` | gas_fees | $0.001 |
| `/block?number=` or `?timestamp=` | block_lookup | $0.001 |
| `/nft?contract=&token_id=` | nft_lookup | $0.002 |

### Open search and UK official data (new in 1.5)

| Route | MCP tool | Price | Sources |
|---|---|---|---|
| `/search?q=` | web_search | $0.003 | Wikipedia (CC BY-SA), OpenAlex (CC0), arXiv API, Crossref. Merged, deduplicated, ranked. Not a general web index. |
| `/uk-property?postcode=` | uk_property_prices | $0.01 | HM Land Registry Price Paid (OGL v3) + postcodes.io |
| `/uk-area?postcode=` | uk_area_profile | $0.005 | postcodes.io (ONS/OS), data.police.uk, FSA ratings (all OGL v3) |

**Free validation:** every paid route and MCP tool validates input before payment. Bad input gets a free `400` with an error and an example. You are only asked to pay (`402`) for well-formed requests.
| `/wallet`, `/tx`, `/token-check`, `/fx` | wallet_balances, tx_status, token_check, fx_rates | $0.003, $0.003, $0.01, $0.002 |

All support `?preview=1` (free, truncated, 8/IP/day). Edge-cached per input (10 s gas … 1 h token metadata) with multi-provider RPC fallback.
