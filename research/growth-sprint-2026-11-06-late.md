# Growth sprint 2026-11-06 ~20:33–20:45 UK (Europe/London)

## Numbers
- Outside revenue: **$0.004** / 3 paid / 1 outside payer (unchanged). Endpoints: /read, unknown, /chain/erc1155-balance.
- Treasury ~$2.588 USDC + ~0.000399 ETH (under $20 sweep; not touched).
- Live version after deploy: **1.30.0** (deploy id `6be5806d-cc1e-4a8e-9a94-a1f41623ef76`).

## Grow/cut (7-day)
- **N/A keep all** — big hitters launched <7 days; no outside sales on them yet. Cut rule is 7 days from launch.

## Shipped
### A. `/no-company` $0.25 (feat 1.30.0)
- Free Brønnøysundregistrene Enhetsregisteret (NLOD): lookup by `orgnr` (9 digits) or `name`/`q`.
- Wired: Worker PRICES/AMOUNT/DESC/OpenAPI/MCP/`llms.txt` Big hitters, `/kyb` `orgnr=`, `/registry-batch` `no=`.
- Preview Equinor `923609016` → 200 EQUINOR ASA / active / STAVANGER.
- Bare probe → 402 `maxAmountRequired` **250000**; `?orgnr=` → free 400.
- `/kyb` 402 copy mentions Norway Brreg / orgnr; x402scan resource id `36bd8c63-1b4c-4985-8b7b-336410a05b61`.
- npm `@axiomworks/agentreader` + `@axiomworks/agentreader-mcp` **1.30.0** (see publish log).
- No paid settle (preview+402 sufficient; skipped $25/$5).

### B. Apify free Store
- **au-company-check** → isPublic true → https://apify.com/ultramarine_gusto/au-company-check (HTTP 200)
- **ca-corp-check** → isPublic true → https://apify.com/ultramarine_gusto/ca-corp-check (HTTP 200)
- No boosts / no spend.

### C. Dashboard
- Attempt `scripts/update-dashboard-meta.sh`; if CF KV put blocked, patch saved under `research/leads/dashboard-patch-2026-11-06-growth-2033.json`.

## No spend
- No Coinbase Default portfolio touch. No paid ads. Optional ≤$0.25 settle skipped.

## Next (big hitters only)
- More EU/Nordic free registries on `/kyb` + `/registry-batch` (DK CVR live registry if free API confirms; SE Bolagsverket if free; DE Handelsregister remains hard).
- Buyer hunt already ran ~20:21 — continue conversion on /kyb /uk-dd /uk-leads.
- Do **not** ship more $0.001–$0.003 micro validators.
