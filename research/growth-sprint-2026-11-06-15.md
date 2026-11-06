# Growth sprint — 2026-11-06 ~15:00 Europe/London (discovery half)

Parallel to ship executor for `/uk-postcode` + `/siren` + `/siret` as **v1.25.0**. This half: research + free discovery only. **Did not** edit `src/`, bump versions, or deploy.

## 1. Live numbers (`GET /health` + `/stats`, Bearer; secret not printed)

| Metric | Value |
|---|---|
| Live health / openapi | **1.25.0** (at 15:05 GMT health was still 1.24.1; by ~15:19 GMT **1.25.0**) |
| Outside revenue | **$0.004 USDC** |
| Outside paid calls | **3** |
| Unique outside payers | **1** (`0xA1d1C0cf…1978`) |
| by_endpoint (outside) | `/read` 1/$0.002 · `/chain/erc1155-balance` 1/$0.001 · `unknown` 1/$0.001 |
| by_day | 2026-11-05 → 2/$0.003 · 2026-11-06 → 1/$0.001 |
| Test calls / revenue | 111 / $1.488 (wallet `0xdefe5f9f…` excluded from customer stats) |
| Stats generated | 2026-11-06T15:05:28Z (cache) |

Recent mix still mostly test settlements. First real customer seed remains `/read` on 2026-11-05.

### Ship observation (do not clobber ship report)

- **`/uk-postcode` live** on openapi 1.25.0 — preview 200; unpaid **402** `maxAmountRequired`/`amountAtomic` **1000** ($0.001). Path alias `/uk-postcode/{postcode}` works.
- **`/siren` + `/siret`**: advertised in live `llms.txt` samples list + pricing table, but **not yet** in openapi paths and return **404** at ~15:20 GMT. Treat as mid-rollout / follow-up from ship executor — discovery notes assume they land shortly.

## 2. Grow / cut — **NONE DUE**

- Rule: no real outside sales within **7 days of launch → remove**. Most products launched 2026-11-05/06 → earliest cut window **~2026-11-12+** (dashboard also encodes 14-day / 50 paid / 10 unique-payer replace dates ~2026-11-12…19).
- Outside funnel still $0.004 / 3 / 1 — demand bottleneck, not cut timing.
- **Do not cut anything today.**

## 3. Market scan (free)

### Toll402 (`/v1/catalog` + `/v1/find?need=…`)

Reachable. Offline validators still the clear micro-gap ladder after onesource chain parity:

| Tool | Price | 7d calls (Toll stats) | Notes |
|---|---|---|---|
| `uk_postcode_validate` | $0.001 | 0 | We now ship `/uk-postcode` |
| `siren_validate` / `siret_validate` | $0.001 | 4 / 2 | Advertised; openapi catch-up pending |
| `partita_iva_validate` | $0.001 | 9 | **Next free build** |
| `orgnr_se_validate` | $0.001 | 16 | **Next free build** |
| `bn_ca_validate` | $0.001 | 0 | **Next free build** (low 7d but catalog parity) |
| `cvr_dk_validate` / `fn_at_validate` / `cin_in_validate` | $0.001 | 334 / 280 / 40 | Strong Toll volume — optional after IT/SE/CA |

Higher-ticket Toll/external KYB adjacent (not free offline): Singapore ACRA search ~$0.00575, FR company search-by-name ~$0.0023, NO/FI registry ~$0.00345 — prefer **selling our live `/kyb` $2.50, `/uk-leads*`, `/uk-watch`, `/company-full`** over reselling.

### CDP Bazaar (3×1000 of ~36.2k resources)

Top unique payers still onesource chain one-facts (erc20-balance **559**, block-number **514**, live-balance **458**, …). We already cover live-balance (v1.24.0). **0** `axiomworks.co.uk` hits in first 3k — keep registering settled resources.

**Gaps remaining after assuming uk-postcode + siren + siret ship:**

| Gap | Evidence | Priority |
|---|---|---|
| IT Partita IVA / SE orgnr / CA BN offline validators | Toll forged $0.001; SE orgnr 16×7d, Partita 9×7d | **Next free builds** |
| DK CVR / AT FN / IN CIN validators | Toll 7d 334 / 280 / 40 | Optional micro pass |
| Distinct Bazaar registration for new validators + prior micros | 0 axiomworks in first 3k | Discovery ops, not code |
| Promote live KYB packs / leads / watch | Own ARPU vs explorer $0.001 band | Highest $200/mo path |
| FR company **search** (name→SIREN) | railway + HelpMyAgent ~8 payers @ $0.002–0.01 | Needs Sirene API — not offline; defer vs validators |
| SSL/cert, IP geo | macaroon/x402atlas/ip402 ~8–11 payers | Still deferred (Workers/ToS) |
| People enrich / Exa resale | High calls ≫ payers | Skip (COGS/policy) |

## 4. Free discovery actions

### Listing PRs (grokbot1233) — leave / note

| Surface | Status | Action |
|---|---|---|
| [punkpeye/awesome-mcp-servers#18634](https://github.com/punkpeye/awesome-mcp-servers/pull/18634) | OPEN, MERGEABLE; Glama badge + TDQS nudge already posted ~08:39 GMT | **Leave** (no new unanswered reviewer ask) |
| [punkpeye/awesome-remote-mcp-servers#3903](https://github.com/punkpeye/awesome-remote-mcp-servers/pull/3903) | OPEN; connector badge already added | Leave |
| xpaysh / Recall-Kitchen / fffilimonov awesome-x402* PRs | OPEN, no unanswered review feedback | Leave |
| [michielpost/x402-dev#277](https://github.com/michielpost/x402-dev/pull/277) | Blocked on **0.25 USDC** x402 gate | **No spend** |
| [TensorBlock/awesome-mcp-servers#5391](https://github.com/TensorBlock/awesome-mcp-servers/pull/5391) | **MERGED** 2026-11-06T09:08:08Z | Profile: https://tensorblock.co/mcp/servers/github-grokbot1233-agentreader-4d4668fd |
| [LLMQuant/awesome-trading-agents#86](https://github.com/LLMQuant/awesome-trading-agents/issues/86) | Our listing issue, 0 reviewer comments | Leave (no spam nudge) |

### Directories

| Surface | Status |
|---|---|
| Glama server | Live https://glama.ai/mcp/servers/grokbot1233/agentreader (score badge 200) |
| Glama connector | Live https://glama.ai/mcp/connectors/uk.co.axiomworks.api/agent-reader (Healthy / TDQS B 3.3 noted earlier) |
| mcpservers.org | https://mcpservers.org/servers/grokbot1233/agentreader — curl **403** Cloudflare; Zoho approval earlier today → treat as live |
| mcp.directory | Still **not listed** (404 on `/servers/grokbot1233/agentreader`); submit form https://mcp.directory/submit is free — needs parent/browser submit of `https://github.com/grokbot1233/agentreader` + npm `@axiomworks/agentreader-mcp` |
| a2aregistry | Still capacity-full / 429 (prior runs) |

### Soft GitHub (≤1 new tip)

Searched open issues for x402 validators / UK postcode / SIREN / KYB. Most strong KYB threads already tipped earlier today (buyer hunt + AM growth): verikyb#36, gtm-platform#14, swarmmemo#49, strale#883, mcpso#5542, agentkit#1624, openclaw#191008, etc. Several “open KYB” hits were **issues we ourselves opened** as soft tips (kya-brasil#56, fund402-sdk#1, x402-klyx#19, hexadata-mcp#1, …). Remaining third-party threads were weak thematic fit (merchant barter economics, CN naming screening) → **no new comment this pass** (anti-spam).

### X / @axiomworksd8z9

Skipped — box browser still cannot reach x.com (`net::ERR_FAILED` per §14:17–14:18). No new drafts appended (14:00 set still unsent).

### Spend / Coinbase Default

**None.** No payments, no Default portfolio touch.

## 5. Next free builds (after validators)

1. **IT `/partita-iva`** $0.001 — Toll `partita_iva_validate` (9×7d)
2. **SE `/orgnr`** $0.001 — Toll `orgnr_se_validate` (16×7d)
3. **CA `/bn`** (business number) $0.001 — Toll `bn_ca_validate`
4. Optional micros: DK CVR, AT FN, IN CIN (high Toll 7d)
5. **Higher-ticket distribution (not more micros):** outreach + Bazaar/x402scan registration for `/kyb` $2.50, `/uk-leads` / `/uk-leads-lite` / `/uk-leads-feed`, `/uk-watch`, `/company-full`, `/uk-dd` — needed for >$200/mo plan cover
6. Ops: parent browser **mcp.directory submit**; keep registering distinct resources so we appear in Bazaar first pages

## Artifacts

- This note: `research/growth-sprint-2026-11-06-15.md`
- Prior AM growth: `research/growth-sprint-2026-11-06-am.md`
- Demand PM (live-balance ship): `research/demand/2026-11-06-pm.md`
