# Growth sprint — 2026-11-06 evening (~17:35 Europe/London)

## 1. Numbers
- Outside revenue: **$0.004 USDC** / 3 paid calls / 1 unique outside payer (unchanged)
- Outside by endpoint: `/read` $0.002, `unknown` $0.001, `/chain/erc1155-balance` $0.001
- Treasury: ~$2.585 USDC + ~0.000399 ETH (under $20 sweep threshold)
- Live version after ship: **1.27.3**

## 2. Grow/cut (7-day no outside sales)
- **N/A / keep all** — every micro shipped in last 48h is under 7 days since launch. Dashboard 14d/50-calls rule also not triggered.
- Outside sales only on `/read` (+ unknown + erc1155-balance). No product meets cut criteria yet.
- Note: free-tier CF KV daily put limit still biting (dashboard meta writes + had preview 500s until fail-open).

## 3. Shipped — v1.27.3
| Endpoint | Price | Notes |
|---|---|---|
| `GET/POST /cvr` | $0.001 | DK CVR 8-digit mod-11; optional DK prefix; aliases number=/vat= |
| `GET/POST /fn-at` | $0.001 | AT Firmenbuchnummer check letter (mod-17 weights 6/4/14/15/10/1) |
| `GET/POST /cin-in` | $0.001 | IN CIN 21-char structural parse (no check digit) |

Also: `checkPreviewQuota` fail-open on KV put/get errors (unblocks free previews when CF KV daily put limit hit).

- Deploy ids: 2cac1e9e… (1.27.0), b831ef17… (1.27.1 KV), **f7899488-cdfd-4972-a423-70ff58c8224f** (1.27.3 final)
- Paid settles (test wallet): cvr `0x6a3dec55…8045`, fn-at `0x7abc7d29…e26f`, cin-in `0x6a87e0bb…805d`
- Preview 200 + empty-param free 400 + bare 402 amountAtomic 1000 verified
- npm: `@axiomworks/agentreader` + `agentreader-mcp` **1.27.3**
- x402scan: /cvr /fn-at /cin-in registered this sprint

## 4. Discovery / next
- Apify: agent-kyb-check + uk-charity-check already public; au-company-check / ca-corp-check candidates for next free Store publish (watch daily limit)
- Next free validators after Toll peers exhausted: NL KvK shape / DE Handelsregister shape / ES NIF offline — or higher-ticket packs if Bazaar demand shifts
- Soft distribute new micros; no ads

## 5. No Liam spend
