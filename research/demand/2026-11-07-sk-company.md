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
- **Preview proof:** IČO `31322832` → **SLOVNAFT, a.s.**, active, Akciová spoločnosť, Bratislava, est 1992-05-01, Sa/426/B; terminated `35681039` → successors include SLOVNAFT
- **Spend:** $0
