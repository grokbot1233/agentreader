# Daily sales check — 2026-11-07 ~09:10 Europe/London (GMT)

## Revenue (outside; test wallet excluded)
- Yesterday (6 Nov): $0.001 / 1 paid
- Today so far (7 Nov): $0.000 / 0 paid
- MTD: $0.004 / 3 paid / 1 unique payer
- By endpoint: /read $0.002 · /chain/erc1155-balance $0.001 · unknown $0.001
- Test: 118 calls / $1.495
- Projected month @ pace (day 7): ~$0.017; gap to $200: $199.996
- Apify: earnings unknown (no seller API); ultramarine_gusto actors public incl. agent-kyb-check + uk-charity-check

## Product test
- PASS health 1.39.1
- PASS discovery /, /openapi.json, /.well-known/x402, /.well-known/agent.json, /llms.txt
- PASS HTTP x402: 158/188 OpenAPI immediate 402; 30 remaining = free validation 400 or non-routable `{param}` templates; valid-input retest 36/36 (payTo treasury, base/eip155:8453)
- PASS MCP 80 tools: 79/79 paid PaymentRequired+payTo with valid args; pricing free
- PASS previews/samples big hitters + /sk-company (SLOVNAFT)
- Monitor cron: wrangler `0 * * * *` configured
- Paid settlement: skipped (<7d since 2026-11-06T08:38Z)
- Treasury: USDC 2.588 / ETH ~0.000399 — no sweep (<$20)
- Fixes/deploys: none

## Grow/cut
- None — big hitters + registries through /sk-company all <7d from launch; keep/outreach only high-ticket

## Listings
- npm agentreader(+mcp) 1.39.0; live API 1.39.1; PyPI 1.11.0
- a2aregistry listed but version stale 1.38.0
- Apify high-ticket pages public
- Merged (6 Nov): Recall-Kitchen#142, zinyando/awesome-crewai#8, TensorBlock#5391
- Open PRs ~13 (incl. tsubasakong#135, sanctions list PRs, punkpeye#18634)

## Inbox
- Zoho SealKeeper (02:24 GMT): axiom-works-agentreader 0/5 task checks (needs claim + per-skill test inputs); uptime 100%
- Gmail: partner closes alex09x/kyb#51 + desplega#2826 not planned; Hugo/SwarmMemo already handled; npm publish notices; no customer pay mail
- Draft reply (optional, do not send): claim SealKeeper agent and set preview-friendly inputs per skill
