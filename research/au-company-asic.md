# /au-company — ASIC company dataset (research, not shipped)
- Source: data.gov.au package `asic-companies`, licence CC-BY (attribution: "ASIC Company Dataset, data.gov.au, CC BY 3.0 AU").
- Current snapshot: company_202611.csv (~400 MB) / .zip (~79 MB); refreshed weekly-ish, month-named file. Help PDF documents columns (name, ACN, type, class, status, reg date, state, ABN, deregistration date, previous names).
- No free query API: must ingest. Worker can't parse 400 MB in-request.
- Plan (free): offline job on box: download zip -> slim to ACN,ABN,name,status,type,reg_date,dereg_date -> load into Cloudflare D1 (free 5 GB/acct, 500 MB/db; ~3.5M rows ≈ 300-400 MB, may need trimming previous-names). Lookup by ACN/ABN exact + name prefix (FTS5). Weekly cron re-ingest from box/GH Action.
- Alternative: ABN Lookup web services (free GUID registration, ABR) gives live ABN/ACN data — needs Liam to register (free, needs email).
- Price idea: /au-company $0.02 (lookup), complements /uk-company & /eu-vat.
- Risk: D1 size cap; verify row count before committing.

## Feasibility numbers (COMPANY_202611, measured 2026-11-05)
- Zip 79,298,881 B; CSV 400,768,703 B, TAB-delimited, UTF-8 BOM. 15 cols: Company Name, ACN, Type, Class, Sub Class, Status, Date of Registration, Date of Deregistration, Previous State of Registration, State Registration number, Modified since last report, Current Name Indicator, ABN, Current Name, Current Name Start Date.
- Rows 4,456,870; distinct ACN 4,023,005 (extra rows = former-name rows).
- Status: REGD 4,134,671; DRGD 233,629; SOFF 47,264; EXAD 40,756; NOAC 490; CNCL 59.
- Trimmed 7 cols (name, ACN, type, status, reg date, dereg date, ABN) raw text = 301.1 MB (REGD only: 277.0 MB).
- Estimate in SQLite/D1: + row overhead (~15%) + ACN PK index (~100 MB) + name index/FTS (~150-250 MB) => ~550-700 MB. Does NOT clearly fit one free 500 MB D1 DB.
- Ways to fit for free: (a) integers for ACN/ABN/dates + 1-byte codes for type/status (cuts ~80 MB); (b) drop former-name rows (-433k rows); (c) shard by ACN range across 2 D1 DBs (free tier allows multiple DBs, 5 GB acct total); (d) name search via prefix index only, no FTS. (a)+(b)+(c) should fit comfortably.
- Free-tier write limit: D1 free = 100k rows written/day -> initial 4M-row load would take ~40 days on free plan. BLOCKER for free ingest; weekly refresh also exceeds it. Alternative free path: R2 (10 GB free) static sharded JSON by ACN prefix (e.g. 3-digit prefix -> ~4k files) + name-prefix shards, served by the Worker; R2 free = 1M class-A writes/month, fine.

## Storage check (2026-11-05 21:12 GMT)
- R2: NOT enabled on the Worker's Cloudflare account. `wrangler r2 bucket list` -> "Please enable R2 through the Cloudflare Dashboard [code 10042]". Enabling R2 requires Liam to opt in on the dashboard (normally asks for a payment method even for the free 10 GB tier) -> needs Liam's explicit OK. Not done.
- D1 free limit verified (developers.cloudflare.com/d1/platform/pricing, updated 2026-10-30): Workers Free = 100,000 rows written/day, 5M rows read/day, 5 GB total storage, 10 DBs. A 4.13M-row REGD load = ~42 days (more with index writes, which count as extra rows). Not viable on free.
- Free option needing no billing: Workers Static Assets (deployed with the Worker; free plan up to 20,000 files/version, 25 MiB/file). Plan: ~4,000 JSON shards by 3-digit ACN prefix (~75 KB each, ~300 MB total) under an assets dir, with `run_worker_first = true` so the Worker enforces x402 before reading a shard via env.ASSETS.fetch (otherwise data would be free on the public path). Verify the current asset-count/size limits before building. Name search would need extra name-prefix shards.

## Static-assets preview (2026-11-05 21:15 GMT) — LIVE PREVIEW, not production
- Limits verified (developers.cloudflare.com/workers/platform/limits, updated 2026-10-29): Workers Free = 20,000 asset files/version, 25 MiB/file, 10 ms CPU/request, 100k req/day. No R2/D1/billing needed.
- Full shard build (scripts/au-shards.py, 4-digit ACN prefix, REGD+DRGD+SOFF+EXAD, current name + former names): 2,341 files, 4,022,670 companies, 510 MB total, largest shard 636 KB (6996.json). Well within 20k files / 25 MiB. JSON.parse of <=640 KB should stay inside 10 ms CPU but measure on the biggest shard before prod.
- Preview Worker: preview/au-company (name agentreader-au-preview), https://agentreader-au-preview.yasirawouda1.workers.dev
  - 7 sample shards (0000,0001,0002,0004,0009,0040,0096; 8,683 companies, 1.4 MB).
  - GET /au-company?acn=004028077 -> 402 + PAYMENT-REQUIRED ($0.02); &preview=1 -> 200 name+status; ?abn= 11 digits accepted; /_au/0040.json -> 404 (run_worker_first=true keeps shards private).
- Full rollout: (1) `python3 scripts/au-shards.py COMPANY_YYYYMM.csv <assets>/_au` (all shards); (2) either deploy the preview Worker with all shards and bind it to production via a Service Binding, or add [assets] (run_worker_first=true, binding ASSETS) to the main wrangler.toml and port the route (check main Worker's existing routes don't collide with an assets dir); (3) add /au-company to PRICES/IN/OUT/DESC, openapi, llms, MCP; (4) monthly refresh = rerun + redeploy (only changed files upload). Wrangler 4.157 in use.

## Full preview + CPU (2026-11-05 21:20 GMT)
- Full set deployed to preview Worker: 2,341 shards uploaded in ~71 s (version d34d2e63, later c8ab9671).
- CPU (wrangler tail, largest shard 6996.json, ACN 699600014): with JSON.parse of whole shard 9-12 ms (over 10 ms free limit). Switched to indexOf+slice parse of only the one record: 5 ms steady (one 15 ms cold start). OK.
- /internal/au (shared-secret header AU_INTERNAL_KEY, secret set on both Workers) for production Service Binding; 403 without key.
- Production wiring prepared on branch `au-company-prod` (not deployed): /au-company $0.02 + /au-company/{acn|abn} alias, openapi/llms/discovery auto-generated, validate + TOOL_PATH; MCP tool not yet added. Dry-run build OK (7.2 MiB).
