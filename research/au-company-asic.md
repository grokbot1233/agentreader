# /au-company — ASIC company dataset (research, not shipped)
- Source: data.gov.au package `asic-companies`, licence CC-BY (attribution: "ASIC Company Dataset, data.gov.au, CC BY 3.0 AU").
- Current snapshot: company_202611.csv (~400 MB) / .zip (~79 MB); refreshed weekly-ish, month-named file. Help PDF documents columns (name, ACN, type, class, status, reg date, state, ABN, deregistration date, previous names).
- No free query API: must ingest. Worker can't parse 400 MB in-request.
- Plan (free): offline job on box: download zip -> slim to ACN,ABN,name,status,type,reg_date,dereg_date -> load into Cloudflare D1 (free 5 GB/acct, 500 MB/db; ~3.5M rows ≈ 300-400 MB, may need trimming previous-names). Lookup by ACN/ABN exact + name prefix (FTS5). Weekly cron re-ingest from box/GH Action.
- Alternative: ABN Lookup web services (free GUID registration, ABR) gives live ABN/ACN data — needs Liam to register (free, needs email).
- Price idea: /au-company $0.02 (lookup), complements /uk-company & /eu-vat.
- Risk: D1 size cap; verify row count before committing.
