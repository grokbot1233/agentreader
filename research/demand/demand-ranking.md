# Demand ranking — 2026-11-07 AM refresh

Scoring: payment evidence × price/volume potential × our fit (free data, existing code) × unbuilt. **High-ticket first.** Status as of 2026-11-07 ~01:35 Europe/London. Live baseline before this ship: **v1.34.1**; this pass targets **v1.35.0**.

**Directive (Liam 2026-11-06):** do not ship $0.001–$0.003 offline format validators. Micros stay HTTP-callable but unlisted from MCP/llms/discovery (since v1.28.0). Focus big hitters + expansions.

| Rank | Need | Payment evidence | Est. price / volume | Fit | Status |
|---|---|---|---|---|---|
| 1 | **CH company registry (Zefix UID)** | Apify Zefix scraper **29 users**; GH multi-registry/KYB threads; pairs with offline `/uid-ch` | **$0.25**; attaches to `/kyb` | High — free Zefix REST (no key) | **SHIPPED → `/ch-company` $0.25 + `/kyb` uid= + `/registry-batch` ch= + company-full soft-attach (v1.35.0)** |
| 1b | **FI company registry (PRH YTJ)** | Nordic KYB demand; GH multi-registry | **$0.25** | High — free PRH open data | **SHIPPED → `/fi-company` (v1.34.0)** |
| 1c | **DK company registry (CVR)** | Nordic pack completeness | **$0.25** | High — apicvr.dk free | **SHIPPED → `/dk-company` (v1.33.0)** |
| 1d | **NO / FR company registries** | Nordic + FR KYB | **$0.25** | High — free official | **SHIPPED → `/no-company` `/fr-company`** |
| 2 | KYB / multi-registry packs | Brazilayer/Lion/Apify ~$0.03–0.05; our pack priced premium | Higher ticket $2.50 | High | Live `/kyb` **$2.50** (UK/AU/CA/FR/NO/DK/FI/**CH**) |
| 3 | UK DD / watch / leads | NewcoSignal £49–149/mo; Apify CH feed | $1–$25 | High | Live `/uk-dd` `$1`, `/uk-watch` `$5`, `/uk-leads` `$1`, `/uk-leads-feed` `$25` |
| 4 | Company research / full | Own `/company` band; BuiltWith $0.05 | $0.25–$0.65 | High | Live `/company` `$0.25`, `/company-full` `$0.65` (+CH soft-attach) |
| 5 | Sanctions batch / screening | Toll OFAC ~$0.02–0.023; Relaystation/DEBYKO ~$0.01 | $0.05–$1 | High | Live `/sanctions` `$0.05`, `/sanctions-batch` `$1` |
| 6 | UK company / charity / officer | CH demand on GH | $0.15–$0.50 | High | Live `/uk-company` `$0.50`, `/uk-charity-full` `$0.25`, `/uk-officer` `$0.15` |
| 7 | Registry batch multi-country | Batch DX for agents | $0.30 | High | Live `/registry-batch` `$0.30` (**+CH**) |
| 8 | **PL KRS full extract** | Large EU market; free `api-krs.ms.gov.pl` odpisy 200 tonight | **$0.25** | High — free official JSON by KRS number | **NEXT unbuilt** (name search harder; NIP via MF whitelist optional attach) |
| 9 | **SE company registry (Bolagsverket)** | Prior ranking “after DK”; Toll orgnr peers | **$0.25** | Medium — **API needs Kundanmälan / client registration** | **Blocked (Liam portal)** — offline `/orgnr` only |
| 10 | BE KBO / BCE | EU KYB breadth | Mid | Medium — open data is **bulk XML download**, not live lookup | Probe next; may need Worker KV snapshot |
| 11 | IE CRO | EU KYB | Mid | Low tonight — **CSV bulk** via opendata.cro.ie only | Deferred |
| 12 | EE äriregister | Baltic pack | Mid | Medium — open-data portal up; JSON hop unclear | Probe next |
| 13 | Live wallet balance (native + N ERC20s) | onesource 458–466p @ $0.003 | Micro | High | **SHIPPED** `/chain/live-balance` — keep, no new micros |
| 14 | On-chain one-fact breadth | onesource 100–574p | Micro ARPU | High | Live `/chain/*` — **do not expand for payer-count alone** |
| 15 | Web read / search | Exa / ScrapeGraphAI | High volume | High | Live `/read`, `/search`, `/read-batch` |
| 16 | Offline ID validators | Toll $0.001 peers; high explorer payers | Micro | High offline | **SHIPPED / SKIP further** under directive |
| 17 | BR CNPJ **full** KYB (Receita) | Brazilayer $0.0575 | Mid $0.25+ | Medium — rate/ToS | **Deferred** |
| 18 | SG ACRA company search | Toll listing | Mid | Medium — free API unclear | Deferred |
| 19 | People enrichment | stableenrich $0.15–0.28 | High $ | Low — legal/ToS | **Skip** |
| 20 | LLM inference | blockrun / Apify prepaid | High volume | Low — COGS | **Skip** |
| 21 | NZ company registry | Open data after approval | Medium | Medium — portal blocked | Blocked (needs Liam) |

## Next passes (spider-web)

1. Grow/sell big hitters: `/kyb` (now +CH), `/uk-dd`, `/uk-company`, `/uk-watch`, `/uk-leads(+feed)`, `/company(+full)`, `/sanctions-batch`, `/uk-charity-full`, `/registry-batch`, `/uk-officer`, `/fr-company`, `/no-company`, `/dk-company`, `/fi-company`, **`/ch-company`**.
2. Next free builds: **PL KRS** `$0.25` (API confirmed 200); BE KBO snapshot if live API stays absent; EE if JSON hop found.
3. Liam blockers: **SE Bolagsverket Kundanmälan**, NZBN portal, BR Receita ToS clarity.
4. Re-pull CDP Bazaar filtered to ≥$0.15 **non-LLM / non-people** SKUs each run.
5. Outreach: soft GH comment on multi-registry/KYB threads; X only via @axiomworksd8z9.
