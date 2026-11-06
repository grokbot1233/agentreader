# @axiomworks/agentreader-mcp

**Axiom Works AgentReader** — stdio [MCP](https://modelcontextprotocol.io) server for AI agents.

> Not affiliated with other products named “AgentReader”. This is **Axiom Works AgentReader** at [api.axiomworks.co.uk](https://api.axiomworks.co.uk).

26 pay-per-call tools: web → Markdown, UK Companies House & Charity Commission due diligence, Land Registry / area profiles, document conversion, change monitors, EVM wallet/tx/token/ENS/gas/NFT lookups, ECB FX, and open research search.

Payments use **[x402](https://x402.org) v2 exact** — **USDC on Base** (`eip155:8453`). No API keys or accounts.

- **API:** https://api.axiomworks.co.uk  
- **Remote MCP (streamable HTTP):** https://api.axiomworks.co.uk/mcp  
- **Dashboard:** https://api.axiomworks.co.uk/dashboard  
- **Landing:** https://grokbot1233.github.io/agentreader/  
- **Repo:** https://github.com/grokbot1233/agentreader  
- **Typed JS/TS SDK:** [`@axiomworks/agentreader`](https://www.npmjs.com/package/@axiomworks/agentreader)

## Quick start

```bash
npx -y @axiomworks/agentreader-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentreader": {
      "command": "npx",
      "args": ["-y", "@axiomworks/agentreader-mcp"],
      "env": {
        "AGENTREADER_PRIVATE_KEY": "0xYOUR_BASE_USDC_PAYER_KEY"
      }
    }
  }
}
```

### Cursor

Add to MCP settings (`.cursor/mcp.json` or Cursor Settings → MCP):

```json
{
  "mcpServers": {
    "agentreader": {
      "command": "npx",
      "args": ["-y", "@axiomworks/agentreader-mcp"],
      "env": {
        "AGENTREADER_PRIVATE_KEY": "0xYOUR_BASE_USDC_PAYER_KEY"
      }
    }
  }
}
```

### Claude Code

```json
{
  "mcpServers": {
    "agentreader": {
      "command": "npx",
      "args": ["-y", "@axiomworks/agentreader-mcp"],
      "env": {
        "AGENTREADER_PRIVATE_KEY": "0xYOUR_BASE_USDC_PAYER_KEY"
      }
    }
  }
}
```

Omit `AGENTREADER_PRIVATE_KEY` to explore free **preview** responses (truncated, 8/IP/day) and the free `pricing` tool. Paid calls without a key return a clear `payment_required` payload with x402 requirements.

Alternative env names: `EVM_PRIVATE_KEY`, `PRIVATE_KEY`, `X402_PRIVATE_KEY`.

Override API origin (advanced): `AGENTREADER_ORIGIN=https://api.axiomworks.co.uk`.

### Remote HTTP MCP (no npm)

Clients that speak streamable HTTP can use the hosted server directly:

```json
{
  "mcpServers": {
    "agentreader": {
      "url": "https://api.axiomworks.co.uk/mcp"
    }
  }
}
```

(Configure an x402-capable MCP client / wallet for paid tools.)

## How payment works (x402)

1. Tool call hits a paid HTTP route on `api.axiomworks.co.uk`.
2. Server responds **HTTP 402** with a `PAYMENT-REQUIRED` header (x402 v2).
3. With `AGENTREADER_PRIVATE_KEY` set, this package uses [`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch) + [`@x402/evm`](https://www.npmjs.com/package/@x402/evm) `ExactEvmScheme` to sign an EIP-3009 USDC transfer on **Base** and retry.
4. Facilitator settles; you get the JSON result. **No ETH gas needed** for the payer (EIP-3009).

Network: `eip155:8453` · Asset: USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

Fund a Base wallet with a few dollars of USDC for testing. Keep the key offline; never commit it.

Without a key, GET tools automatically add `preview=1` so you still see truncated samples.

## Tools & prices (USDC)

| MCP tool | HTTP | Price | Returns |
|---|---|---|---|
| `read_url` | `/read?url=` | $0.002 | Clean Markdown + metadata |
| `extract_links` | `/links?url=` | $0.001 | De-duplicated absolute links |
| `check_domain` | `/check?domain=` | $0.001 | DNS/TLS/MX/SPF/DMARC + score |
| `company_research` | `/company?domain=` | $0.25 | Website company research (sourced) |
| `uk_company` | `/uk-company?number=` / `name=` | $0.50 | Full UK Companies House DD + red flags |
| `uk_company_lite` | `/uk-company-lite?...` | $0.05 | UK company snapshot |
| `company_full` | `/company-full?domain=` | $0.65 | Website research + multi-registry DD when signals match |
| `uk_charity` | `/uk-charity?...` | $0.05 | Charity Commission snapshot |
| `uk_charity_full` | `/uk-charity-full?...` | $0.25 | Full charity DD + red flags |
| `convert_document` | `/convert?url=` | $0.03 | PDF/DOCX/HTML → markdown/text |
| `create_monitor` | `POST /monitor` | $1.00 / 30d | Hourly change → webhook |
| `wallet_balances` | `/wallet` | $0.003 | EVM balances (5 chains) |
| `tx_status` | `/tx` | $0.003 | Tx status + decoded transfers |
| `token_check` | `/token-check` | $0.01 | ERC20 risk score |
| `fx_rates` | `/fx` | $0.002 | ECB FX + conversion |
| `ens_lookup` | `/ens` | $0.002 | ENS forward/reverse |
| `token_metadata` | `/token` | $0.001 | name/symbol/decimals/supply |
| `token_allowance` | `/allowance` | $0.002 | ERC20 allowance |
| `contract_info` | `/contract` | $0.003 | Proxy/clone/7702/standards |
| `gas_fees` | `/gas` | $0.001 | Live gas + USD estimates |
| `block_lookup` | `/block` | $0.001 | Block by number/time |
| `nft_lookup` | `/nft` | $0.002 | NFT owner + metadata |
| `web_search` | `/search?q=` | $0.003 | Wikipedia+OpenAlex+arXiv+Crossref |
| `uk_property_prices` | `/uk-property` | $0.01 | HM Land Registry near postcode |
| `uk_area_profile` | `/uk-area` | $0.005 | ONS + police + FSA hygiene |
| `pricing` | `/.well-known/x402` | **free** | Catalog + payment details |

Free discovery also: [`/llms.txt`](https://api.axiomworks.co.uk/llms.txt) · [`/openapi.json`](https://api.axiomworks.co.uk/openapi.json) · [`/samples/:kind`](https://api.axiomworks.co.uk/samples/company) · `/health`

## Install

```bash
npm i -g @axiomworks/agentreader-mcp
agentreader-mcp
```

Or pin in a project:

```bash
npm i @axiomworks/agentreader-mcp
```

## Links

- npm SDK: https://www.npmjs.com/package/@axiomworks/agentreader  
- Glama listing: https://glama.ai/mcp/servers/grokbot1233/agentreader  
- Contact: info@axiomworks.co.uk  

MIT © Axiom Works
