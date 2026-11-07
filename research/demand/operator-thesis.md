# Operator thesis — Sat 2026-11-07 ~16:10 Europe/London (GMT)

Goal: **paid conversion above the $200/mo Max plan**. `/stats`: still **3 paid calls / 1 payer / $0.004 MTD**; zero big-hitter paid calls. Live **v1.42.0**. No new registries or micro SKUs this window.

## What changed since ~10:05
- **Leaderboards:** Paddock snapshot unchanged (Nov 6; KYB peers still tiny: x402atlas companies $0.75, jpverify $0.34, agentreader.dev $0.15, nsgoods sanctions $0.08, uk-company-check $0.03). Agent GDP 7d **Identity/verification $1.14k (+136%)**, 2.4% of board; x402 30d $382k (+51%). 402radar lists a **Compliance & Risk** category (185 services, 109 scored), so the niche is crowded on listings but thin on dollars. x402-list `/api/best` path now 404 (moved); not re-pulled.
- **Regulatory:** ECCTA director/PSC IDV transition ends **17–18 Nov 2026** (10 days). CH published Q2 IDV compliance data 29 Oct. First prosecutions (Sep) also fined a *co-director* for letting an unverified director act. That gives counterparties a real reason to check officer verification status before 18 Nov.
- **CH developer forum (6 Nov):** two unanswered threads asking for **licence/commercial-reuse terms for Public Data API data**. One (`data3`) is building a paid CH status-change service, which is a direct `/uk-watch` peer. Watch for CH's answer: it is a licence risk for every `/uk-*` SKU and also gives us copy for an "OGL-attributed" trust line.
- **Sanctions:** OFAC 4–6 Nov (Iran shadow fleet; Prince Group network of 41 companies across HK/BVI/SG/MY/MU; 8 Canadian Iran MSBs on 6 Nov). **Our index already has the 6 Nov MSBs** (`/sanctions-batch` preview hits Darvish Exchange / Diverse Trade / NIA Nations). This freshness proof can go to warm partners.
- **Upstream ~16:03:** Brreg 200, recherche-entreprises 200 but **intermittently 429 on our shared egress**. CH 401 without key (expected); our `/uk-company`, `/uk-dd`, `/kyb`, `/no-company` previews are 200. **Fix shipped:** `/fr-company` now backs off and retries 3× on upstream 429 (commit ca537d4, deploy b99440d3). Some 429s remain under burst; next step if it persists is a short KV cache per SIREN.

## Warm people
| Lead | State | This run |
|---|---|---|
| Hugo0 / swarmmemo#49 | Window fixed 2026-11-06 15:00 → 11-13 23:59:59 UTC; he posts on 14 Nov | No reply (nothing new). We post our first-payer count after close |
| JPVerify maintainers | Added **Complementary checks** README section naming `/sanctions-batch` (b18bf9c) and asked us to flag any wording issues | **Confirmed wording accurate + thanked** → https://github.com/japanverify/jpverify-mcp/issues/1#issuecomment-6709490440 |
| @payagents (X) | Our 11:48 reply gave them endpoint, price and shape; no answer from them yet | Wait. No second ping before ~24h |
| @boardyai (X) | 14:18 GMT: "agents get kyb in one call and i still wait on email" (light banter) | Optional one-liner proposed (low value) |
| paidwithtab/tab#2 | Closed: Base USDC "next on our list" | Watch the changelog for Base support, then re-touch |
| gjwang | No live AgentReader thread | Watch only |

## Who to watch
1. **Hugo0 board through 13 Nov:** the only live preview→paid funnel.
2. **@payagents:** answer on a co-test.
3. **CH forum licence answer:** risk, plus a competitor (`data3`) watch.
4. **IDV-deadline buyers (to 18 Nov):** officer/PSC verification status via `/uk-company`, `/uk-dd`, `/kyb`.

## Single best move this window
**Get one real paid `/uk-company` or `/kyb` call out of the warm pipes before 13 Nov (SwarmMemo board, PayAgents co-test, JPVerify cross-link traffic). Lead every touch with the IDV-deadline angle ("check officer verification before 18 Nov").** Don't ship new endpoints. The only build work allowed is reliability fixes on big hitters (e.g. the FR 429 cache).

## Anti-moves
No new registry or micro SKU. No spend. No Coinbase Default portfolio. No second ping where we spoke last (strale, satroot, toonvincke, payagents).

---

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
