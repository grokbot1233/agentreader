# Growth sprint — late 2026-11-05 (v1.13.0)

## Market
- Outside revenue still **$0.003 / 2 payers / 2 calls**. Onesource-style chain lookups still dominate payers.
- GLEIF LEI niche is **crowded on Bazaar** (≥8 wrappers: agent402.tools $0.005, nordata $0.003, pennydata $0.005, saylor $0.01, …). Several already return direct+ultimate parents at $0.005 — a thin LEI-only wrapper loses.
- Differentiation for us: ship parents on every `/lei`, expose multi-match `/lei-full`, wire into KYB + MCP + SDK, and sell batch web read from our own `/read` stack (free COGS).

## Shipped (v1.13.0)
| Path | Price | Atomic | Notes |
|---|---|---|---|
| `/lei` | $0.005 | 5000 | GLEIF CC0; **always** `parents.direct` + `parents.ultimate` (null if 404/unreported); BIC/mapped ids; soft-cache 24h; alias `/lei/{lei}`; preview=1 |
| `/lei-full` | $0.05 | 50000 | Name/registered_as search ≤10 candidates each with parents (bulk screening) |
| `/read-batch` | $0.015 | 15000 | Up to 8 URLs, concurrency 4, ~8s timeout, markdown capped; GET+POST; preview first 2 |
| `/kyb` | $2.50 (unchanged) | — | Optional `lei` attaches full `/lei`-shaped record (soft-fail on GLEIF miss) |

## Grow/cut
All products <7 days from launch → **N/A / do not cut**. Sanctions decide ~2026-11-12 if listed; AU/CA/officer/registry-batch grow/cut 2026-11-19.

## Next
- Keep Apify public publish 6 Nov; NZBN retry; discovery forms.
- Outside revenue still $0.003 — keep buyer hunt + path aliases discovery.
