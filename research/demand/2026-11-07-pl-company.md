# Demand note — /pl-company v1.36.0 (2026-11-07 ~03:05 Europe/London)

Shipped **`/pl-company` $0.25** — Polish National Court Register (KRS) current extract via free official JSON (`api-krs.ms.gov.pl/api/krs/OdpisAktualny/{krs}?s=A|B`) plus NIP→KRS via MF VAT whitelist (`wl-api.mf.gov.pl`).

## Evidence
- Fixture `krs=0000001538` → BANK HANDLOWY W WARSZAWIE SPÓŁKA AKCYJNA, NIP 5260300291
- Fixture `nip=5260300291` → same via MF → KRS hop
- No free-text name search (MF name search 404); document krs or nip required
- Wired: `/kyb` (krs=/nip=/pl=), `/registry-batch` (pl=), `/company-full` soft-attach on KRS/NIP/.pl signals

## Ranking impact
PL was #1 unbuilt free big-hitter after CH. Next free candidates: **BE KBO** probe, **EE** JSON hop; **SE Bolagsverket** still blocked (Liam portal).

## Non-goals
No new micro validators; `/nip-pl` stays micro unlisted.
