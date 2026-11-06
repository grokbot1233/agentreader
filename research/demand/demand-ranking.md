# Demand ranking — 2026-11-06 (evening refresh)

Scoring: payment evidence × price/volume potential × our fit (free data, existing code) × unbuilt. **High-ticket first.** Status as of 2026-11-06 ~20:45 Europe/London. Live: **v1.30.0**.

**Directive (Liam 2026-11-06):** do not ship $0.001–$0.003 offline format validators. Micros stay HTTP-callable but unlisted from MCP/llms/discovery (since v1.28.0). Focus big hitters + expansions.

| Rank | Need | Payment evidence | Est. price / volume | Fit | Status |
|---|---|---|---|---|---|
| 1 | **NO company registry (Brreg Enhetsregisteret)** | Nordic KYB demand; GH multi-registry threads; pairs with FR/UK packs | **$0.25**; attaches to `/kyb` | High — free Brreg open data (NLOD) | **SHIPPED → `/no-company` $0.25 + `/kyb` orgnr= + `/registry-batch` no= (v1.30.0)** |
| 1b | **FR company registry (live Sirene/RNE)** | Toll FR peers historically $0.002–0.01; RapidAPI FR KYB seats; Apify EU KYB router lists FR; GH KYB threads want multi-registry | **$0.25**; attaches to `/kyb` | High — free `recherche-entreprises.api.gouv.fr` | **SHIPPED → `/fr-company` $0.25 + `/kyb` siren/siret + `/registry-batch` fr= (v1.29.2)** |
| 2 | KYB / multi-registry packs | Brazilayer/Lion/Apify ~$0.03–0.05; our pack priced premium | Higher ticket $2.50 | High | Live `/kyb` **$2.50** (now UK/AU/CA/**FR/NO**) |
| 3 | UK DD / watch / leads | NewcoSignal £49–149/mo; Apify CH feed | $1–$25 | High | Live `/uk-dd` `$1`, `/uk-watch` `$5`, `/uk-leads` `$1`, `/uk-leads-feed` `$25` |
| 4 | Company research / full | Own `/company` band; BuiltWith $0.05 | $0.25–$0.65 | High | Live `/company` `$0.25`, `/company-full` `$0.65` |
| 5 | Sanctions batch / screening | Toll OFAC ~$0.02–0.023; compliapi/oceanalt mid | $0.05–$1 | High | Live `/sanctions` `$0.05`, `/sanctions-batch` `$1` |
| 6 | UK company / charity / officer | CH demand on GH | $0.15–$0.50 | High | Live `/uk-company` `$0.50`, `/uk-charity-full` `$0.25`, `/uk-officer` `$0.15` |
| 7 | Registry batch multi-country | Batch DX for agents | $0.30 | High | Live `/registry-batch` `$0.30` (**+FR+NO**) |
| 8 | Live wallet balance (native + N ERC20s) | onesource 458–466p @ $0.003 | Micro | High | **SHIPPED** `/chain/live-balance` $0.002 — keep, no new micros |
| 9 | On-chain one-fact breadth | onesource 100–574p | Micro ARPU | High | Live `/chain/*` — **do not expand for payer-count alone** |
| 10 | Web read / search | Exa / ScrapeGraphAI | High volume | High | Live `/read`, `/search`, `/read-batch` |
| 11 | Email / DNS / meta / headers / redirects | Toll + own | Micro | High | **SHIPPED** micros — unlisted |
| 12 | Offline ID validators (phone, IBAN, postcode, SIREN… CNPJ/NIP/UID…) | Toll $0.001 peers; high explorer payers | Micro | High offline | **SHIPPED / SKIP further** under directive (HTTP kept, discovery unlisted) |
| 13 | BR CNPJ **full** KYB (Receita) | Brazilayer $0.0575 | Mid $0.25+ possible | Medium — rate/ToS | **Deferred** (probe 200; not free-clear for production volume) |
| 14 | SG ACRA company search | Toll listing | Mid | Medium — free API unclear | Deferred |
| 15 | SSL/cert expiry standalone | macaroon/x402atlas ~8–10p | Micro–$0.01 | Medium — Workers peer-cert hard | Deferred |
| 16 | IP geolocation | Toll $0.002 | Micro | Medium — ToS | Deferred |
| 17 | People enrichment | stableenrich $0.15–0.28 | High $ | Low — legal/ToS | **Skip** |
| 18 | LLM inference | blockrun 89k calls | High volume | Low — COGS | **Skip** |
| 19 | NZ company registry | Open data after approval | Medium | Medium — portal blocked | Blocked (needs Liam) |
| 20 | onesource deepstate/standard Protocol | 50–299p @ $0.005–0.05 | Medium | Low — proprietary | Skip |

## Next passes (spider-web)

1. Grow/sell big hitters: `/kyb` (now +FR+NO), `/uk-dd`, `/uk-company`, `/uk-watch`, `/uk-leads(+feed)`, `/company(+full)`, `/sanctions-batch`, `/uk-charity-full`, `/registry-batch`, `/uk-officer`, **`/fr-company`**, **`/no-company`**.
2. Deeper expansions: more free EU/Nordic registries inside `/kyb`/`/registry-batch` (DK CVR live, SE Bolagsverket if free), BR Receita (if ToS OK), sanctions list freshness.
3. Outreach: pitch FR+KYB to agent builders (Groundwork#22 et al.); SwarmMemo partnership already warm.
4. Re-pull CDP Bazaar filtered to ≥$0.15 **non-LLM / non-people** SKUs each run.
5. awesome-langchain: do not re-PR.
