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
