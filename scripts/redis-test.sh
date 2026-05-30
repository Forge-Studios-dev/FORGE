#!/usr/bin/env bash
# Verify Redis connectivity (REDIS_URL from apps/api/.env).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REDIS_ENV_FILE:-$ROOT/apps/api/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

node -e "
const Redis = require('ioredis');

const url = (process.env.REDIS_URL || '').trim() || 'redis://localhost:6379';

(async () => {
  if (url.includes('localhost')) {
    console.error('ERROR: Set REDIS_URL in apps/api/.env (see apps/api/.env.redis-cloud.example)');
    process.exit(1);
  }
  console.log('Connecting:', url.replace(/:([^:@/]+)@/, ':***@'));
  const redis = new Redis(url, {
    tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: 1,
    connectTimeout: 10_000,
  });
  const pong = await redis.ping();
  console.log('OK: PING ->', pong);
  await redis.quit();
})().catch((e) => {
  console.error('Connection failed:', e.message);
  process.exit(1);
});
"

echo "Redis is reachable."
