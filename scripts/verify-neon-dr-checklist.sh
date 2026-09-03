#!/usr/bin/env bash
# Non-destructive Neon DR checklist (R1). Does not create PITR branches.
# Quarterly restore drill remains a console/API operation — see docs/operations/DISASTER_RECOVERY.md
set -euo pipefail

echo "FORGE Neon DR checklist (2026-09-03)"
echo "Last logged restore drill: 2026-07-22  |  Next due: 2026-10-22"
echo
echo "1. Confirm PITR enabled (Neon console → Backup). Retention target: 24h."
echo "2. Confirm production uses a pooled DATABASE_URL (*-pooler*)."
echo "3. Quarterly drill: branch from PITR timestamp → point staging → npm run smoke:api → delete branch."
echo "4. Optional connectivity check (requires DATABASE_URL + psql):"
echo "     DATABASE_URL=... npm run verify:neon-dr   # this script"
echo "     DATABASE_URL=... bash scripts/dr-db-verify.sh"
echo

if [[ -n "${DATABASE_URL:-}" ]]; then
  if command -v psql >/dev/null 2>&1; then
    exec bash "$(dirname "$0")/dr-db-verify.sh"
  else
    echo "DATABASE_URL is set but psql is not installed; skip live verify."
  fi
else
  echo "DATABASE_URL unset — checklist only (exit 0)."
fi
