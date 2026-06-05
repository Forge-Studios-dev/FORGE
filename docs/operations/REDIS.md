# FORGE Redis operations: dual-client usage

FORGE uses Redis in multiple roles and (intentionally) creates multiple Redis connections/clients to avoid cross-impact:

- **`@nestjs-modules/ioredis` (`ioredis` client)** for:
  - request-rate limiting storage (`@nestjs/throttler` → `RedisThrottlerStorage`)
  - entitlement and media caching (e.g. tier/access caches) and safe Redis helpers
  - any component that relies on simple key/value operations (`get`, `setex`, `del`, `incr`, etc.)

- **BullMQ** for background work queues (ingest pipelines, analytics, subscriptions maintenance).
  - BullMQ keeps its own Redis connection(s) to isolate queue workloads from synchronous request-path latency.

- **Socket.IO Redis adapter** to propagate events across instances.
  - This adapter also maintains its own Redis client connections.

## Key conventions (this repo)

Entitlements caching keys (all `@forge/api`):

- Tier metadata: `ent:tier:<tierId>`
- Subscription snapshot: `ent:sub:<userId>:<creatorId>`
- Access check cache:
  - `ent:access:<viewerId>:<creatorId>:v<version>:<visibility>:<requiredTierId>`
  - Version key used to bust access caches without scanning keys:
    - `ent:access:v:<viewerId>:<creatorId>`

Throttler / rate limiting:

- Throttler storage prefixes are defined in `RedisThrottlerStorage` (see `apps/api/src/common/redis/redis-throttler.storage.ts`).

## Operational guidance

### 1) Connection limits matter

- Each Redis client creates multiple TCP connections under the hood depending on ioredis settings and adapter usage.
- In Fly and Redis Cloud, ensure the cluster/plan can sustain:
  - API instance count × client connections
  - Worker instance count × BullMQ connections
  - Socket.IO adapter connections

If you see `ECONNREFUSED` or timeouts:

1. reduce instance counts temporarily
2. lower BullMQ concurrency (worker-side)
3. verify Redis maxmemory and connection limits

### 2) Fail-open behavior for throttling

`RedisThrottlerStorage` is designed to fail open:

- If Redis is unreachable, requests proceed (so you do not hard-lock the API).
- You still get partial rate limiting once Redis recovers.

### 3) Prefer version-bump cache busting

For high-cardinality entitlement caches, avoid `KEYS` / `SCAN` in production.

This repo uses **version keys** (e.g. `ent:access:v:<viewerId>:<creatorId>`) so invalidation is O(1):

- bump version on follow/unfollow, subscription changes, or tier edits
- old cache entries naturally become unreachable

## Environment variables

Typical variables used by this repo:

- `REDIS_URL` — Redis connection string for ioredis, BullMQ, and Socket.IO adapter
- `NODE_ENV` — influences SSL and some connection defaults

