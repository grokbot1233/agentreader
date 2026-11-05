# EU VAT VIES Validation — Valid, Name & Address

Validate any EU VAT number via the official European Commission VIES REST API. Returns validity, registered name and address when available. Perfect for checkout fraud checks, KYB and invoice verification.

**Publisher:** [Axiom Works](https://axiomworks.co.uk) · `ultramarine_gusto/eu-vat-vies-check`

## Features
- Structured JSON output ready for AI agents / CRM / KYB flows
- Pay-per-event monetization (`vat-check` ≈ $0.010 / event after setup)
- No crypto wallet required — runs fully inside Apify

## Input
See the input schema in the Apify Console. Example:

```json
{
  "vat": "IE6388047V",
  "country": "example",
  "number": "example"
}
```

## Output example
```json
{
  "vat": "IE6388047V",
  "valid": true,
  "name": "GOOGLE IRELAND LIMITED"
}
```

## Pricing
Pay per `vat-check` event. Suggested list price **$0.010** (you keep ~80% after Apify's commission; platform compute is cheap for these light Actors).

## Attribution
Where Companies House / Charity Commission data is used: contains public sector information licensed under the Open Government Licence v3.0.

## Support
info@axiomworks.co.uk · https://api.axiomworks.co.uk
