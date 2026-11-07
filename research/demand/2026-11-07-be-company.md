# Ship note — /be-company v1.38.0

- **Endpoint:** `/be-company` **$0.25** (maxAmountRequired **250000**)
- **Source:** CBE/KBO Public Search HTML (FPS Economy) — free, no key
- **Inputs:** `enterprise_number` / `be` / `bce` / `kbo` / `vat` (10-digit mod-97) or `name` (phonetic; may 503 if CBE blocks)
- **Wires:** `/kyb` (`enterprise_number=`/`be=`), `/registry-batch` (`be=`), `/company-full` soft-attach (`.be` / enterprise number / BE keywords)
- **Commits:** `57d197f` (feat) · `153336f` (version strings) · `299788e` (kyb/rb validators) · `0390c16` (has_be preview)
- **Deploy:** `fb2a05c8-defb-4fe9-a7b4-ad36693bd5d4` (final; health **1.38.0**)
- **npm:** `@axiomworks/agentreader@1.38.0` + `@axiomworks/agentreader-mcp@1.38.0` (registry may lag briefly on agentreader)
- **x402scan:** `/be-company` resource id `01201ace-bac0-4067-ab58-88d3e1bb04d5` (+ re-registered `/kyb`, `/registry-batch`, `/company-full`)
- **Preview proof:** Proximus `0202.239.951` → active PLC Schaerbeek; BNP Paribas Fortis `0403.199.702`; `/kyb?be=` has_be=true; `/registry-batch?be=` found PROXIMUS
- **Outreach:** https://github.com/c4seus/lacis/issues/107#issuecomment-6703836510
