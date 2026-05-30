# Redis — FORGE production (Redis Cloud)

FORGE uses **Redis protocol** (`redis://` or `rediss://`) via `REDIS_URL` for BullMQ, feed cache, rate limits, and Socket.IO scaling.

**Not supported:** Upstash REST-only (`UPSTASH_REDIS_REST_*`) — removed; use `REDIS_URL` only.

## Setup

1. [Redis Cloud](https://redis.io/cloud/) → database → **Connect** → copy connection string.
2. Use the URL **exactly** as shown (`redis://` vs `rediss://` — wrong scheme causes TLS errors).
3. Local: add to `apps/api/.env` (see `apps/api/.env.redis-cloud.example`).

```bash
npm run redis:test
```

## Fly production

```bash
fly secrets set REDIS_URL='redis://default:PASSWORD@HOST.db.redis.io:PORT' --app forge-studios-api
fly secrets unset UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN --app forge-studios-api
npm run sync:fly:worker-secrets
```

Code: `apps/api/src/config/resolve-redis-url.ts`

## Verify

```bash
curl -sS 'https://api.forgestudios.net/api/v1/health' | jq .
npm run check:production
```

Expect: `redis: ok`, `videoQueue: ok` (when worker is up).

## Flush (staging / after migration)

```bash
FORGE_FLUSH_CONFIRM=yes bash scripts/flush-redis.sh
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ssl3_get_record:wrong version number` | Use `redis://` for non-TLS port; `rediss://` only when TLS is enabled |
| `max requests limit exceeded` | Legacy Upstash quota — migrate to Redis Cloud `REDIS_URL` |
| Socket.IO fails with 2 API machines | Ensure `REDIS_URL` on API + worker; run `sync:fly:worker-secrets` |
