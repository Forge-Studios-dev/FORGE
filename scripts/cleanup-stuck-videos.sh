#!/usr/bin/env bash
# Remove ghost uploading / stuck processing rows from Neon (and optional S3 cleanup via API after deploy).
#
# Usage:
#   FORGE_CLEANUP_CONFIRM=yes bash scripts/cleanup-stuck-videos.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${NEON_ENV_FILE:-$ROOT/apps/api/.env}"

if [[ "${FORGE_CLEANUP_CONFIRM:-}" != "yes" ]]; then
  echo "ERROR: Destructive cleanup blocked."
  echo "  Run: FORGE_CLEANUP_CONFIRM=yes bash scripts/cleanup-stuck-videos.sh"
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set (apps/api/.env)"
  exit 1
fi

# Same production-marker convention as wipe-platform-data.sh — this only
# deletes rows older than the stuck-age threshold below, but it's still a
# real DELETE against whatever DATABASE_URL points at.
if [[ "$DATABASE_URL" == *"neon.tech"* || "$DATABASE_URL" == *"forgestudios.net"* || "$DATABASE_URL" == *"production"* ]]; then
  if [[ "${FORGE_CLEANUP_ALLOW_PRODUCTION:-}" != "yes" ]]; then
    echo "ERROR: DATABASE_URL looks like production."
    echo "  To override: FORGE_CLEANUP_ALLOW_PRODUCTION=yes FORGE_CLEANUP_CONFIRM=yes ..."
    exit 1
  fi
fi

echo "==> Cleaning stuck videos in database"
npm exec --workspace=apps/api -- node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const before = await client.query(
    \"SELECT status, COUNT(*)::int AS n FROM videos WHERE status IN ('uploading','processing','failed','pending') GROUP BY status\"
  );
  console.log('Before (all stuck-status rows, any age):', before.rows);

  // Only rows that have been stuck for a while — a video that started
  // uploading seconds ago is not 'stuck', it's mid-upload.
  const del = await client.query(
    \"DELETE FROM videos WHERE status IN ('uploading','processing','failed','pending') AND updated_at < now() - interval '2 hours' RETURNING id, status, title\"
  );
  console.log('Deleted (stuck for 2h+)', del.rowCount, 'rows');
  if (del.rowCount > 0 && del.rowCount <= 30) {
    del.rows.forEach((r) => console.log(' -', r.status, r.title, r.id));
  }

  const after = await client.query('SELECT COUNT(*)::int AS n FROM videos');
  console.log('Remaining videos:', after.rows[0].n);
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
"

if [[ -n "${REDIS_URL:-}" ]]; then
  echo "==> Clearing video detail cache keys in Redis"
  node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
(async () => {
  let cursor = '0';
  let removed = 0;
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'video:detail:*', 'COUNT', 200);
    cursor = next;
    if (keys.length) {
      removed += await redis.del(...keys);
    }
  } while (cursor !== '0');
  console.log('Removed cache keys:', removed);
  await redis.quit();
})().catch((e) => { console.error(e); process.exit(1); });
"
else
  echo "SKIP: REDIS_URL not set — Redis cache not cleared"
fi

echo "OK: cleanup done. For S3 CORS run ./scripts/fix-s3-cors.sh with admin AWS creds."
