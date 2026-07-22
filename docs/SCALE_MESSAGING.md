# FORGE — Millions-Messages Scale Design

> **Status: PROPOSED — not yet implemented.** This is a forward-looking design, not current architecture. Section 1 below describes what's actually shipped today; everything after it (including the `message_persist`/`persist_chat_message` queue and message-table partitioning) is roadmap.
>
> Architecture for scaling real-time and persistent messaging to millions of messages across communities, live streams, and DMs.
> Related: [DEPLOY.md §Horizontal scaling](./DEPLOY.md), [LIVE.md](./LIVE.md)

---

## 1. Current Architecture (baseline)

| Component | Stack | Bottleneck at scale |
|-----------|-------|---------------------|
| Community chat | Socket.IO + Redis adapter | Single Redis pub/sub per message fanout |
| Live stream chat | Socket.IO rooms | All consumers in one room receive every message |
| Persistence | Postgres (community_room_messages) | Unbounded inserts, no partitioning |
| Rate limiting | Redis INCR per user/window | Per-replica Redis call per message |
| Message search | ILIKE query | Full-table scan without full-text index |

Target: **sustain 10M messages/day** (≈116 msg/sec average, 1,000+ msg/sec peak during popular live streams).

---

## 2. Bottleneck Analysis

### 2a. Socket.IO fanout

Socket.IO with `@socket.io/redis-adapter` uses Redis pub/sub. At 1,000 msg/sec with 10,000 concurrent subscribers:
- Each message publishes to a Redis channel; all adapter replicas receive and emit to their local sockets
- Redis pub/sub throughput: ~500K messages/sec per node — not the bottleneck
- **Actual bottleneck**: serializing and emitting to 10,000 local sockets per replica (CPU/memory)

**Fix**: Shard rooms by community across API replicas using sticky sessions (via Fly.io `[services.concurrency]`) + Redis adapter. A given community's subscribers land on a small subset of replicas.

### 2b. Postgres insert throughput

At 1,000 msg/sec, community_room_messages receives 86.4M rows/day. A single PostgreSQL table degrades on:
- Index maintenance at insert time
- VACUUM pressure (dead tuple churn)
- `ORDER BY created_at DESC LIMIT N` scans

**Fix**: Range-partition `community_room_messages` by month. Neon's branch-per-tenant model also allows sharding communities across Neon projects.

### 2c. Write amplification

Current path per message:
1. WebSocket receive → validate → save to Postgres → publish to Redis → Socket.IO emit

At 1,000 msg/sec this is 1,000 synchronous Postgres writes/sec on the hot path.

**Fix**: Decouple persistence from the hot path using BullMQ:
1. WebSocket receive → validate → publish to Redis (low-latency fan-out) → **async BullMQ job** → Postgres insert

Viewers see messages immediately via pub/sub. Persistence is eventually consistent (< 1s lag).

---

## 3. Target Architecture

```
User (WebSocket)
    │
    ▼
API replica (NestJS + Socket.IO)
    │  validate + rate-limit (Redis INCR — local cache fallback)
    ├──► Redis pub/sub channel: `room:{roomId}`
    │       └── all replicas emit to local sockets in that room
    │
    └──► BullMQ job: `persist_chat_message`
              └── Worker → INSERT into community_room_messages (partitioned)
                               └── Neon Postgres (pooled, multi-replica)
```

### Key design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fan-out mechanism | Redis pub/sub (existing) | Already deployed, < 1ms latency |
| Persistence queue | BullMQ `persist_chat_message` | Decouples hot path; retries on Postgres downtime |
| Partition key | `created_at` monthly range | Matches query pattern (recent messages) |
| Rate limiting | Redis sliding window (per user, 60s) | Already implemented in `CommunityRoomMessagesService` |
| Message history API | Cursor-based pagination on `(community_room_id, created_at DESC)` | Avoids OFFSET scans |

---

## 4. Postgres Partitioning Plan

```sql
-- Enable partitioning on community_room_messages (migration required)
-- Partition by created_at month. TypeORM does not auto-manage partitions;
-- use a monthly scheduled job (scripts/partition-messages.ts) to pre-create.

ALTER TABLE community_room_messages RENAME TO community_room_messages_legacy;

CREATE TABLE community_room_messages (
  id          UUID NOT NULL,
  room_id     UUID NOT NULL REFERENCES community_rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  body        TEXT,
  type        VARCHAR(32) NOT NULL DEFAULT 'chat',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Pre-create monthly partitions
CREATE TABLE community_room_messages_2026_06
  PARTITION OF community_room_messages
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Index per partition (created automatically on child tables)
CREATE INDEX ON community_room_messages (room_id, created_at DESC);
```

**Migration safety**: 
1. Create new partitioned table in parallel with existing
2. Dual-write for 1 week (write to both; reads from new)
3. Backfill historical data with batched worker
4. Cut over reads; drop legacy table

---

## 5. BullMQ Persistence Worker

Add queue to `GatewayModule`:

```typescript
// In events.gateway.ts — replace direct save with queue enqueue
await this.messagePersistQueue.add('persist', {
  roomId,
  userId,
  body,
  type: messageType,
  createdAt: new Date().toISOString(),
}, { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
```

Worker (`apps/api/src/modules/stream-chat/message-persist.worker.ts`):
```typescript
@Processor('message_persist')
export class MessagePersistWorker {
  async process(job: Job<PersistPayload>) {
    await this.roomMessagesService.persistMessage(job.data);
  }
}
```

**Throughput**: BullMQ + Redis can queue 50K+ jobs/sec. Worker pool of 5–10 processes each handling batch inserts of 100 messages/tick covers 1,000 msg/sec easily.

---

## 6. Redis Memory Budget

At 10M messages/day with 24-hour message caching:
- Average message: ~200 bytes (body + metadata)
- 10M × 200B = 2GB raw data
- Redis sorted set per room: only cache last 100 messages per room → ~1MB/room
- 10,000 active rooms × 1MB = 10GB

**Recommendation**: Cache last 50 messages per room (not all). Older messages served from Postgres via cursor pagination. Redis TTL on room cache keys: 1 hour after last activity.

---

## 7. Live Stream Chat (100K viewers)

See [SCALE_LIVE.md](./SCALE_LIVE.md) for detailed 100K concurrent viewer design.

For chat specifically:
- Stream chat is fire-and-forget (no persistent history by default)
- Use **Redis Streams** (`XADD`/`XREAD`) instead of pub/sub for ordered delivery with consumer groups
- Moderators read from a dedicated consumer group to apply AI moderation before fan-out

---

## 8. Full-Text Search

Add GIN index on `body` for message search:

```sql
ALTER TABLE community_room_messages ADD COLUMN body_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(body, ''))) STORED;

CREATE INDEX ON community_room_messages USING GIN (body_tsv);
```

API: `GET /communities/:id/rooms/:roomId/messages?q=query` uses `body_tsv @@ plainto_tsquery('english', :q)`.

---

## 9. Rollout Phases

| Phase | What | When |
|-------|------|------|
| P0 (now) | BullMQ persist queue (decouple hot path) | Next sprint |
| P1 | Postgres monthly partitioning | When messages table > 10M rows |
| P2 | Redis message cache (last 50/room) | When API response p99 > 100ms |
| P3 | Redis Streams for live chat | When concurrent live viewers > 10K |
| P4 | Neon project-per-tenant sharding | When single Neon project > 500GB |

---

## 10. Observability Checkpoints

| Metric | Alert threshold | Dashboard |
|--------|----------------|-----------|
| BullMQ `message_persist` queue depth | > 10,000 | Redis/BullMQ dashboard |
| Postgres insert latency (p99) | > 50ms | Grafana slow query log |
| Socket.IO emit time per message | > 10ms | OTel span `gateway.emit` |
| Redis pub/sub lag | > 5ms | Redis `LATENCY HISTORY` |
| Messages/sec (rolling 1m) | > 2,000 (warning) | Custom Prometheus counter |
