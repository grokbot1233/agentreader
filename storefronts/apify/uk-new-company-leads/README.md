# UK New Company Leads — Fresh Incorporations by SIC & Location

Daily UK new-incorporation leads from the official Companies House register. Filter by SIC code, location or postcode area and optionally enrich with active director names. Built for sales teams, lenders and AI agents hunting brand-new UK companies.

**Publisher:** [Axiom Works](https://axiomworks.co.uk) · `ultramarine_gusto/uk-new-company-leads`

## Features
- Structured JSON output ready for AI agents / CRM / KYB flows
- Pay-per-event monetization (`company-lead` ≈ $0.040 / event after setup)
- No crypto wallet required — runs fully inside Apify

## Input
See the input schema in the Apify Console. Example:

```json
{
  "sic": "example",
  "location": "example",
  "postcodeArea": "example",
  "days": "example"
}
```

## Output example
```json
{
  "company_number": "16789012",
  "company_name": "EXAMPLE LTD",
  "date_of_creation": "2026-11-04",
  "sic_codes": [
    "62012"
  ],
  "directors": [
    "JANE DOE"
  ]
}
```

## Pricing
Pay per `company-lead` event. Suggested list price **$0.040** (you keep ~80% after Apify's commission; platform compute is cheap for these light Actors).

## Attribution
Where Companies House / Charity Commission data is used: contains public sector information licensed under the Open Government Licence v3.0.

## Support
info@axiomworks.co.uk · https://api.axiomworks.co.uk
