# Monetization setup (Apify Console — manual step, nothing charged by us)

Pricing model: PAY_PER_EVENT
Primary event: `company-record`
Event title: Company record
Event description: One normalised company record from an official EU/EEA registry (found companies only; not-found rows are free).
Suggested price USD: 0.03
Also keep synthetic `apify-actor-start` (covers first 5s compute).
Delete/zero `apify-default-dataset-item` so only `company-record` (pushed via pushData(item, "company-record")) is billed.

Rationale: AgentReader x402 equivalent is $0.25 per company (/xx-company) and $0.30 per /registry-batch; Apify buyers are price-sensitive and batch-heavy, so $0.03/record undercuts the API while still covering compute (~0.5–1.5 s per lookup at 256 MB).

SEO title: EU Company Registry Check — Batch KYB Lookup (9 Countries)
SEO description: Batch lookup in 9 official registries (NO, DK, FI, CH, PL, CZ, BE, SK, FR): name, status, address, legal form, incorporation date, directors. KYB-ready JSON.
Categories: BUSINESS, AI
