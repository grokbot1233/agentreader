# Installing the AgentReader MCP server (for Cline and other AI installers)

AgentReader is a pay-per-call data API for AI agents: UK Companies House profiles, KYB reports, UK due-diligence packs, sanctions screening (OFAC / UK / UN / EU), multi-country registry lookups and UK new-company lead lists. Paid calls settle in USDC on Base via x402. **No account or API key is needed.** Without a wallet key, every tool still works in free preview mode (truncated JSON, 8 previews per IP per UTC day).

## Option A: local stdio server (recommended for Cline)

Requires Node.js 18 or later. Add this to `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "agentreader": {
      "command": "npx",
      "args": ["-y", "@axiomworks/agentreader-mcp"],
      "env": {}
    }
  }
}
```

That is enough to explore: tools return free previews and, for paid calls, a `payment_required` payload with the exact USDC price.

To let the agent pay automatically, add a **dedicated, low-balance** Base wallet key that holds a little USDC:

```json
"env": { "AGENTREADER_PRIVATE_KEY": "0x..." }
```

Do not use a main wallet. You are charged only when a call returns 2xx. (Alternative env names: `EVM_PRIVATE_KEY`, `X402_PRIVATE_KEY`.)

## Option B: remote server (streamable HTTP)

```json
{
  "mcpServers": {
    "agentreader": { "url": "https://api.axiomworks.co.uk/mcp" }
  }
}
```

Paid tool calls over the remote server need an x402-aware MCP client (for example `@x402/mcp`). Use Option A if your client cannot pay.

## Verify

Ask Cline: "Use agentreader `uk_company` with number 00445790 in preview mode". You should get TESCO PLC's status, SIC code and red flags.

## Main tools and prices (USDC on Base)

| Tool | Price | What it returns |
|---|---|---|
| `kyb_report` | $2.50 | KYB pack: UK/AU/CA/FR/NO/DK/FI/CH/PL/CZ/BE/SK + US-state (NY/CO/CT/OR/TX) registry, EU VAT, optional GLEIF LEI, website and sanctions screen |
| `uk_dd` | $1.00 | UK due-diligence job: full Companies House pack, sanctions (entity and officers), optional domain check, trust flag |
| `uk_company` | $0.50 | Companies House profile, officers, PSCs, filings, charges, insolvency and red flags |
| `registry_batch` | $0.30 | Batch-verify up to 25 company ids across UK, AU, CA, FR, NO, DK and more |
| `company_full` | $0.65 | Website company research plus multi-registry due diligence |
| `uk_leads` | $1.00 | New UK incorporations by SIC / location, with active director names |
| `uk_watch` | $5.00 / 30 days | Watches one UK company hourly and sends a webhook on status, officer, filing, PSC or charge changes |

Batch sanctions screening (OFAC, UK, UN and EU lists) is available over HTTP at `https://api.axiomworks.co.uk/sanctions-batch` ($1.00).

Exact per-endpoint price, network and expected paid response: https://api.axiomworks.co.uk/buy
