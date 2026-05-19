#!/usr/bin/env bash
# Verify Upstash Redis connectivity (uses REDIS_URL or UPSTASH_REDIS_REST_* from apps/api/.env).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${UPSTASH_ENV_FILE:-$ROOT/apps/api/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

node -e "
const Redis = require('ioredis');

function resolveRedisUrl() {
  if (process.env.REDIS_URL?.trim()) return process.env.REDIS_URL.trim();
  const restUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!restUrl || !token) return 'redis://localhost:6379';
  const host = new URL(restUrl).hostname;
  return 'rediss://default:' + encodeURIComponent(token) + '@' + host + ':6379';
}

(async () => {
  const url = resolveRedisUrl();
  if (url.includes('localhost')) {
    console.error('ERROR: Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in apps/api/.env');
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

echo "Upstash Redis is reachable."
