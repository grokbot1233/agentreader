# Outbound: active buyer finding (zero-cost)

| Script | What it does |
|---|---|
| `scan.py` | Buyer-signal scanner → `research/leads/YYYY-MM-DD.json` (ranked) |
| `register.sh` | Free API-only registry submissions (402index.io, a2a-registry.org, a2aregistry.org). Idempotent |
| `run.sh` | Scheduled entrypoint: pull → scan → register → commit/push leads |

## Scanner sources
1. **On-chain (a):** CDP Bazaar discovery (`/platform/v2/x402/discovery/resources`) → top-25 Base/USDC services by 30-day calls → `eth_getLogs` USDC `Transfer(to=payTo)` over the last N blocks (default 20k ≈ 11 h) via free public RPCs (publicnode → drpc → base.org, 10k-block chunks). Wallets with 3+ payments become leads, tagged with the categories they buy (company/kyb, web/scrape, onchain, finance, ai). Also writes `bazaar_top_services` (market map).
2. **GitHub (b):** `gh api` searches: open issues asking for Companies House / KYB / SEC / VAT / x402 / html→markdown data (last 120 days), active repos (x402 agents, KYB/CH/EDGAR agents, CrewAI due diligence), and code using x402 clients (`withPaymentInterceptor`, `x402-fetch`, `@x402/fetch`, python `x402`). Vendored SDK copies and our own repos are filtered out.
3. **Demand (c):** HN Algolia (90 days, demand language + "api"/x402; hiring threads excluded) and Reddit JSON search (Reddit 403-blocks datacenter IPs. Works from a residential IP). X results are merged from `research/leads/x-YYYY-MM-DD.json`, which an agent with the X search tool writes (`[{username,url,text}]`).

Each lead: `source, id, url, title, why, product, action, score, rank`. Products are matched by regex over the text (see `PRODUCTS` in scan.py).

## Run
```bash
python3 scripts/outbound/scan.py                 # full (~4 min)
python3 scripts/outbound/scan.py --skip onchain  # faster
bash scripts/outbound/run.sh                     # scheduled: scan + register + commit
```
Cron example: `15 7 * * * cd /workspace/agentreader && bash scripts/outbound/run.sh >> /tmp/outbound.log 2>&1`

## Outreach rules (enforced by humans + agents)
No sending email or DMs. Drafts go in `research/leads/drafts-YYYY-MM-DD.md` for the owner. Autonomous GitHub actions are limited to about 5 genuinely helpful PRs or comments per run, with disclosure.
