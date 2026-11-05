# Web Page to Clean Markdown — Agent-Ready Extractor

Fetch any public URL and return clean Markdown + metadata (title, description, links). Built for LLM/RAG pipelines and AI agents that need readable page content without raw HTML noise.

**Publisher:** [Axiom Works](https://axiomworks.co.uk) · `ultramarine_gusto/web-to-markdown`

## Features
- Structured JSON output ready for AI agents / CRM / KYB flows
- Pay-per-event monetization (`page-markdown` ≈ $0.005 / event after setup)
- No crypto wallet required — runs fully inside Apify

## Input
See the input schema in the Apify Console. Example:

```json
{
  "url": "https://example.com",
  "maxChars": "example"
}
```

## Output example
```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "markdown": "# Example Domain\n\nThis domain is for use in..."
}
```

## Pricing
Pay per `page-markdown` event. Suggested list price **$0.005** (you keep ~80% after Apify's commission; platform compute is cheap for these light Actors).

## Attribution
Where Companies House / Charity Commission data is used: contains public sector information licensed under the Open Government Licence v3.0.

## Support
info@axiomworks.co.uk · https://api.axiomworks.co.uk
