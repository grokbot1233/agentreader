# Growth sprint — 2026-11-06 AM (~08:40 Europe/London)

Research + grow/cut + free discovery half. No spend. Parallel ship executor landed **openapi 1.19.0** while this run worked (was 1.18.1 at start).

## 1. Live numbers (`GET /stats`, Bearer; secret not printed)

| Metric | Value |
|---|---|
| Outside revenue | **$0.004 USDC** |
| Outside paid calls | **3** |
| Unique outside payers | **1** (`0xA1d1C0cf…1978`) |
| Test calls / revenue | 102 / $0.331 (wallet `0xdefe5f9f…` excluded from customer stats) |
| Generated | 2026-11-06T08:39:24Z (cache) |

**by_endpoint (outside only):**

| Endpoint | Calls | USDC |
|---|---|---|
| `/read` | 1 | 0.002 |
| `/chain/erc1155-balance` | 1 | 0.001 |
| `unknown` | 1 | 0.001 |

**by_day:** 2026-11-05 → 2 / $0.003 · 2026-11-06 → 1 / $0.001

Recent mix is mostly test settlements (`/meta`, `/redirects`, `/dns`, `/domain`, `/email-check`, …). First real customer seed still `/read` on 2026-11-05.

Live API: **openapi 1.19.0**, MCP serverInfo **1.19.0**, **68 tools** (was 65). New paid 402 routes confirmed at $0.001 each: `/headers`, `/iban`, `/chain/pending`.

## 2. Top Bazaar signals (CDP free discovery, 3×1000 resources, total ~36.2k)

Onesource chain one-facts still dominate unique payers (erc20-balance **547**, block-number **504**, live-balance **450**, …). After assuming `/pending` `/headers` `/iban` ship, **gaps we still lack**:

| Gap | Evidence (unique payers / calls / price) | Notes |
|---|---|---|
| `/chain/nft-metadata` | onesource **228**/230 @ $0.008 | High explorer demand; we have `/nft` but not metadata alias |
| Gas micros (standalone) | vibesprings **26**, oblique **23**, railway **17** @ $0.001–0.002 | We have `/gas` — ensure distinct Bazaar resource registration |
| SSL/cert check | macaroon **10**, x402atlas **8** @ $0.001–0.01 | Workers peer-cert hard → still deferred |
| IP geo | ip402 **11**, bip-rep **11**, webbersites **10** | Deferred (ToS) |
| Phone validate | keyronne **8**, qonoro **4**, halowerk **3** @ $0.001–0.01 | Offline-ish; complements `/email-check` |
| Whois/RDAP depth | pocket **28** @ $0.005 (dns-whois-rdap) | Partial via `/domain` |
| PDF micros | mart402 pdf-info **13**, pdf-pages **10** | Partial via `/convert` |
| **Higher-ticket** | Bitrefill storefront info **24**; asterpay agent-readiness **36** @ $0.03; gondola image gen **21** @ $0.023 | Prefer our KYB/leads/watch ARPU over more micros |

Our `api.axiomworks.co.uk` resources were **not** in the first 3k discovery page — keep registering settled resources + Bazaar discoverable flags.

### Competitors / prices for just-shipped trio

| Product | Competitors | Our price |
|---|---|---|
| Pending block | onesource `/api/chain/pending` **72** payers @ **$0.01** | `/chain/pending` **$0.001** (10× undercut) |
| Security headers | headers.use.x402atlas **17** @ $0.01; cultos **9** @ $0.001; codepulse **4** @ $0.01 | `/headers` **$0.001** |
| IBAN mod-97 | halowerk **8** @ $0.001; agentindex **6** @ $0.002; greeneris **5** @ $0.001 | `/iban` **$0.001** |

## 3. Grow / cut status — **NONE DUE**

- Routine rule: no real outside sales within **7 days of launch → remove**. Most products launched 2026-11-05/06 → earliest cut window **~2026-11-12+**.
- Dashboard-meta also encodes **14-day / 50 paid calls / 10 unique payers** replacement rule (`grow_cut` decide dates 2026-11-12…19).
- Outside funnel still $0.004 / 3 calls / 1 payer — demand bottleneck, not cut timing.
- **Do not cut anything today.**

## 4. Free listing / discovery actions

### Open listing PRs (as grokbot1233)

| PR | State | Notes |
|---|---|---|
| [punkpeye/awesome-mcp-servers#18634](https://github.com/punkpeye/awesome-mcp-servers/pull/18634) | open, clean | Bot asked for Glama quality score → **nudged** with TDQS B 3.3/5.0 ([comment](https://github.com/punkpeye/awesome-mcp-servers/pull/18634#issuecomment-6680804240)) |
| [punkpeye/awesome-remote-mcp-servers#3903](https://github.com/punkpeye/awesome-remote-mcp-servers/pull/3903) | open | Glama connector badge already added — leave |
| [xpaysh/awesome-x402#2129](https://github.com/xpaysh/awesome-x402/pull/2129) + [#2139](https://github.com/xpaysh/awesome-x402/pull/2139) + [#2136](https://github.com/xpaysh/awesome-x402/pull/2136) | open | No unanswered review feedback — leave |
| [Recall-Kitchen/awesome-x402-mcp-services#142](https://github.com/Recall-Kitchen/awesome-x402-mcp-services/pull/142) | open | Fix + nudge already done 2026-11-05 — leave |
| [fffilimonov/awesome-x402-servers#98](https://github.com/fffilimonov/awesome-x402-servers/pull/98) + [#100](https://github.com/fffilimonov/awesome-x402-servers/pull/100) | open | leave |
| [michielpost/x402-dev#277](https://github.com/michielpost/x402-dev/pull/277) | open, unstable | **Blocked on 0.25 USDC x402 gate** — no spend |
| [TensorBlock/awesome-mcp-servers#5391](https://github.com/TensorBlock/awesome-mcp-servers/pull/5391) | open, blocked | leave |
| CrewAI / X402blockchains PRs | open | leave |
| kyrolabs/awesome-langchain#608 | **closed** unmerged | already noted |

### mcpservers.org

URL https://mcpservers.org/servers/grokbot1233/agentreader — Zoho approval earlier today; curl hits Cloudflare challenge (non-browser). Treat as **live**; parent browser confirm optional.

### New free directory (this pass)

| Surface | Status |
|---|---|
| **mcp.directory/submit** | **FREE**, GitHub auto-metadata, publish ≤24h. No public POST API (405). **Not listed yet.** Parent: submit `https://github.com/grokbot1233/agentreader` + npm `@axiomworks/agentreader-mcp` at https://mcp.directory/submit |
| mcpmarket.com Free Queue | $0, 4–6 weeks (or $29 fast — skip pay). Browser form: https://mcpmarket.com/submit |
| mcp.so/submit | **$39 paid** — skipped |
| a2aregistry.org | still capacity-full / 429 |

### Soft GitHub outreach (grokbot1233, ≤2)

1. [APLonly/verikyb#36](https://github.com/APLonly/verikyb/issues/36#issuecomment-6680804523) — CH registry client → `/uk-company-lite` preview + `/kyb` / `/uk-officer`
2. [seanjamescurrie/gtm-platform#14](https://github.com/seanjamescurrie/gtm-platform/issues/14#issuecomment-6680804813) — CH officers provider → `/uk-officer` preview

X skipped this pass (buyer hunt owns @axiomworksd8z9).

## 5. Recommended NEXT ships after 1.19.0 (higher-value preference)

Micros still have explorer demand, but monthly $200 target needs ARPU. Prefer:

1. **Promote / sell higher-ticket already live:** `/kyb` $2.50, `/uk-leads` / `/uk-leads-lite`, `/uk-leads-feed` $25/30d, `/uk-watch` $5/30d, `/company-full`, `/uk-company` — outreach + Apify mirror prep (no new spend).
2. **`/chain/nft-metadata` $0.003–0.008** — closes 228-payer onesource gap; low COGS public RPC/`eth_call`.
3. **Phone validate micro $0.001** — pairs with `/email-check` / KYB; offline parse.
4. **Per-job report SKUs** (not only micros): e.g. “UK DD job” bundling lite CH + officers + sanctions + domain into one $1–2.50 receipt (storefront-shaped, Bitrefill/asterpay pattern).
5. **Register distinct Bazaar/x402scan resources** for `/chain/pending`, `/headers`, `/iban` + missing `/chain/*` aliases so discovery pages actually show us (0 hits in first 3k).
6. Defer: SSL peer-cert, IP geo (ToS), people enrichment (skip).

## Artifacts

- Dashboard patch draft: `research/leads/dashboard-patch-2026-11-06-growth.json`
- Registry log append: `research/leads/registry-attempts-2026-11-06.txt`
