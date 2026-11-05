# Bigger money plays — 2026-11-05

Mandate: profit-driven founder; expand beyond $0.001–0.005 micro-calls into $0.25–$50/job or $10–$500/mo. Brutally honest scores. Sources cited.

## Method / evidence base
- **Own funnel** (`research/revenue-2026-11-05.md`): 6.5k req/36h on api.axiomworks.co.uk; ~2k×402 mostly catalog probes; **real outside revenue $0.003**. Demand is the bottleneck, not product breadth alone.
- **CDP Bazaar** (full pull ~15:30 UTC): ~36k resources, **~748k settled calls/30d**. Price buckets by calls/payers: ≤$0.001 43k/14k · **$0.001–0.005 351k/39k** · $0.005–0.01 131k/21k · $0.01–0.05 203k/15k · **>$0.05 21k/5.6k (~3% of calls)**. Only ~91 resources on 15 hosts have ≥50 unique payers; most "payers" are one-off explorer wallets.
- **High-ticket Bazaar samples** (paginated discovery): stableenrich people-search **$0.15 / 43 payers / 780 calls**; sanctions.use.x402atlas.com **$0.21 / 1 payer**; Apify prepaid tokens $1 / 42 payers; api-xpay AI text $10–20 with explorer-shaped payers≈calls.
- **B2B off-x402**: NewcoSignal Companies API **£49/mo + VAT** (2,500 records) / Signals **£149/mo** ([newcosignal.co.uk/developers](https://www.newcosignal.co.uk/developers)); NewCo Data **£99–399/mo** daily director-enriched incorporations ([newcodata.co.uk](https://newcodata.co.uk/)); Apify UK CH feed **$1.50/1k** new cos ([apify.com/longlever/uk-companies-house-feed](https://apify.com/longlever/uk-companies-house-feed)); Apify Agentic KYB **$0.05/check** ([apify.com/gilgames/agentic-kyb](https://apify.com/gilgames/agentic-kyb)); RapidAPI KYB France from **$14.99/mo**.
- **Agent gig boards** (Jobbi 2026-11-05): 698 open gigs, **$20 median**, $46k total on offer — mostly code bounties, not data-API buyers ([jobbi.org/gigs/report](https://jobbi.org/gigs/report/)).
- **CH live probe (today)**: ~2,682 active incorporations on 2026-11-04 alone; advanced search supports `sic_codes`, `location`, `incorporated_from/to`.

Caveat: x402 volume ≠ human B2B willingness-to-pay. Bigger tickets win when sold to **repeat workflows** (sales agents, KYB agents, monitoring) or listed where **humans already buy** (Apify/RapidAPI). Explorer wallets rarely pay >$0.05 twice.

## Ranked plays (launch / propose / skip)

Scoring: 30d / 90d realistic revenue (USD), build cost (£), effort, unfair advantage, legal/ToS, **EV** (expected profit).

### 1. UK new-incorporation leads API — **LAUNCH**
Filtered Companies House new cos by SIC / location / days, optional director enrichment. x402 pay-per-query + later Apify mirror.
- **Price:** `/uk-leads-lite` **$0.25** (≤100 cos, no directors) · `/uk-leads` **$1.00** (≤40 cos + active directors + mass-formation flags).
- **30d:** $15–80 if 1–3 human/agent buyers or Apify spillover; explorer one-offs $1–5. **90d:** $150–800 if Apify listed + 2–5 recurring SIC filters.
- **Cost:** £0 (CH API free). **Effort:** M (1 day). **Advantage:** CH key + existing DD code + x402 no-account. **Legal:** public register redistribution (officer names = personal data on public register; UK GDPR still applies — disclose source, no email/phone scraping). **EV: +**

### 2. UK leads daily feed subscription — **LAUNCH**
`POST /uk-leads-feed` **$25 / 30d**: webhook each UTC morning with new matches for saved SIC/location (NewcoSignal-shaped).
- **30d:** $0–50 (1 sub max early). **90d:** $75–400 if 3–15 subs (competitor ARPU £49–149).
- **Cost:** £0. **Effort:** M (reuse monitor cron). **Advantage:** same as #1. **Legal:** same. **EV: +** (highest ARPU of our stack)

### 3. UK company watch (filing/officer/status) — **LAUNCH**
`POST /uk-watch` **$5 / 30d**: hourly CH poll → webhook on profile/officer/filing hash change.
- **30d:** $5–40. **90d:** $50–250 (agent KYB refresh loops + human ops).
- **Cost:** £0. **Effort:** M. **Advantage:** CH + existing `/monitor` cron pattern. **Legal:** low. **EV: +**

### 4. Agent KYB pack — **LAUNCH**
`/kyb` **$2.00**: one call combining website research (when domain) + UK CH full (when number/UK) + EU VIES (when VAT) + composite trust flag. No paid sanctions upstream (name-heuristic only / skip false certainty).
- **30d:** $4–40. **90d:** $40–200. Apify KYB comps $0.05–0.25/check; Creditsafe/DueDil are seat/quote (£12k/yr example CCS order) — we are screening, not credit scores.
- **Cost:** £0. **Effort:** S–M (compose existing). **Legal:** must **not** claim regulated KYC/AML determination. **EV: +**

### 5. Apify Store Actors (UK leads + KYB) — **PREPARE + OWNER SIGN-UP**
Existing buyer base; Apify takes ~20%; billing handled. RapidAPI ~25% fee, broader/noisier.
- **30d:** $0 until listed+discovered. **90d:** $50–500 if ranked (Compass-class is outlier; niche KYB Actors do low hundreds).
- **Cost:** £0 platform; payout needs KYC. **Effort:** M. **Advantage:** wrap live API. **EV: +** after signup. **Needs browser:** Apify account + payout KYC.

### 6. RapidAPI listing — **DEFER (after Apify)**
Same product, weaker fit for scrapers/automation buyers post-Nokia. Sign-up needed. EV marginal vs Apify.

### 7. Raise/promote hosted web monitors — **MINOR / already live**
`/monitor` $1/30d already ships. Traction near-zero. Don't rebuild; upsell from leads/watch. EV ~0 alone.

### 8. Screenshot / Browser Rendering — **SKIP for now**
CF Browser Run: Workers Paid includes 10 browser-hours/mo then **$0.09/browser-hour**. Need Paid plan confirmation; variable COGS. Competitors thick. EV unclear under £20 constraint without plan check → propose Workers Paid if not on it.

### 9. Enterprise API keys / USDC monthly plans — **DEFER**
Chicken-egg until repeat buyers exist; needs credit ledger + key auth alongside x402. Build after first `/uk-leads-feed` subscriber. EV ~0 this week.

### 10. Agent-to-agent bounty marketplace — **SKIP**
Custody/escrow of others' funds ≈ regulated; Jobbi shows supply of gigs not demand for our data. Effort XL. EV ~0 / legal risk.

### 11. People enrichment / LinkedIn-adjacent — **SKIP**
stableenrich proves some x402 willingness ($0.15) but ToS/scraping risk. Forbidden by mandate.

### 12. Paid directory featured listings — **PROPOSE**
x402scan / x402-list promos unknown £20–100 → **owner approval**.

## Honest top-line
x402 alone will not print $500/mo from explorer bots at $1–25 tickets. The **profit path** is: (a) ship B2B-shaped UK registry products agents *and* humans can buy via x402 now; (b) mirror onto Apify where humans already pay; (c) kill anything with <50 paid calls / <10 unique payers in 14 days per dashboard rule.

## Launch order today
1. `/uk-leads-lite` + `/uk-leads` → 2. `/uk-leads-feed` → 3. `/uk-watch` → 4. `/kyb` → 5. Apify Actor stubs + signup list → dashboard/x402scan/MCP/npm meta.
