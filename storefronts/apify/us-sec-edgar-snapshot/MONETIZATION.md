# Monetization setup (Console)

Pricing model: PAY_PER_EVENT
Primary event: `sec-snapshot`
Event title: SEC company snapshot
Event description: One SEC EDGAR company snapshot (identity + recent filings).
Suggested price USD: 0.03
Also keep synthetic `apify-actor-start` (covers first 5s compute).
Optional: delete `apify-default-dataset-item` if using only custom event via pushData(eventName).

SEO title: US SEC EDGAR Snapshot — Filings by Ticker or CIK
SEO description: Pull a structured SEC EDGAR company snapshot: CIK, SIC, addresses and recent filings by ticker. Pay per company. Ideal for KYB and AI agents.
Categories: AI, BUSINESS, FINANCE
