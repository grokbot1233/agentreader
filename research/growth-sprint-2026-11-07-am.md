# Growth sprint — 2026-11-07 AM (~08:40 Europe/London)

Parallel discovery / listings / outreach / dashboard track. **No spend.** Did **not** touch `src/index.ts` (sibling shipping `/sk-company` → 1.39.0). Live at note close: **1.39.0** (sibling `/sk-company` landed during this run; empty param → free 400).

## 1. Numbers

| Metric | Value |
|---|---|
| Outside revenue | **$0.004 USDC** |
| Outside paid calls | **3** |
| Unique outside payers | **1** |
| Treasury | ~**$2.59 USDC** + ~0.000399 ETH |
| Live API | https://api.axiomworks.co.uk **v1.39.0** (was 1.38.1 at start) |
| Spend this run | **$0** |

Self-check (prior ~08:07 GMT, still representative): PASS402=78 FAIL=0; MCP 79 tools serverInfo 1.38.1; deploy `b89fd317-0ca6-4b88-b356-517234394cd8`.

## 2. Grow/cut (7-day rule)

**N/A — do NOT cut.**

Big hitters launched within the last ~2 days (v1.10–1.38 window): `/kyb`, `/uk-dd`, `/uk-watch`, `/uk-leads`, `/uk-leads-feed`, `/company`, `/company-full`, `/sanctions-batch`, and country registries (`/be-company`, `/sk-company`, `/pl-company`, `/ch-company`, `/fi-company`, `/dk-company`, `/cz-company`, …). All are **<7 days** old → keep and grow. Dashboard 14d/50-calls rule also not triggered for cuts.

**Grow focus:** `/kyb` ($2.50), `/uk-dd`, `/uk-watch`, `/uk-leads` / `/uk-leads-feed`, `/company` / `/company-full`, `/sanctions-batch`, registries.  
**Ignore:** new $0.001–$0.003 micros (standing Liam directive).

## 3. Discovery actions taken

### Apify Store (high-ticket only, no boost/pay)
| Actor | Public | Store |
|---|---|---|
| `ultramarine_gusto/uk-company-dd` | **true** | https://apify.com/ultramarine_gusto/uk-company-dd |
| `ultramarine_gusto/agent-kyb-check` | **true** | https://apify.com/ultramarine_gusto/agent-kyb-check |
| `ultramarine_gusto/uk-new-company-leads` | **true** | https://apify.com/ultramarine_gusto/uk-new-company-leads |

### Soft GitHub outreach (grokbot1233 only; 1 comment/thread; not already in morning buyer08 set)
| Thread | Comment |
|---|---|
| Abuubkar/lead-gen#7 (CH API key for PECR type) | https://github.com/Abuubkar/lead-gen/issues/7#issuecomment-6704589372 |
| zohelo/zohelo-data#539 (CH source CD-014) | https://github.com/zohelo/zohelo-data/issues/539#issuecomment-6704589562 |
| serlekan/minskscout#2 (EU-first PL/EE commerce) | https://github.com/serlekan/minskscout/issues/2#issuecomment-6704589795 |

Pointed at big hitters (`/kyb` $2.50, `/uk-dd`, registries, `/sanctions-batch`). No spam-list PRs. No Liam personal X. X drafts for `@axiomworksd8z9` left in `research/leads/drafts-2026-11-07.md` (no publish this run).

### Free registries / listings
| Venue | Result |
|---|---|
| 402index.io | `/kyb` `/uk-leads` `/uk-leads-feed` `/uk-watch` → **201** registered & live; ~49 AgentReader services searchable |
| a2a-registry.org | Unclaimed agent refreshed (`uk.co.axiomworks.axiom_works_agentreader`) |
| a2aregistry.org | Already listed id `0e2ded94-…` (card v1.38.0 in index); PUT update **Forbidden** without claim — leave as-is |
| cadauso.com | `/kyb` still **pending** review (submitted earlier AM) |
| PayAPI Market | **Ignored** (demands USDC to list — no-spend) |
| Archer / Agensi | Need browser sign-in — drafts only |

## 4. Dashboard meta

- Was stale at 1.26.x in repo `dashboard-meta.json`.
- Posted merge via `scripts/update-dashboard-meta.sh` → **`{"ok":true,...}`** with real facts (v1.38.0 `/be-company`, v1.38.1 BE docs/schema, grow/cut N/A, outside $0.004/3/1).
- Patch saved: `research/leads/dashboard-patch-2026-11-07-growth-sprint-am.json`
- Confirmed `/sk-company` live under **1.39.0** before close; dashboard meta refreshed to include it.

## 5. Next free builds (priority)

| Build | Notes |
|---|---|
| **EE credentials** | Estonia e-Business Register — needs free credentials path |
| **LV CSV snapshot** | Latvia company open data CSV snapshot (no live key) |
| **NL KvK** | Needs API key + ToS review — blocked |
| **DE Handelsregister** | No free API — parked |
| **SE** | Liam portal / Bolagsverket path — wait for Liam |

Also: warm `/kyb` / `/uk-dd` / `/uk-leads-feed` on x402 leaderboards; claim/update a2aregistry after 1.39.0 if auth appears; keep PayAPI unpaid.

## 6. Blockers

- Outside revenue still **$0.004 / 3 / 1** — no new paying wallets this run.
- a2aregistry version stuck at listed 1.38.0 (PUT Forbidden).
- Cadauso pending; Archer/Agensi need interactive browser.
- Avoided `src/index.ts` conflict; sibling `/sk-company` landed as **1.39.0** before close (noted in dashboard).
- `/stats` 401 with rotated dashboard key was noted earlier AM — not re-probed with secrets printed.

## 7. Files written

- `research/growth-sprint-2026-11-07-am.md` (this note)
- `research/leads/dashboard-patch-2026-11-07-growth-sprint-am.json`
- `research/leads/registry-attempts-2026-11-07-growth-am.txt`
- Appended `research/leads/outreach-2026-11-07-buyer08.md`
