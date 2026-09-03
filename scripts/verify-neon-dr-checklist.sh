#!/usr/bin/env bash
# Non-destructive Neon DR checklist (R1). Does not create PITR branches.
# Quarterly restore drill remains a console/API operation — see docs/operations/DISASTER_RECOVERY.md
#
# Optional evidence:
#   FORGE_DR_EVIDENCE_FILE=docs/operations/evidence/neon-dr-checklist-YYYYMMDD.txt npm run verify:neon-dr
set -euo pipefail

EVIDENCE_FILE="${FORGE_DR_EVIDENCE_FILE:-}"
LAST_DRILL="2026-07-22"
NEXT_DUE="2026-10-22"

checklist() {
  echo "FORGE Neon DR checklist (2026-09-03)"
  echo "Last logged restore drill: $LAST_DRILL  |  Next due: $NEXT_DUE"
  echo
  echo "1. Confirm PITR enabled (Neon console → Backup). Retention target: 24h."
  echo "2. Confirm production uses a pooled DATABASE_URL (*-pooler*)."
  echo "3. Quarterly drill: branch from PITR timestamp → point staging → npm run smoke:api → delete branch."
  echo "4. Optional connectivity check (requires DATABASE_URL + psql):"
  echo "     DATABASE_URL=... npm run verify:neon-dr"
  echo "     DATABASE_URL=... bash scripts/dr-db-verify.sh"
  echo "5. After drill: append a row to docs/operations/DISASTER_RECOVERY.md restore drill log."
  echo
}

checklist

LIVE_STATUS="skipped"
if [[ -n "${DATABASE_URL:-}" ]]; then
  if command -v psql >/dev/null 2>&1; then
    LIVE_STATUS="ok"
    bash "$(dirname "$0")/dr-db-verify.sh" || LIVE_STATUS="failed"
  else
    echo "DATABASE_URL is set but psql is not installed; skip live verify."
    LIVE_STATUS="no_psql"
  fi
else
  echo "DATABASE_URL unset — checklist only (exit 0)."
fi

if [[ -n "$EVIDENCE_FILE" ]]; then
  mkdir -p "$(dirname "$EVIDENCE_FILE")"
  {
    echo "# FORGE Neon DR checklist evidence"
    echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "last_logged_drill: $LAST_DRILL"
    echo "next_due: $NEXT_DUE"
    echo "live_connectivity: $LIVE_STATUS"
    echo "database_url_set: $([[ -n "${DATABASE_URL:-}" ]] && echo yes || echo no)"
    echo
    checklist
    echo "Operator sign-off:"
    echo "  name: _______________"
    echo "  notes: _______________"
  } >"$EVIDENCE_FILE"
  echo "Wrote evidence → $EVIDENCE_FILE"
fi

if [[ "$LIVE_STATUS" == "failed" ]]; then
  exit 1
fi
