# US SEC EDGAR Company Snapshot (Ticker or CIK)

Fast US SEC EDGAR company snapshot by ticker or CIK: identity, SIC, addresses, recent filings. Built for KYB, research agents and diligence workflows. Uses the free SEC data API with a polite User-Agent.

**Publisher:** [Axiom Works](https://axiomworks.co.uk) · `ultramarine_gusto/us-sec-edgar-snapshot`

## Features
- Structured JSON output ready for AI agents / CRM / KYB flows
- Pay-per-event monetization (`sec-snapshot` ≈ $0.030 / event after setup)
- No crypto wallet required — runs fully inside Apify

## Input
See the input schema in the Apify Console. Example:

```json
{
  "ticker": "AAPL",
  "cik": "0000320193",
  "maxFilings": "example"
}
```

## Output example
```json
{
  "ticker": "AAPL",
  "cik": "0000320193",
  "name": "Apple Inc.",
  "recent_filings": [
    {
      "form": "10-K"
    }
  ]
}
```

## Pricing
Pay per `sec-snapshot` event. Suggested list price **$0.030** (you keep ~80% after Apify's commission; platform compute is cheap for these light Actors).

## Attribution
Where Companies House / Charity Commission data is used: contains public sector information licensed under the Open Government Licence v3.0.

## Support
info@axiomworks.co.uk · https://api.axiomworks.co.uk
