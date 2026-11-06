# Demand ranking — 2026-11-06 (PM refresh)

Scoring: payment evidence × price/volume potential × our fit (free data, existing code) × unbuilt. Status as of 2026-11-06 ~13:25 Europe/London.

| Rank | Need | Payment evidence | Est. price / volume | Fit | Status |
|---|---|---|---|---|---|
| 1 | **Live wallet balance (native + N ERC20s)** | onesource `live-balance` **458** unique payers @ $0.003 (PM Bazaar) | Micro $0.002–0.003; payers≈calls | High — public RPC batch; distinct from `/wallet` majors | **SHIPPED → `/chain/live-balance` $0.002 (v1.24.0)** |
| 2 | Page metadata / Open Graph | Own legacy `/meta` 7+5 payers; Toll meta $0.003 | Micro $0.001 | High | **SHIPPED → `/meta` $0.001** |
| 3 | On-chain pending block | onesource pending **74** @ $0.01 | Micro $0.001 | High | **SHIPPED → `/chain/pending` $0.001** |
| 4 | HTTP security headers | headers.x402atlas **17** @ $0.01 | Micro $0.001 | High | **SHIPPED → `/headers` $0.001** |
| 5 | IBAN mod-97 | halowerk/agentindex/greeneris 5–8; Toll $0.001 | Micro $0.001 | High | **SHIPPED → `/iban` $0.001** |
| 6 | NFT metadata | onesource ~233 @ $0.008 | Micro $0.002 | High | **SHIPPED → `/chain/nft-metadata` $0.002** |
| 7 | ERC721 token list for wallet | onesource ~230 @ $0.008 | Micro $0.002 | High | **SHIPPED → `/chain/erc721-tokens` $0.002** |
| 8 | On-chain one-fact breadth (other) | onesource 100–559 payers/resource | High payer, low ARPU | High | Live `/chain/*` + `/wallet`/`tx`/`ens` |
| 9 | KYB / multi-registry packs | Brazilayer/Lion/Apify ~$0.03–0.05 | Higher ticket | High | Live `/kyb` `$2.50`, `/uk-dd` `$1` |
| 10 | Web read / search | Exa / ScrapeGraphAI; hist. high volume | High volume | High | Live `/read`, `/search`, `/read-batch` |
| 11 | Email address verification | Toll `verify_email` $0.001 | Micro | High | **SHIPPED → `/email-check` $0.002** |
| 12 | Standalone RDAP/domain age | Partial hist. in `/company` | Micro | High | **SHIPPED → `/domain` $0.002** |
| 13 | DNS resolve | Own workers.dev `/dns` **13** payers | Micro $0.001 | High | **SHIPPED → `/dns` $0.001** |
| 14 | URL redirects / unshorten | Toll unwrap $0.001–0.01 | Micro $0.001 | High | **SHIPPED → `/redirects` $0.001** |
| 15 | Phone E.164 validate | Toll phone tools | Micro $0.001 | High | **SHIPPED → `/phone` $0.001** |
| 16 | **UK postcode structural validate** | Toll `uk_postcode_validate` $0.001 | Micro $0.001 | High — offline; KYB attach; we already have PC regex | **SHIPPED** `/uk-postcode` v1.25.0 |
| 17 | FR SIREN / SIRET offline | Toll `$0.001` each | Micro | High — offline Luhn/mod | Next |
| 18 | IT Partita IVA / SE orgnr / CA BN | Toll `$0.001` | Micro | High — offline | Next |
| 19 | SSL/cert expiry standalone | macaroon **10**, x402atlas ssl **8** | Micro–$0.01 | Medium — Workers peer-cert hard | Deferred |
| 20 | IP geolocation | Multiple geo ~10–13 payers; Toll `$0.002` | Micro | Medium — free geo ToS/rate | Deferred (ToS) |
| 21 | People enrichment | Stableenrich $0.15 / PDL | High $ | Low — legal/ToS | **Skip** |
| 22 | LLM inference | blockrun 89k calls | High volume | Low — COGS | **Skip** |
| 23 | NZ company registry | Open data after approval | Medium | Medium — portal blocked | Blocked |
| 24 | onesource deepstate/standard Protocol | 50–299 payers @ $0.005–0.05 | Medium | Low — proprietary product APIs | Skip |

## Next passes (spider-web)

1. Finish ship `/chain/live-balance` + x402scan register + one soft outreach.
2. Next free build: FR `siren`/`siret` (UK postcode SHIPPED v1.25.0).
3. Soft distribute `/kyb`+`/uk-dd`+`/chain/live-balance`.
4. Re-pull CDP Bazaar next demand run; SSL/IP-geo still deferred.
5. awesome-langchain: do not re-PR.
