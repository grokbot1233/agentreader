# Evening growth sprint research — 2026-11-05 ~20:35 UTC

## Method
- CDP Bazaar semantic search (`/v2/x402/discovery/search`) for sanctions, ASIC/AU, NZ Companies Office, OpenCorporates, KYB packs, charity, tx/path-hash.
- CDP merchant catalog for our payTo `0x88b1…3ff6` (settlement-indexed resources only).
- x402scan `checkDiscovery` on `https://api.axiomworks.co.uk` (OpenAPI-first; 57 unique paths / 106 method rows).
- Manual x402scan register for `/sanctions` + `/sanctions-batch` (both HTTP 200).
- Cross-check onesource.io path shapes vs our query-param routes; ASIC data.gov.au + DSP policy; prior notes in `market-2026-11-05.md` / `bigger-plays-2026-11-05.md`.
- Live OpenAPI version **1.11.0**; `/uk-officer` **not** on openapi (sibling not shipped).

## Top observations
1. **Path-param aliases still look valuable.** onesource keeps 200–500 unique payers on `/api/chain/tx/:hash` (283), `/block/:number` (305), `/ens/:input` (356), `/contract/:address` (398). Explorer/crawler agents hit REST-shaped paths harder than `?hash=` query forms. Our `/tx`, `/ens`, `/contract`, `/chain/*` are query-only — same facts, weaker discovery surface.
2. **Sanctions niche is crowded but shallow.** ≥8 OFAC/multi-list screens on Bazaar; typical payers 1–6. Our `/sanctions` ($0.05) + batch ($1) + KYB wire-up is already indexed (merchant shows 1 payer / 2 calls — our verify). Differentiation = multi-list + batch + KYB compose, not another single OFAC wrapper.
3. **Free-registry jurisdictions**
   - **ASIC AU:** weekly company CSV on data.gov.au is **CC BY 3.0 AU** (commercial OK with attribution). Live company-register DSP API **not accepting new apps until 2027**. Viable as snapshot lookup (£0 COGS), not live filings. Almost no AU company x402 competitors in search hits.
   - **NZ Companies Office:** competitor `companyrecords-api…/nz-companies-register` already listed (~3 payers). Thin margin unless we bundle AU+NZ+UK.
   - **OpenCorporates:** not a free redistributable register for us; treat as **skip / ToS-risk** (paid API, not CC bulk).
   - **OpenSanctions / OFAC/UK/UN/EU:** already covered by tonight’s `/sanctions*`.
4. **Bazaar settlement lag is the real index gap.** Merchant catalog shows only **20** of our resources (settled). x402scan OpenAPI already sees all **57** paths incl. sanctions. More paid outside calls > more micro-endpoints for Bazaar visibility.
5. **Demand still bottleneck.** Dashboard: outside revenue **$0.003** / 2 paid / 87 test / treasury ~1.59 USDC. Grow/cut N/A (all <14d; sprint 7d clock for sanctions → 2026-11-12).
6. **RapidAPI:** still **deferred** (after Apify Store traction). Apify 2 Actors still queued to publish ~6 Nov 17:20 UK.

## Ranked next ship ideas (concrete, £0 COGS bias)
1. **Path-param aliases (P0, S effort)** — Add GET aliases `/tx/:hash`, `/ens/:nameOrAddress`, `/contract/:address`, `/chain/block/:number`, `/chain/erc20-balance/:address` (and mirror onesource-shaped `/api/chain/...` only if we want crawl collisions; prefer short canonical aliases). Same handlers/prices. Goal: pick up explorer-shaped discovery without new upstream cost. Expected: more one-shot Bazaar/x402scan probes → more chance of outside settles.
2. **ASIC AU company snapshot `/au-company` $0.05–0.10 (P1, M effort)** — Weekly CC-BY CSV (or parquet mirror) keyed by ACN/ABN/name; attribute ASIC + date. No live DSP. Higher-value than micro RPC; fills empty AU gap. Optional later: `/au-leads` new-registrations delta from weekly diffs ($0.25+).
3. **Multi-charity thin pack or UK officers (P2)** — Either (a) `/uk-officer` / PSC extract from CH (if sibling lands; openapi still missing) at $0.10–0.25, or (b) Scotland OSCR / ACNC AU charity verify mirrors (competitors already prove distinct Bazaar rows at $0.0x with 2–3 payers each). Prefer CH officers first — higher ticket, reuses CH key.

## What NOT to do
- Open more awesome-list PRs (many already open; dashboard rule).
- RapidAPI signup/listing this week.
- OpenCorporates scraping/resale; ASIC live DSP applications (closed → 2027).
- Another standalone OFAC-only micro at <$0.05 (commodity, payers≈1–3).
- Paid featured directory spend without owner (£20–100 proposal stands).
- Force npm republish tonight — live MCP already exposes `sanctions_screen` / `sanctions_batch`; npm `@axiomworks/agentreader@1.11.0` + `@axiomworks/agentreader-mcp@1.11.1`; Official MCP Registry still needs owner JWT re-auth (`mcp-publisher login github`).
- Cut any product tonight (none qualify under 14d/<50 calls/<10 payers or 7d no-sales).

## Ops done this sprint half
- x402scan register `/sanctions` → 200 (id `7c6e93e8-…`); `/sanctions-batch` → 200 (id `680bd3f1-…`).
- OpenAPI discovery already lists both; no `/uk-officer` live.
- Research note: this file. Dashboard meta + `server.json` description refresh in same sprint commits.
