# Demand ranking — 2026-11-06

Scoring: payment evidence × price/volume potential × our fit (free data, existing code) × unbuilt. Status as of 2026-11-06.

| Rank | Need | Payment evidence | Price / volume signal | Fit | Status |
|---|---|---|---|---|---|
| 1 | **Email address verification** (syntax+MX+disposable+free/role) | Toll402 `verify_email` $0.001; Apify email validators; MCP domain email tools | Micro $0.001–0.005 band = majority of Bazaar calls; attaches to leads/KYB | High — DoH already in `core.ts`; no upstream fee | **BUILD NOW → `/email-check` $0.002** |
| 2 | On-chain one-fact breadth (path aliases, more distinct listings) | onesource 250–536 unique payers/resource @ $0.001–0.005 | High payer count, low ARPU (payers≈calls) | High — `/chain/*` already live | Live; optional alias/register churn later |
| 3 | KYB / multi-registry packs | Brazilayer $0.05; Lion $0.03; Apify KYB ~$0.05; NewcoSignal £49+/mo | Higher ticket, lower call count | High — `/kyb` $2.50, `/registry-batch` $0.30 | Live; grow distribution |
| 4 | Web read / search | Exa / ScrapeGraphAI $0.007–0.20; historical 218k search calls | High volume | High — `/read`, `/search`, `/read-batch` | Live |
| 5 | Token risk / verdict | ax1 ~$0.02 / 48k calls | Medium–high $ | Medium — `/token-check` $0.01 (deterministic) | Live |
| 6 | FX / rates | tick.hugen / ECB-class | Micro | High — `/fx` $0.002 | Live |
| 7 | UK new-co leads / watch | NewcoSignal £49–149/mo; Apify CH feed | Subscription ARPU | High — `/uk-leads*`, `/uk-watch` | Live; needs buyers |
| 8 | IP geolocation | Bazaar keyword hits in top hosts | Micro | Medium — free APIs have ToS limits | Candidate later |
| 9 | Standalone RDAP/domain age | Partial in `/company` | Micro | High | Partial (not separate product) |
| 10 | People enrichment | Stableenrich people-search $0.15 | High $ | Low — legal/ToS | **Skip** |
| 11 | LLM inference | blockrun 89k calls | High volume | Low — COGS | **Skip** |
| 12 | NZ company registry | Open data / free API after approval | Medium | Medium — blocked on portal | Blocked |

## Next passes (spider-web)

1. Ship `/email-check` → npm/MCP bump when convenient; Apify actor after publish window.
2. Register any missing `/chain/*` on x402scan/Bazaar as **distinct** resources (explorer payer theory).
3. Soft distribution of `/kyb` + `/email-check` together (onboarding agents).
4. Re-pull CDP Bazaar monthly; refresh this ranking.
