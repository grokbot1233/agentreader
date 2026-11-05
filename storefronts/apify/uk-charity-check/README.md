# UK Charity Commission Check — Status, Income & Trustees

Look up a UK charity on the Charity Commission Register of Charities: status, income, activities, trustee count and regulatory flags. Uses the official Register API.

**Publisher:** [Axiom Works](https://axiomworks.co.uk) · `ultramarine_gusto/uk-charity-check`

## Features
- Structured JSON output ready for AI agents / CRM / KYB flows
- Pay-per-event monetization (`charity-check` ≈ $0.030 / event after setup)
- No crypto wallet required — runs fully inside Apify

## Input
See the input schema in the Apify Console. Example:

```json
{
  "charityNumber": "example",
  "name": "OXFAM"
}
```

## Output example
```json
{
  "charity_number": "202918",
  "name": "OXFAM",
  "status": "Registered"
}
```

## Pricing
Pay per `charity-check` event. Suggested list price **$0.030** (you keep ~80% after Apify's commission; platform compute is cheap for these light Actors).

## Attribution
Where Companies House / Charity Commission data is used: contains public sector information licensed under the Open Government Licence v3.0.

## Support
info@axiomworks.co.uk · https://api.axiomworks.co.uk
