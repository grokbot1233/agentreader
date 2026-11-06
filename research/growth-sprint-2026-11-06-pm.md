# Growth sprint — 2026-11-06 PM (~15:25 Europe/London)

Ship half: **v1.25.0** offline validators `/uk-postcode` + `/siren` + `/siret` @ $0.001. No spend (ads). Test-wallet settles only.

## 1. Live numbers (outside revenue snapshot)

| Metric | Value |
|---|---|
| Outside revenue | **~$0.004 USDC** |
| Outside paid calls | **3** |
| Unique outside payers | **1** |
| Note | Unchanged vs AM; new micros not yet discovered by outside agents |

Grow/cut: **none** (<7d since ship).

## 2. What shipped (v1.25.0)

| Endpoint | Price | Notes |
|---|---|---|
| `GET/POST /uk-postcode` | $0.001 | Offline Royal Mail grammar + GIR 0AA; path alias |
| `GET/POST /siren` | $0.001 | FR 9-digit Luhn; La Poste exception |
| `GET/POST /siret` | $0.001 | FR 14-digit Luhn (SIREN+NIC) |

- Deploy: `490b8d96-a002-4baa-aaf9-5c46bb100c70` (final with VALIDATE+previews)
- Earlier deploy race with continuous-improvement routine on `/uk-postcode` only; siren/siret restored and redeployed
- Paid settles (test wallet): uk-postcode `0xc2f14c2c…442f2`, siren `0x942312e5…b2215`, siret `0x8239d509…91a195`
- x402scan: all three registered (ids fd82dad1… / 2accc7f9… / 2ae975a7…)
- npm: `@axiomworks/agentreader` + `agentreader-mcp` **1.25.1** (1.25.0 already taken by parallel uk-postcode-only publish)
- Live health/openapi: **1.25.0**; bare 402 amountAtomic **1000**; empty → free 400; `?preview=1` → 200

## 3. Discovery notes

- Toll peers: `uk_postcode_validate` / `siren_validate` / `siret_validate` @ $0.001 (demand ranks 16–17)
- Soft GH: no clearly relevant open FR company-ID / UK postcode validator issue found this pass (skip spam)
- Next free builds: IT Partita IVA / SE orgnr / CA BN / DK CVR
- Continue buyer hunt + soft distribute micros; no ads / featured listings

## 4. Blockers / notes

- Parallel continuous-improvement routine contested `src/index.ts` mid-ship (uk-postcode-only 1.25.0); resolved by re-wiring siren/siret + redeploy
- No Coinbase Default touch; no money spent
