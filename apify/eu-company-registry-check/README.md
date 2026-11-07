# EU Company Registry Check — Batch KYB Lookup (9 Countries)

Look up companies in **9 official open business registries in one run** and get back **one normalised, KYB-ready JSON record per company**: legal name, status, registered address, legal form, incorporation date, directors/officers (where the registry publishes them), red flags and the exact source URL.

| Country | Registry (official, open data) | ID to send | Officers |
|---|---|---|---|
| 🇳🇴 NO | Brønnøysundregistrene Enhetsregisteret | orgnr (9 digits) | – |
| 🇩🇰 DK | CVR (Erhvervsstyrelsen) via apicvr.dk | CVR (8 digits) | ✅ direktion + owners |
| 🇫🇮 FI | PRH / YTJ Finnish Trade Register | Y-tunnus `0112038-9` | – |
| 🇨🇭 CH | Zefix / UID register | UID `CHE-105.909.036` | – (audit firm in details) |
| 🇵🇱 PL | KRS (Ministry of Justice) | KRS (10 digits) or NIP | ✅ board (names partly redacted by source) |
| 🇨🇿 CZ | ARES (Ministry of Finance) | IČO (8 digits) | – |
| 🇧🇪 BE | CBE/KBO Public Search | enterprise no. `0403.170.701` | ✅ directors |
| 🇸🇰 SK | RPO (Statistical Office) | IČO (8 digits) | ✅ statutory body |
| 🇫🇷 FR | API Recherche d'entreprises (INSEE/RNE) | SIREN (9) or SIRET (14) | ✅ dirigeants |

No API keys, no logins, no scraping of paywalled sites — only official public endpoints.

## Input

```json
{
  "companies": [
    { "country": "DK", "id": "24256790" },
    { "country": "NO", "id": "923609016" },
    { "country": "CZ", "id": "27082440" },
    "FR:552032534"
  ]
}
```

Options: `includeRaw` (default `true`, adds the full registry record under `details`: capital, NACE codes, owners, name history…), `maxCompanies` (default 500).

## Output (one dataset item per company)

```json
{
  "found": true,
  "country": "DK",
  "company_id": "24256790",
  "name": "NOVO NORDISK A/S",
  "status": "NORMAL",
  "legal_form": "Aktieselskab",
  "registered_address": "Novo Alle 1, 2880 Bagsværd, Denmark",
  "incorporation_date": "1931-11-28",
  "officers": [{ "name": "Karsten Munk Knudsen", "role": "DIREKTØR", "since": "2018-02-15" }],
  "red_flags": [],
  "source_url": "https://apicvr.dk/api/v1/24256790",
  "disclaimer": "Screening aid only; not a regulated AML/KYC/KYB determination…"
}
```

Not-found / invalid IDs return `found: false` with the registry's error message, so a batch never silently drops a row. Dates are normalised to ISO `YYYY-MM-DD`.

## Use cases
- Supplier / customer onboarding (KYB) across the Nordics, DACH, CEE, Benelux and France
- Enriching CRM or invoice data with official legal name, status and address
- AI agents that need a verified company record before contracting or paying

## Same data as an x402 pay-per-call API (for AI agents)

This actor is the batch/Apify version of **AgentReader** (`https://api.axiomworks.co.uk`), which agents can call with USDC on Base via x402 — no account needed:

- `GET /no-company`, `/dk-company`, `/fi-company`, `/ch-company`, `/pl-company`, `/cz-company`, `/be-company`, `/sk-company`, `/fr-company` — **$0.25** per company
- `POST /registry-batch` — **$0.30** per batch across registries
- `GET /kyb` — **$2.50** one-shot KYB pack (registry + VAT + LEI + sanctions screen)
- `GET /sanctions-batch` — **$1** to screen up to 50 names against OFAC, UK, UN and EU lists
- MCP server: `https://api.axiomworks.co.uk/mcp` · OpenAPI: `https://api.axiomworks.co.uk/openapi.json`

Need sanctions screening of the names you get back? See the companion actor **Sanctions Screening Batch** (`ultramarine_gusto/sanctions-screening-batch`).

## Disclaimer
Screening aid only; not a regulated AML/KYC/KYB determination, credit score or legal advice. Data is fetched live from the official registries listed above (each under its own open-data licence; attribution is included in every record). Confirm identifiers at source before onboarding, contracting or paying.
