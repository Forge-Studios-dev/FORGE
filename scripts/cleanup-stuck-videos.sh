#!/usr/bin/env bash
# Remove ghost uploading / stuck processing rows from Neon (and optional S3 cleanup via API after deploy).
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
  echo "ERROR: DATABASE_URL not set (apps/api/.env)"
  exit 1
fi

echo "==> Cleaning stuck videos in database"
NODE_PATH="${ROOT}/apps/api/node_modules:${ROOT}/node_modules" node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const before = await client.query(
    \"SELECT status, COUNT(*)::int AS n FROM videos WHERE status IN ('uploading','processing','failed','pending') GROUP BY status\"
  );
  console.log('Before:', before.rows);

  const del = await client.query(
    \"DELETE FROM videos WHERE status IN ('uploading','processing','failed','pending') RETURNING id, status, title\"
  );
  console.log('Deleted', del.rowCount, 'rows');
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
