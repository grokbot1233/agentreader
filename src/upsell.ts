// Concise cross-sell hints appended to 402 descriptions and MCP tool descriptions.
export const UPSELL: Record<string, string> = {
  "/uk-company-lite": "Need officers/PSCs/filings? /uk-company $0.50; full KYB (UK+VAT+domain+risk) /kyb $2.",
  "/uk-company": "Onboarding/due diligence? /kyb $2 bundles this + EU VAT + domain + risk flags; /uk-watch $5 alerts on changes.",
  "/company": "UK entity? /company-full $0.65 adds Companies House; /kyb $2 for a full KYB report.",
  "/company-full": "For onboarding decisions: /kyb $2 adds VAT validation + risk score.",
  "/eu-vat": "Verify the whole business: /kyb $2 (VAT + registry + domain + risk).",
  "/check": "Full company profile from a domain: /company $0.25; KYB: /kyb $2.",
  "/read": "Whole documents (PDF/DOCX): /convert $0.03; page change alerts: /monitor $1.",
  "/links": "Page content as Markdown: /read $0.002.",
  "/convert": "Watch a doc/page for changes: /monitor $1.",
  "/us-sec": "Full financials + filings list: /us-sec-full $0.25.",
  "/uk-charity": "Trustees, finances, history: /uk-charity-full $0.25.",
  "/uk-leads-lite": "Full lead details: /uk-leads $1; daily webhook feed: /uk-leads-feed $25.",
  "/uk-leads": "Get these daily by webhook: /uk-leads-feed $25.",
  "/wallet": "Vet a token before transfer: /token-check $0.01.",
  "/tx": "Counterparty wallet profile: /wallet $0.003.",
  "/token": "Risk check (honeypot/owner/liquidity): /token-check $0.01.",
  "/uk-area": "Property prices for the postcode: /uk-property $0.01.",
};
export const upsell = (p: string, d: string) => (UPSELL[p] ? `${d} Related: ${UPSELL[p]}` : d);
