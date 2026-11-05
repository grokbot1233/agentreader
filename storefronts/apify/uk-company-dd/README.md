# UK Companies House Due Diligence Report

Official Companies House due diligence for any UK company number or name: status, SIC, registered office, filing dates, active officers/directors, and automated red-flag heuristics. Uses the official REST API (not HTML scraping). Ideal for KYB, onboarding, sales enrichment and AI agents.

**Publisher:** [Axiom Works](https://axiomworks.co.uk) · `ultramarine_gusto/uk-company-dd`

## Features
- Structured JSON output ready for AI agents / CRM / KYB flows
- Pay-per-event monetization (`company-report` ≈ $0.025 / event after setup)
- No crypto wallet required — runs fully inside Apify

## Input
See the input schema in the Apify Console. Example:

```json
{
  "companyNumber": "example",
  "companyName": "example",
  "includeOfficers": "example",
  "maxOfficers": "example"
}
```

## Output example
```json
{
  "company_number": "00445790",
  "company_name": "TESCO PLC",
  "company_status": "active",
  "red_flags": [],
  "officers_count": 5
}
```

## Pricing
Pay per `company-report` event. Suggested list price **$0.025** (you keep ~80% after Apify's commission; platform compute is cheap for these light Actors).

## Attribution
Where Companies House / Charity Commission data is used: contains public sector information licensed under the Open Government Licence v3.0.

## Support
info@axiomworks.co.uk · https://api.axiomworks.co.uk
