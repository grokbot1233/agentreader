# Operator thesis — Sat 2026-11-07 ~10:05 Europe/London

Goal: **paid conversion above the $200/mo Max plan**. Customer MTD still **$0.004** (3 paid calls / 1 payer; none on `/kyb`, `/uk-company`, `/sanctions-batch`). Live **v1.39.3**. Do **not** ship another country registry or micro SKU this window.

## What changed (since morning)

### Leaderboards (data / identity / KYB / registry only; ignore LLM + people-enrichment)
- **Paddock** (7d to Nov 6): board ~$73.8k settled / 1,462 services. Top money is payments (laso), micro-tools (AX1), comms (dtelecom) — **not** KYB. Relevant peers still tiny: `companies.use.x402atlas.com` **$0.75**, `api.jpverify.com` **$0.34** (1 payer), `agentreader.dev` **$0.15**, `sanctions.nsgoods.org` **$0.08**, `uk-company-check.fly.dev` **$0.03**. Source: https://paddock.finance/leaderboard
- **Agent402** (7d Base): AX1 ~$14.3k, datapackvibe, dtelecom, Zerion, X Pay, keyring (~$300). No material KYB seller in the ranked head. Source: https://agent402.tools/leaderboard
- **Agent GDP**: Identity/verification use-case **$1.11k / 7d (+187%)** — category exists and is growing, still ~1.6% of board. x402 7d ~$83k. Source: https://agentgdp.io/gdp
- **x402-list**: `best?q=company KYB sanctions registry` ranks Strale / Xynaptic / **W System EU Business Data API** (Verification, $1.72 / 30d). **AgentReader** is listed under that query. Source: https://x402-list.com/api + /best
- **402radar**: 30d volume dominated by BlockRun / AX1 / StableEnrich — no KYB heavyweight. Source: https://402radar.io/
- **x402scan**: explorer/API; no separate KYB board pulled this pass (llms.txt only).

**Read:** agents pay for rails and market micros. Official-registry KYB is still a thin paid niche — **ours to own by converting warm partners, not by shipping more endpoints.**

### Regulatory / sanctions / upstream
- **UK director IDV transition ends 17 Nov 2026** (ECCTA; started 18 Nov 2025). PSCs have role-specific 14-day windows. First prosecutions already reported. Demand spike window for CH officer/PSC verification status is **this next ~10 days**. Sources: https://www.gov.uk/guidance/verify-your-identity-for-companies-house · Pinsent Masons (10 Sep 2026) · Legal500 prosecutions note.
- **Companies House API**: latest forum note is Oct 8 — new PSC data item loading from 13 Oct for ~15–20 days (streaming event surge). No newer Nov-7 breaking API change. Source: https://forum.companieshouse.gov.uk/t/loading-of-new-persons-with-significant-control-data/13064
- **OFAC**: fresh designations Nov 4–6 (Iran MSBs/shadow fleet; Cuba vessels; cyber/TCO scam infrastructure). **OFSI**: late-Oct licence updates (Legal Services GL; Lukoil Bulgaria extension) — no brand-new UK list dump today. Sources: ofac.treasury.gov/recent-actions/20261104|05|06 · Steptoe weekly Nov 2.
- **Upstream probes (~10:05 GMT):** France recherche-entreprises **200** (~0.6s); Brreg **200** (~0.5s); Companies House company resource **401** without key (expected; live product previews via our key path still **200** for `/uk-company`, `/kyb`, `/sanctions-batch`, `/fr-company`, `/no-company`). Health **1.39.3**.

### Warm people
| Lead | Status | Action this run |
|---|---|---|
| **Hugo0 / swarmmemo#49** | `pricing_url` live in SwarmMemo **1.147.5** (05:30 GMT); board task open through **13 Nov**; 3/5 preview results already in | **Replied** acknowledging pricing_url + asking paid-conversion signals in closing summary → https://github.com/Hugo0/swarmmemo/issues/49#issuecomment-6705421983 |
| **JPVerify / jpverify-mcp#1** | Maintainers asked for `/sanctions-batch` docs 09:02; we replied 09:33 with docs + preview + Latin-script honesty | **No further reply** (we spoke last) |
| **@payagents (X)** | Asked 03:43 GMT for one endpoint + exact USDC price + expected response before any paid test | **Blocked:** `user-X` MCP is Liam `@liam42690169`, not `@axiomworksd8z9`. Draft ready below — parent must send from AgentReader account |
| **MikeyPetrillo / Agent402#1899** | Closed: no wrapper tools for outside sellers; keep listing copy strong | **Thanked** → https://github.com/MikeyPetrillo/Agent402/issues/1899#issuecomment-6705422377 |
| **openclaw / #191008** | Cross-linked AgentReader in Company Research Job README (03:05 GMT) | **Thanked + reciprocal** → https://github.com/openclaw/openclaw/issues/191008#issuecomment-6705422176 |
| **gjwang** | No active AgentReader/KYB thread found this pass | Watch only |
| **desplega#2826 / alex09x/kyb#51** | Both closed (no x402 / out of scope) | Stop |
| **strale#883** | Bot re-ping only; no human reply to us | No spam |

### Stats (`.stats_secret` via `?key=`)
- Customer paid: **3 calls / $0.004 / 1 payer** (`/read`, unknown, `/chain/erc1155-balance`). **Zero** paid big-hitter calls MTD.
- Preview→paid funnel fields: **not exposed** on `/stats` (no preview counters in payload). SwarmMemo board is the live preview funnel to watch through 13 Nov.

## Who to watch
1. **Hugo0** — 13 Nov task close + whether any worker follows `pricing_url` into paid `/uk-company` or `/kyb`.
2. **@payagents** — concrete co-test ask; highest-certainty X conversion this morning.
3. **JPVerify maintainers** — waiting on their next move after sanctions docs.
4. **IDV deadline buyers** — UK agents needing officer/PSC verification status in the next 10 days (`/uk-company`, `/uk-dd`, `/kyb`).

## Best move this window
**Convert the two open warm pipes (PayAgents reply + Hugo SwarmMemo board through 13 Nov) into the first real paid `/uk-company` or `/kyb` dollars — do not ship another registry.**

Concrete next step the operator can still do free: parent posts the `@axiomworksd8z9` reply to PayAgents (draft below). Everything else this run that was free and in-policy is done.

### Draft for @axiomworksd8z9 → @payagents (do NOT send from Liam X)
Reply to https://x.com/payagents/status/2118912310693822613

> @payagents One concrete path to test unpaid first:
> GET https://api.axiomworks.co.uk/uk-company?number=00445790&preview=1
> Free truncated JSON (name/status/SIC/officer_count/red_flags). Full paid twin is the same URL without preview=1 — **$0.50 USDC on Base** (402 → PAYMENT-SIGNATURE retry). Expected paid shape: company profile + officers + PSCs + filings/charges/insolvency + red_flags. For a denser pack: /kyb?number=00445790 ($2.50). Happy to co-test once you've dry-run the preview.

## Anti-moves
- No new country registry / micro validator.
- No spend / no Coinbase Default portfolio touch.
- No cold GitHub issues; no second ping where we already spoke last (JPVerify, strale).
