#!/usr/bin/env bash
# Scheduled entrypoint: scan for buyer signals, refresh free registry listings, commit results.
set -euo pipefail
cd "$(dirname "$0")/../.."
git pull --rebase -q
python3 scripts/outbound/scan.py "$@"
bash scripts/outbound/register.sh || true
git add research/leads && git commit -qm "chore(leads): daily buyer-signal scan $(date +%F)" || exit 0
git pull --rebase -q && git push -q origin HEAD:main
