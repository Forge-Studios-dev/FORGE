#!/usr/bin/env bash
# Flush all keys from production/staging Redis (REDIS_URL).
# Clears feed cache, video detail cache, BullMQ queues, rate-limit keys, etc.
#
# Usage:
#   bash scripts/flush-redis.sh
#   FORGE_FLUSH_CONFIRM=yes bash scripts/flush-redis.sh   # required for non-local Redis
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

(async () => {
  const url = (process.env.REDIS_URL || '').trim();
  if (!url) {
    console.error('ERROR: Set REDIS_URL in apps/api/.env');
    process.exit(1);
  }
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  if (!isLocal && process.env.FORGE_FLUSH_CONFIRM !== 'yes') {
    console.error('ERROR: Refusing to flush remote Redis without FORGE_FLUSH_CONFIRM=yes');
    process.exit(1);
  }

  const redis = new Redis(url, {
    tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: 1,
    connectTimeout: 15_000,
  });

  const before = await redis.dbsize();
  console.log('Keys before flush:', before);

  const prefixes = ['feed:', 'feed:v3:', 'video:detail:', 'bull:', 'video-processing'];
  for (const prefix of prefixes) {
    let cursor = '0';
    let n = 0;
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', prefix + '*', 'COUNT', 500);
      cursor = next;
      if (keys.length) {
        n += await redis.del(...keys);
      }
    } while (cursor !== '0');
    if (n > 0) console.log('  Deleted', prefix + '*:', n);
  }

  await redis.flushall();
  const after = await redis.dbsize();
  console.log('FLUSHALL done. Keys after:', after);

  const info = await redis.info('keyspace');
  const dbLine = info.split('\\n').find((l) => l.startsWith('db'));
  if (dbLine) console.log('Keyspace:', dbLine.trim());

  await redis.quit();
  if (after !== 0) {
    console.error('WARN: Redis still has keys after flush');
    process.exit(1);
  }
  console.log('OK: Redis is empty');
})().catch((e) => {
  console.error('Flush failed:', e.message);
  process.exit(1);
});
"
