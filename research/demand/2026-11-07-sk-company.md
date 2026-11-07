# Ship note — /sk-company v1.39.0

- **Endpoint:** `/sk-company` **$0.25** (maxAmountRequired **250000**)
- **Source:** RPO JSON API (`api.statistics.sk/rpo/v1`) — free, CC-BY 4.0, no key
- **Inputs:** `ico` / `identifier` / `sk` / `ico_sk` / `rpo` / `number` (8-digit IČO) or `name` / `q`
- **API facts (confirmed 2026-11-07):**
  - Search by IČO: `GET .../search?identifier=31322832` (param `ico=` returns 400)
  - Search by name: `?fullName=Slovnaft`
  - Detail: `GET .../entity/{id}` (e.g. 1003617 for SLOVNAFT a.s.)
  - Entity sometimes returns empty `fullNames`/`addresses` while search hit has them → **merge search + entity**
- **Wires:** `/kyb` (`sk=` / `ico_sk=` / `rpo=` — does **not** steal CZ `ico=`), `/registry-batch` (`sk=`), `/company-full` soft-attach (`.sk` / Slovak IČO / SK keywords)
- **Commit:** `2837b8c`
- **Deploy:** `58327700-8139-4e33-9a9f-20dcdaebc74d` (health **1.39.0**)
- **npm:** `@axiomworks/agentreader@1.39.0` + `@axiomworks/agentreader-mcp@1.39.0`
- **x402scan:** `/sk-company` resource id `979ff652-6652-4d71-b069-37019dd7af02` (+ re-registered `/kyb`, `/registry-batch`, `/company-full`)
- **Preview proof:** IČO `31322832` → **SLOVNAFT, a.s.**, active, Akciová spoločnosť, Bratislava, Sa/426/B; `/registry-batch?sk=31322832&preview=1` found; free empty `ico=` → 400 before pay; bare GET → 402 maxAmountRequired 250000
- **Spend:** $0
