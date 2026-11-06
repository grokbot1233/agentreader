# Demand ranking — 2026-11-06 (AM refresh)

Scoring: payment evidence × price/volume potential × our fit (free data, existing code) × unbuilt. Status as of 2026-11-06 ~07:20 Europe/London.

| Rank | Need | Payment evidence | Est. price / volume | Fit | Status |
|---|---|---|---|---|---|
| 1 | **Page metadata / Open Graph extract** | Own legacy `/meta`: agentreader.dev **7** payers, workers.dev **5**; minifetch preview/metadata **7–8**; Toll `extract_page_links_meta` $0.003 | Micro $0.001; high explorer + SEO-agent use | High — safeFetch + linkedom; cheaper than `/read` | **SHIPPED → `/meta` $0.001 (v1.18.0)** |
| 2 | On-chain pending block (`/chain/pending`) | onesource pending **72** unique payers @ $0.01 | Micro–$0.01; payers≈calls | High — public RPC `eth_getBlockByNumber("pending")` | **SHIPPING → `/chain/pending` $0.001 (v1.19.0)** |
| 3 | HTTP security headers audit | headers.use.x402atlas **17** payers @ $0.01; Toll ~$0.0115 | Micro $0.001–0.01 | High — HEAD via safeFetch; `/check` only HSTS | **SHIPPING → `/headers` $0.001 (v1.19.0)** |
| 4 | IBAN mod-97 validate | halowerk **8**, agentindex **6**, greeneris **5**; Toll `$0.001` | Micro $0.001 | High — offline; pairs with `/eu-vat`/KYB | **SHIPPING → `/iban` $0.001 (v1.19.0)** |
| 5 | On-chain one-fact breadth (other aliases) | onesource 100–547 payers/resource @ $0.001–0.005 | High payer count, low ARPU | High — `/chain/*` live | Live; register distinct resources |
| 6 | KYB / multi-registry packs | Brazilayer $0.05; Lion $0.03; Apify ~$0.05 | Higher ticket | High — `/kyb` $2.50 etc. | Live |
| 7 | Web read / search | Exa / ScrapeGraphAI; hist. ~218k search calls | High volume | High — `/read`, `/search`, `/read-batch` | Live |
| 8 | Email address verification | Toll `verify_email` $0.001 | Micro | High — DoH | **SHIPPED → `/email-check` $0.002** |
| 9 | Standalone RDAP/domain age | Partial historically in `/company` | Micro | High | **SHIPPED → `/domain` $0.002** |
| 10 | DNS resolve | Agents need records; our workers.dev `/dns` **13** payers | Micro $0.001 | High — DoH | **SHIPPED → `/dns` $0.001** |
| 11 | URL redirects / unshorten | Toll unwrap sellers $0.001–0.01 | Micro $0.001 | High — safeFetch chain | **SHIPPED → `/redirects` $0.001** |
| 12 | SSL/cert expiry standalone | macaroon **10**, x402atlas ssl **8** | Micro–$0.01 | Medium — Workers peer-cert hard | Deferred |
| 13 | IP geolocation | Multiple geo sellers ~10–13 payers | Micro | Medium — free geo ToS/rate | Deferred (ToS) |
| 14 | People enrichment | Stableenrich $0.15 | High $ | Low — legal/ToS | **Skip** |
| 15 | LLM inference | blockrun 89k calls | High volume | Low — COGS | **Skip** |
| 16 | NZ company registry | Open data after approval | Medium | Medium — portal blocked | Blocked |

## Next passes (spider-web)

1. `/chain/pending` + `/headers` + `/iban` shipping v1.19.0; next one-fact `/chain/*` aliases + soft distribute.
2. Register missing `/chain/*` (esp. pending) as distinct Bazaar/x402scan resources.
3. Soft distribute `/meta` + `/read` (metadata vs full body) and `/kyb`+`/email-check`.
4. Re-pull CDP Bazaar on next demand run; keep IP geo deferred.
