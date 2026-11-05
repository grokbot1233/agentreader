#!/usr/bin/env bash
# Usage: scripts/update-dashboard-meta.sh meta.json   (merges top-level keys: listings, next_steps, checklist, rule)
set -euo pipefail; cd "$(dirname "$0")/.."
curl -sS -X POST "https://api.axiomworks.co.uk/admin/dashboard-meta" -H "authorization: Bearer $(cat .dashboard_key)" -H content-type:application/json --data-binary @"${1:-dashboard-meta.json}"
