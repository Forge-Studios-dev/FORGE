#!/usr/bin/env bash
# Reset local demo accounts to documented roles (viewer=user, admin=admin).
# Requires forge-postgres container from docker compose.
set -euo pipefail

docker exec forge-postgres psql -U forge -d forge_db -v ON_ERROR_STOP=1 <<'SQL'
UPDATE users SET
  role = 'user',
  creator_status = NULL,
  creator_requested_at = NULL,
  creator_reviewed_at = NULL,
  creator_review_note = NULL,
  is_verified = true
WHERE email = 'viewer@forge.local';

UPDATE users SET
  role = 'admin',
  creator_status = NULL,
  is_verified = true
WHERE email = 'admin@forge.local';
SQL

echo "Demo users reset. viewer@forge.local → user, admin@forge.local → admin."
