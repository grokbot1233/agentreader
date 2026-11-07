# Demand note — /cz-company v1.37.0 (2026-11-07 ~05:10 Europe/London)

Shipped **`/cz-company` $0.25** — Czech ARES REST (`ares.gov.cz/ekonomicke-subjekty-v-be/rest`) by IČO or name. Free official JSON, no key (500/min). Soft-attaches VR capital/court file when paid.

## Why not SE / BE / EE
- **SE Bolagsverket**: still needs Liam Kundanmälan portal.
- **BE KBO**: public HTML flaky / anti-bot; open-data needs signup.
- **EE äriregister**: open-data API needs username/password.

## Evidence
- Fixture `ico=27082440` → Alza.cz a.s., active, Praha, JSC
- Fixture `name=Seznam.cz, a.s.` → 26168685
- Fixture `ico=45274649` → ČEZ, a. s. + capital ~53.8B CZK, court MSPH B 1581
- Wired: `/kyb` (ico=/cz=), `/registry-batch` (cz=), `/company-full` soft-attach on .cz / IČO / Czech keywords

## Ranking impact
CZ ARES was the highest-value free registry after CH/PL. Next free: BE KBO (if HTML stabilises or Liam open-data signup), EE (Liam credentials), SE (Liam portal).
