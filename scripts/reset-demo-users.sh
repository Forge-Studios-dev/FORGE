#!/usr/bin/env bash
# Reset all demo accounts (viewer, creator, admin) to documented passwords and roles.
# Uses apps/api seed against DATABASE_URL in apps/api/.env, or local Docker Postgres.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f apps/api/.env ]] && grep -q '^DATABASE_URL=' apps/api/.env 2>/dev/null; then
  echo "==> Seeding demo users via apps/api/.env DATABASE_URL"
  npm run seed --workspace=apps/api
  echo "Done. Accounts:"
  echo "  viewer@forge.local  / ForgeDemo123!  (viewer)"
  echo "  creator@forge.local / ForgeDemo123!  (approved creator — upload & studio)"
  echo "  admin@forge.local   / ForgeAdmin123! (admin panel only)"
  exit 0
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx forge-postgres; then
  echo "==> No apps/api/.env — using Docker Postgres + API seed"
  export DATABASE_URL="${DATABASE_URL:-postgresql://forge:forge@localhost:5432/forge_db}"
  npm run seed --workspace=apps/api
  echo "Done (see accounts above)."
  exit 0
fi

echo "ERROR: Set DATABASE_URL in apps/api/.env or start forge-postgres (docker compose up -d postgres)" >&2
exit 1
