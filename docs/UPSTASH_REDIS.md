# Upstash Redis — FORGE production

## Symptom

API returns **500** on feed, cache, or queues with logs:

```text
ERR max requests limit exceeded. Limit: 500000, Usage: ...
```

Free-tier Upstash caps **commands per month** (not just connections). Hitting the cap blocks all Redis commands until the quota resets or you upgrade.

## Immediate mitigation (code)

Feed and multipart paths use **safe Redis helpers** (`apps/api/src/common/redis/redis-safe.util.ts`) so Postgres-backed routes still work when Redis is over quota. Deploy the latest API after merging.

## Fix the quota

1. [Upstash Console](https://console.upstash.com/) → your Redis database → **Details** → check **Monthly commands**
2. **Upgrade** plan or wait for monthly reset
3. Optional: reduce command volume
   - Avoid `KEYS` (FORGE already uses generation-based feed invalidation)
   - Tune Grafana scrape interval (60s is fine)
   - Review BullMQ job churn on worker

## Verify

```bash
curl -sS "https://api.forgestudios.net/api/v1/videos/feed?limit=1&sort=latest" | head -c 200
npm run check:production
```

Health may show `redis: down` or `videoQueue: unavailable` while over quota — feed should still return 200 after the resilience deploy.

## Flush (after quota restored)

```bash
FORGE_FLUSH_CONFIRM=yes bash scripts/flush-redis.sh
```

See [scripts/README.md](../scripts/README.md).
