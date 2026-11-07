# Sanctions Screening Batch — OFAC, UK, UN & EU Lists

Fuzzy-screen **a list of person or company names** against the official public sanctions lists, **downloaded fresh at the start of every run**:

- 🇺🇸 **OFAC SDN** + **OFAC non-SDN consolidated** (US Treasury)
- 🇬🇧 **UK Sanctions List** (FCDO / OFSI)
- 🇺🇳 **UN Security Council consolidated list**
- 🇪🇺 **EU consolidated financial sanctions list** (FSF)

Each name gets **scored candidate matches** (0.75–1.0) with the list, programme, all aliases, DOB and nationality, so a human or an agent can decide quickly. No API keys, no third-party aggregator — only official public files.

## Input

```json
{
  "names": [
    "BANCO NACIONAL DE CUBA",
    "Alice Wonderland",
    { "name": "Vladimir Putin", "type": "individual", "year": "1952" }
  ],
  "minScore": "0.75",
  "maxMatchesPerName": 10
}
```

Optional per-name hints: `type` (`individual` / `entity`), `country` (nationality boost), `dob` or `year` (birth-year boost/penalty).

## Output (one dataset item per name)

```json
{
  "name": "BANCO NACIONAL DE CUBA",
  "possible_match": true,
  "highest_score": 1,
  "top_match": "BANCO NACIONAL DE CUBA [OFAC-SDN / CUBA]",
  "matches": [{ "score": 1, "list": "OFAC-SDN", "name": "BANCO NACIONAL DE CUBA", "aliases": ["NATIONAL BANK OF CUBA"], "type": "entity", "program": "CUBA" }],
  "lists_screened": ["OFAC-SDN", "OFAC-CONS", "UN-SC", "UK-FCDO", "EU-FSF"],
  "disclaimer": "Screening aid only; not a regulated AML/KYC determination. Matches are scored candidates…"
}
```

The run's key-value store `OUTPUT` record lists every source with its entry count and publication date. If an official source is temporarily unavailable, the run still completes and says so in `lists_unavailable` instead of pretending it screened that list.

## How matching works
Names are Unicode-normalised (diacritics folded, non-Latin scripts kept), token-sorted, and compared against every primary name and alias with Jaccard token similarity plus exact-match detection. Candidates below 0.75 are discarded. This is the same engine as AgentReader's `/sanctions` API.

## Same engine as an x402 pay-per-call API (for AI agents)

- `POST https://api.axiomworks.co.uk/sanctions-batch` — **$1** USDC to screen up to 50 names
- `GET /sanctions` — **$0.05** single name
- `GET /kyb` — **$2.50** KYB pack (registry + VAT + LEI + sanctions on entity and directors)
- `POST /registry-batch` — **$0.30**; per-country `/xx-company` — **$0.25**
- MCP server: `https://api.axiomworks.co.uk/mcp` · OpenAPI: `https://api.axiomworks.co.uk/openapi.json`

Companion actor for company data: **EU Company Registry Check** (`ultramarine_gusto/eu-company-registry-check`).

## Disclaimer
**Screening aid only; not a regulated AML/KYC determination. Matches are scored candidates**, not confirmed hits, and a clear result is not a guarantee of non-match. Confirm any hit with the issuing authority before acting. Lists: OFAC (US public domain), UK FCDO (Open Government Licence v3.0), UN SC (public), EU FSF (EU public data).
