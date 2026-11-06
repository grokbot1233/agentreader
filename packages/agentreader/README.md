# @axiomworks/agentreader

Typed JS/TS SDK for **Axiom Works AgentReader** — pay-per-call tools for AI agents.

> Not affiliated with other products named “AgentReader”. This is **Axiom Works AgentReader** at [api.axiomworks.co.uk](https://api.axiomworks.co.uk).

```bash
npm i @axiomworks/agentreader
```

```ts
import { createClient } from "@axiomworks/agentreader";

// Preview mode (no key): free truncated samples
const preview = createClient();
console.log(await preview.checkDomain({ domain: "example.com" }));

// Paid mode: auto x402 USDC on Base
const client = createClient({ privateKey: process.env.AGENTREADER_PRIVATE_KEY });
const report = await client.ukCompanyLite({ number: "00445790" });
```

Also reads `AGENTREADER_PRIVATE_KEY` / `EVM_PRIVATE_KEY` / `PRIVATE_KEY` from the environment when `privateKey` is omitted.

- **API:** https://api.axiomworks.co.uk  
- **MCP (stdio npm):** [`@axiomworks/agentreader-mcp`](https://www.npmjs.com/package/@axiomworks/agentreader-mcp) — `npx -y @axiomworks/agentreader-mcp`  
- **Remote MCP:** https://api.axiomworks.co.uk/mcp  
- **Dashboard:** https://api.axiomworks.co.uk/dashboard  
- **Landing:** https://grokbot1233.github.io/agentreader/  
- **Repo:** https://github.com/grokbot1233/agentreader  

## x402 payments

Paid routes return HTTP 402. With a private key, the SDK wraps `fetch` via [`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch) + `ExactEvmScheme` (`@x402/evm`) and settles **USDC on Base** (`eip155:8453`) automatically (EIP-3009 — no ETH gas for the payer).

Without a key, GET methods append `preview=1` (free truncated JSON, 8/IP/day). A paid response without settlement throws `PaymentRequiredError` with the payment requirements attached.

```ts
import { createClient, PaymentRequiredError } from "@axiomworks/agentreader";

try {
  await createClient().ukCompany({ number: "00445790" }); // preview unless key set
} catch (e) {
  if (e instanceof PaymentRequiredError) console.log(e.paymentRequired);
}
```

## Methods (USDC prices)

| Method | Route | Price |
|---|---|---|
| `readUrl({ url })` | `/read` | $0.002 |
| `extractLinks({ url })` | `/links` | $0.001 |
| `checkDomain({ domain })` | `/check` | $0.001 |
| `companyResearch({ domain })` | `/company` | $0.25 |
| `ukCompany({ number?, name? })` | `/uk-company` | $0.50 |
| `ukCompanyLite({ number?, name? })` | `/uk-company-lite` | $0.05 |
| `companyFull({ domain })` | `/company-full` | $0.65 multi-registry |
| `ukCharity({ number?, name? })` | `/uk-charity` | $0.05 |
| `ukCharityFull({ number?, name? })` | `/uk-charity-full` | $0.25 |
| `convertDocument({ url, format? })` | `/convert` | $0.03 |
| `createMonitor({ url, webhook, … })` | `POST /monitor` | $1.00 / 30d |
| `walletBalances({ address, chain? })` | `/wallet` | $0.003 |
| `txStatus({ hash, chain? })` | `/tx` | $0.003 |
| `tokenCheck({ address, chain? })` | `/token-check` | $0.01 |
| `fxRates({ base?, symbols?, … })` | `/fx` | $0.002 |
| `ensLookup({ name?, address? })` | `/ens` | $0.002 |
| `tokenMetadata({ address, chain? })` | `/token` | $0.001 |
| `tokenAllowance({ token, owner, spender })` | `/allowance` | $0.002 |
| `contractInfo({ address, chain? })` | `/contract` | $0.003 |
| `gasFees({ chain? })` | `/gas` | $0.001 |
| `blockLookup({ number?, timestamp? })` | `/block` | $0.001 |
| `nftLookup({ contract, token_id, chain? })` | `/nft` | $0.002 |
| `webSearch({ q })` | `/search` | $0.003 |
| `ukPropertyPrices({ postcode })` | `/uk-property` | $0.01 |
| `ukAreaProfile({ postcode })` | `/uk-area` | $0.005 |
| `pricing()` | `/.well-known/x402` | free |

Pass `{ preview: true }` / `{ preview: false }` on any call to override the default.

```ts
const client = createClient({ privateKey: "0x…" });
// Force a free truncated sample even with a key:
await client.companyResearch({ domain: "stripe.com" }, { preview: true });
```

## MCP for Claude Desktop / Cursor

Prefer the companion package:

```bash
npx -y @axiomworks/agentreader-mcp
```

```json
{
  "mcpServers": {
    "agentreader": {
      "command": "npx",
      "args": ["-y", "@axiomworks/agentreader-mcp"],
      "env": { "AGENTREADER_PRIVATE_KEY": "0x…" }
    }
  }
}
```

MIT © Axiom Works · info@axiomworks.co.uk
