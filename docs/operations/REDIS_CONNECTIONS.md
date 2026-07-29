# Redis connections — dual-client architecture

FORGE uses **two Redis client libraries** in the API process. This is intentional, not duplicate configuration.

---

## Why two clients

| Client | Package | Used by | Purpose |
|--------|---------|---------|---------|
| **ioredis** | `ioredis` | BullMQ, `@nestjs-modules/ioredis`, entitlement/subscription caches | Command-heavy workloads, Nest DI, Lua-friendly |
| **node-redis** | `redis` | Socket.IO Redis adapter (`events.gateway.ts`) | Official adapter for `@socket.io/redis-adapter` pub/sub |

The Socket.IO adapter requires the `redis` package API (`createClient`, duplicate for sub). BullMQ and Nest cache modules are built on **ioredis**. Consolidating to one library would require a custom adapter or fork — not worth the operational risk today.

---

## Connection budget per Fly machine

Approximate connections **per API replica** (production):

| Source | Connections |
|--------|-------------|
| ioredis (Nest `RedisModule`) | 1 |
| BullMQ Queue clients (one connection family per registered queue) | ~N (often 10+) |
| Socket.IO pub + sub (`redis` package) | 2 |
| **Typical API machine** | **~12–20** depending on registered queues |

**Worker process** adds BullMQ **Worker** connections (often 2 per consuming queue) across all processors — commonly **20+** Redis connections on the worker alone.

Scale-out: each additional Fly machine multiplies this footprint. Size Redis Cloud `maxclients` for `(api_machines × api_budget) + worker_budget + headroom`.

BullMQ logs `Eviction policy is volatile-lru. It should be "noeviction"` when the managed Redis maxmemory policy can drop queue keys. **Production Redis must use `maxmemory-policy noeviction`** (or equivalent) so job/state keys are never silently evicted.

---

## Monitoring

- **`CLIENT LIST`** — count connections by name/IP; alert if per-machine count drifts far above the budget above.
- **Memory** — entitlement tier cache (`ent:tier:*`, TTL 300s), subscription cache (`ent:sub:*`, 60s), viewer access cache (`ent:access:*`, 60s), JWT user cache (`auth:user:*`, 60s), pending view counters (`video:views:pending:*`, TTL 48h). Sudden key growth may indicate cache bust failure or abuse.
- **Eviction** — require `noeviction` for BullMQ; if any LRU policy remains, watch hit rate on hot paths (JWT, entitlements) and queue lag.

See [OBSERVABILITY.md](../OBSERVABILITY.md) and [FLY_SLO.md](./FLY_SLO.md).

---

## Related findings

- **F-303** — documented (this file); dual-client architecture is intentional. Connection budget and `noeviction` requirement updated 2026-07-28.
- Horizontal Socket.IO: requires Redis adapter + `REDIS_URL`; without it, gateway logs a single-replica warning.
