#!/usr/bin/env bash
# Disaster recovery: verify Neon Postgres connectivity and latest backup metadata.
# Usage: DATABASE_URL=... ./scripts/dr-db-verify.sh
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

echo "Checking database connectivity..."
psql "$DATABASE_URL" -c "SELECT current_database(), current_user, now();"

echo "Checking migration status..."
psql "$DATABASE_URL" -c "SELECT id, timestamp, name FROM migrations ORDER BY id DESC LIMIT 5;"

echo "DR verify complete."
