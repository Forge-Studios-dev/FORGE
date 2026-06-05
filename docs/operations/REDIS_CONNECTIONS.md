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

Approximate connections **per API replica**:

| Source | Connections |
|--------|-------------|
| ioredis (Nest default) | 1 |
| BullMQ worker (same process when `ENABLE_VIDEO_WORKER=true`) | +1–2 |
| Socket.IO pub + sub (`redis` package) | 2 |
| **Typical API machine** | **3–4** |

Scale-out: each additional Fly machine adds the same footprint. Upstash / managed Redis plans should size `maxclients` for `(machines × 4) + headroom`.

---

## Monitoring

- **`CLIENT LIST`** — count connections by name/IP; alert if per-machine count drifts above 8.
- **Memory** — entitlement tier cache (`ent:tier:*`, TTL 300s), subscription cache (`ent:sub:*`, 60s), viewer access cache (`ent:access:*`, 60s), JWT user cache (`auth:user:*`, 60s). Sudden key growth may indicate cache bust failure or abuse.
- **Eviction** — if `maxmemory-policy` is `allkeys-lru`, watch hit rate on hot paths (JWT, entitlements).

See [OBSERVABILITY.md](../OBSERVABILITY.md) and [FLY_SLO.md](./FLY_SLO.md).

---

## Related findings

- **F-303** — documented (this file); no code change required.
- Horizontal Socket.IO: requires Redis adapter + `REDIS_URL`; without it, gateway logs a single-replica warning.
