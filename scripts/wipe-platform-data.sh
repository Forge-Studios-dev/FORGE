#!/usr/bin/env bash
# Wipe all platform data: Neon Postgres, S3 media bucket, Redis cache/queues.
# Re-seeds categories + fresh demo users (viewer, creator, admin).
#
# Usage:
#   FORGE_WIPE_CONFIRM=yes bash scripts/wipe-platform-data.sh
#
# Requires apps/api/.env with DATABASE_URL, AWS_*, and REDIS_URL or UPSTASH_REDIS_REST_*.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${NEON_ENV_FILE:-$ROOT/apps/api/.env}"

if [[ "${FORGE_WIPE_CONFIRM:-}" != "yes" ]]; then
  echo "ERROR: Destructive wipe blocked."
  echo "  Run: FORGE_WIPE_CONFIRM=yes bash scripts/wipe-platform-data.sh"
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set ($ENV_FILE)"
  exit 1
fi

echo "=============================================="
echo "  FORGE platform wipe (database + S3 + Redis)"
echo "=============================================="

# --- PostgreSQL ---
echo ""
echo "[1/4] Wiping PostgreSQL data..."
node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? undefined : { rejectUnauthorized: false },
});
(async () => {
  await client.connect();
  const tables = [
    'analytics_events',
    'watch_history',
    'reports',
    'password_reset_tokens',
    'refresh_tokens',
    'notifications',
    'video_skill_tags',
    'playlist_videos',
    'likes',
    'comments',
    'follows',
    'videos',
    'streams',
    'playlists',
    'skill_tags',
    'subcategories',
    'categories',
    'users',
  ];
  const existing = await client.query(
    \"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY(\$1)\",
    [tables],
  );
  const found = existing.rows.map((r) => r.tablename);
  if (!found.length) {
    console.log('No tables to truncate');
    await client.end();
    return;
  }
  const sql = 'TRUNCATE TABLE ' + found.map((t) => '\"' + t + '\"').join(', ') + ' RESTART IDENTITY CASCADE';
  await client.query(sql);
  const counts = await client.query(
    \"SELECT (SELECT COUNT(*)::int FROM users) AS users, (SELECT COUNT(*)::int FROM videos) AS videos, (SELECT COUNT(*)::int FROM categories) AS categories\",
  );
  console.log('Truncated:', found.join(', '));
  console.log('After wipe:', counts.rows[0]);
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
"

# --- S3 ---
echo ""
echo "[2/4] Emptying S3 bucket..."
if [[ -z "${AWS_ACCESS_KEY_ID:-}" || -z "${AWS_SECRET_ACCESS_KEY:-}" || -z "${S3_BUCKET_NAME:-}" ]]; then
  echo "WARN: AWS credentials or S3_BUCKET_NAME missing — skipping S3 wipe"
else
  AWS_REGION="${AWS_REGION:-ap-south-1}"
  export AWS_DEFAULT_REGION="$AWS_REGION"
  OBJECT_COUNT="$(aws s3 ls "s3://${S3_BUCKET_NAME}/" --recursive 2>/dev/null | wc -l | tr -d ' ')"
  echo "  Bucket: ${S3_BUCKET_NAME} (${OBJECT_COUNT} objects)"
  if [[ "${OBJECT_COUNT}" != "0" ]]; then
    aws s3 rm "s3://${S3_BUCKET_NAME}/" --recursive
    echo "  OK: removed all objects"
  else
    echo "  OK: bucket already empty"
  fi
fi

# --- Redis (feed cache, video detail, BullMQ queues, rate limits) ---
echo ""
echo "[3/4] Flushing Redis..."
FORGE_FLUSH_CONFIRM=yes bash "$ROOT/scripts/flush-redis.sh"

# --- Re-seed ---
echo ""
echo "[4/4] Seeding categories + demo users..."
cd "$ROOT/apps/api"
npm run migration:run
cd "$ROOT"
npm run seed --workspace=apps/api

echo ""
echo "=============================================="
echo "  Wipe complete — fresh demo accounts"
echo "=============================================="
echo "  Viewer:  viewer@forge.local  / ForgeDemo123!"
echo "  Creator: creator@forge.local / ForgeDemo123!  (approved — upload & studio)"
echo "  Admin:   admin@forge.local   / ForgeAdmin123!"
echo ""
echo "  Web:   https://forgestudios.net"
echo "  Admin: https://admin.forgestudios.net"
echo "=============================================="
