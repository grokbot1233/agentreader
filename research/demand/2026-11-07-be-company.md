# Ship note — /be-company v1.38.0

- **Endpoint:** `/be-company` **$0.25** (maxAmountRequired **250000**)
- **Source:** CBE/KBO Public Search HTML (FPS Economy) — free, no key
- **Inputs:** `enterprise_number` / `be` / `bce` / `kbo` / `vat` (10-digit mod-97) or `name` (phonetic; may 503 if CBE blocks)
- **Wires:** `/kyb` (`enterprise_number=`/`be=`), `/registry-batch` (`be=`), `/company-full` soft-attach (`.be` / enterprise number / BE keywords)
- **Commits:** `57d197f` (feat) + `153336f` (version strings)
- **Deploy:** `0f2d3697-e6fd-4af0-ba8a-7c18c8eb6a41` (health 1.38.0)
- **npm:** `@axiomworks/agentreader@1.38.0` + `@axiomworks/agentreader-mcp@1.38.0`
- **x402scan:** `/be-company` resource id `01201ace-bac0-4067-ab58-88d3e1bb04d5` (+ re-registered `/kyb`, `/registry-batch`, `/company-full`)
- **Preview proof:** Proximus `0202.239.951` → active Public limited company, Schaerbeek; BNP Paribas Fortis `0403.199.702`
- **Outreach:** https://github.com/c4seus/lacis/issues/107#issuecomment-6703836510
