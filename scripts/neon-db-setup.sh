#!/usr/bin/env bash
# Apply migrations + seed demo data against Neon (or any remote DATABASE_URL).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${NEON_ENV_FILE:-$ROOT/apps/api/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "  1. Open https://console.neon.tech → your project → Connect"
  echo "  2. Copy the **Pooled connection** string"
  echo "  3. Paste into apps/api/.env as DATABASE_URL=postgresql://...?sslmode=require"
  echo "  Or: cp apps/api/.env.neon.example apps/api/.env and edit"
  exit 1
fi

if [[ "$DATABASE_URL" != *neon.tech* ]] && [[ "$DATABASE_URL" != *neon.database* ]]; then
  echo "WARN: DATABASE_URL does not look like Neon. Continuing anyway..."
fi

if [[ "$DATABASE_URL" != *sslmode=* ]]; then
  echo "WARN: Add ?sslmode=require to your Neon connection string."
fi

if [[ "$DATABASE_URL" == *localhost* ]]; then
  echo "ERROR: DATABASE_URL still points to localhost. Paste your Neon string from the console."
  exit 1
fi

echo "==> Testing Neon connection"
node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
client.connect()
  .then(() => client.query('SELECT version()'))
  .then((r) => { console.log('OK:', r.rows[0].version.split(' ').slice(0,2).join(' ')); return client.end(); })
  .catch((e) => { console.error('Connection failed:', e.message); process.exit(1); });
"

echo "==> Running migrations"
cd "$ROOT/apps/api"
npm run migration:run

echo "==> Seeding categories + demo users"
cd "$ROOT"
npm run seed --workspace=apps/api

echo ""
echo "Neon is ready. Start API: npm run dev:api"
echo "Demo: viewer@forge.local / ForgeDemo123!  admin@forge.local / ForgeAdmin123!"
