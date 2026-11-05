# Agent KYB Check — Website + UK Companies House + EU VAT

One-shot KYB / due-diligence screening for AI agents and onboarding: website signals, UK Companies House profile + officers, and EU VIES VAT validation → composite trust flag (OK / REVIEW / FAIL). Screening over public registries only — not a regulated determination.

**Publisher:** [Axiom Works](https://axiomworks.co.uk) · `ultramarine_gusto/agent-kyb-check`

## Features
- Structured JSON output ready for AI agents / CRM / KYB flows
- Pay-per-event monetization (`kyb-check` ≈ $0.120 / event after setup)
- No crypto wallet required — runs fully inside Apify

## Input
See the input schema in the Apify Console. Example:

```json
{
  "domain": "example",
  "companyNumber": "example",
  "companyName": "example",
  "vat": "example"
}
```

## Output example
```json
{
  "trust": {
    "flag": "REVIEW",
    "score": 55
  },
  "inputs": {
    "domain": "tesco.com",
    "company_number": "00445790"
  }
}
```

## Pricing
Pay per `kyb-check` event. Suggested list price **$0.120** (you keep ~80% after Apify's commission; platform compute is cheap for these light Actors).

## Attribution
Where Companies House / Charity Commission data is used: contains public sector information licensed under the Open Government Licence v3.0.

## Support
info@axiomworks.co.uk · https://api.axiomworks.co.uk
