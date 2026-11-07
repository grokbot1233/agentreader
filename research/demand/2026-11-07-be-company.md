# Ship note — /be-company v1.38.0

- **Endpoint:** `/be-company` **$0.25** (maxAmountRequired 250000)
- **Source:** CBE/KBO Public Search HTML (FPS Economy) — free, no key
- **Inputs:** `enterprise_number` / `be` / `bce` / `kbo` / `vat` (10-digit mod-97) or `name` (phonetic; may 503 if CBE blocks)
- **Wires:** `/kyb` (`enterprise_number=`/`be=`), `/registry-batch` (`be=`), `/company-full` soft-attach (`.be` / enterprise number / BE keywords)
- Preview proof: Proximus `0202.239.951` → active Public limited company, Schaerbeek; BNP Paribas Fortis `0403.199.702`
