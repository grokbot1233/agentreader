# Monetization setup (Apify Console — manual step, nothing charged by us)

Pricing model: PAY_PER_EVENT
Primary event: `name-screened`
Event title: Name screened
Event description: One name fuzzy-screened against OFAC SDN + non-SDN, UK FCDO/OFSI, UN SC and EU consolidated lists, with scored candidates.
Suggested price USD: 0.01
Also keep synthetic `apify-actor-start` (list download ~5–10 s per run is covered by start + compute).
Delete/zero `apify-default-dataset-item` so only `name-screened` (pushed via pushData(item, "name-screened")) is billed.

Rationale: AgentReader x402 equivalent is $1 per /sanctions-batch (≤50 names, i.e. $0.02/name) and $0.05 single /sanctions. $0.01/name on Apify undercuts for bulk buyers while staying well above compute cost.

SEO title: Sanctions Screening Batch — OFAC, UK, UN & EU Lists
SEO description: Fuzzy-screen names against fresh OFAC SDN, UK FCDO/OFSI, UN and EU sanctions lists. Scored candidates with programmes, aliases, DOB. For KYB/AML & AI agents.
Categories: BUSINESS, AI
