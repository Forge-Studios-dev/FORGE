#!/usr/bin/env bash
# Disaster recovery: verify Neon Postgres connectivity and latest backup metadata.
# Usage: DATABASE_URL=... ./scripts/dr-db-verify.sh
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

# Pass the password via PGPASSWORD (not embedded in the connection string) —
# the full URI as a psql argv would put the live password in `ps aux` output
# for any other local user while this runs.
eval "$(python3 - "$DATABASE_URL" <<'PY'
import sys
from urllib.parse import urlparse, unquote

u = urlparse(sys.argv[1])
def esc(s): return "'" + s.replace("'", "'\\''") + "'"
print(f"export PGHOST={esc(u.hostname or '')}")
print(f"export PGPORT={esc(str(u.port or 5432))}")
print(f"export PGUSER={esc(unquote(u.username or ''))}")
print(f"export PGPASSWORD={esc(unquote(u.password or ''))}")
print(f"export PGDATABASE={esc((u.path or '/').lstrip('/'))}")
sslmode = 'require'
if u.query:
    for part in u.query.split('&'):
        if part.startswith('sslmode='):
            sslmode = part.split('=', 1)[1]
print(f"export PGSSLMODE={esc(sslmode)}")
PY
)"

echo "Checking database connectivity..."
psql -c "SELECT current_database(), current_user, now();"

echo "Checking migration status..."
psql -c "SELECT id, timestamp, name FROM migrations ORDER BY id DESC LIMIT 5;"

echo "DR verify complete."
