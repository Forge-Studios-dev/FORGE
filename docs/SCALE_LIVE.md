# FORGE — 100K Concurrent Live Viewers Scale Design

> **Status: PROPOSED — not yet implemented.** This is a forward-looking design, not current architecture. Section 1 below describes what's actually shipped today; everything after it is roadmap.
>
> Architecture for scaling live streaming to 100,000+ concurrent viewers.
> Related: [LIVE.md](./LIVE.md), [SCALE_MESSAGING.md](./SCALE_MESSAGING.md), [DEPLOY.md](./DEPLOY.md)

---

## 1. Current Live Stack

| Component | Stack |
|-----------|-------|
| Stream ingest | Mux RTMP ingest |
| HLS delivery | Mux CDN (adaptive bitrate) |
| Signaling/presence | Socket.IO + `@socket.io/redis-adapter` |
| Viewer count | Redis INCR `stream:viewers:{streamId}` |
| Chat | Community room messages (via Socket.IO) |
| Analytics | `StreamAnalyticsSnapshot` (periodic snapshots) |

Mux handles video delivery at any scale. The Socket.IO layer is the binding constraint.

---

## 2. Bottleneck: Socket.IO Presence at 100K

At 100,000 concurrent viewers on one stream:
- Each viewer maintains a persistent WebSocket connection
- Fly.io `api` app: each instance handles ~5,000 concurrent WS connections (memory bound at ~1GB/instance with NestJS overhead)
- **Required replicas**: 100,000 / 5,000 = **20 replicas** minimum

Redis pub/sub fans out every server-side event (viewer join/leave, chat, poll) to all 20 replicas. Each replica emits to its connected sockets. Latency: < 5ms end-to-end.

---

## 3. Architecture

```
Viewer devices (100K)
        │  WebSocket (Socket.IO)
        ▼
 ┌──────────────────────────────────────────────────────────┐
 │           Fly.io Load Balancer (anycast)                 │
 │  sticky sessions: session cookie → fixed replica        │
 └──────────────────────────────────────────────────────────┘
        │  distributed across 20 replicas
        ▼
┌──────┐ ┌──────┐ ┌──────┐ ... ┌──────┐  (20 × api instances)
│ api1 │ │ api2 │ │ api3 │     │api20 │
└──┬───┘ └──┬───┘ └──┬───┘     └──┬───┘
   └─────────┴─────────┴───────────┘
                     │
              Redis pub/sub
              `stream:{streamId}`
                     │
        ┌────────────┴────────────┐
        │                         │
  BullMQ (analytics         Postgres (snapshots,
  snapshot jobs)             chat history)
```

### Key scaling levers

| Lever | Config | Where |
|-------|--------|-------|
| API replica count | `fly scale count 20 --region ord` | `fly.toml` |
| WS connections per replica | `[services.concurrency] hard_limit = 5000` | `fly.toml` |
| Redis pub/sub throughput | Upstash Redis cluster (read replicas) | `REDIS_URL` |
| Mux HLS delivery | Mux handles natively — no action needed | Mux dashboard |

---

## 4. Viewer Count at Scale

Current: each viewer join/leave calls `INCR`/`DECR` on Redis key `stream:viewers:{streamId}`.

At 100K viewers with high churn (e.g., 1% turnover/min = 1,000 join/leave events/min):
- Redis INCR/DECR: ~10μs each → 1,000 ops/min is trivial
- Broadcast viewer count: throttle to 1 emit per 5 seconds (not per join/leave)

**Throttle implementation** (already partially in `events.gateway.ts`):
```typescript
// Debounce viewer count broadcast per stream
private viewerCountTimers = new Map<string, NodeJS.Timeout>();
private scheduleViewerCountBroadcast(streamId: string) {
  if (this.viewerCountTimers.has(streamId)) return;
  this.viewerCountTimers.set(streamId, setTimeout(async () => {
    const count = await this.redis.get(`stream:viewers:${streamId}`);
    this.server.to(`stream:${streamId}`).emit('stream:viewer-count', { count: Number(count) });
    this.viewerCountTimers.delete(streamId);
  }, 5000));
}
```

---

## 5. Live Chat at 100K Viewers

At 100K viewers with 1% chat participation = 1,000 active chatters:
- Typical chat rate: 5 msg/chatter/min = 5,000 msg/min ≈ **83 msg/sec**
- Each message is pub/sub to all 20 replicas → each replica emits to its ~5,000 viewers

**Rate limiting per viewer**: `20 messages/60s` (Redis sliding window, already implemented).

**Chat moderation at scale**: AI moderation runs asynchronously via BullMQ (not blocking the hot path). See `AiModerationService`.

**Redis Streams** (P3 upgrade, after 10K viewers):
```
XADD stream:chat:{streamId} * userId {uid} body {text} ts {now}
```
- Consumer group `moderators` reads at 100ms intervals for AI check
- Consumer group `chat_persist` writes to Postgres asynchronously
- All replicas subscribe to new entries with `XREAD BLOCK 0`

---

## 6. Viewer Presence (join/leave events)

Don't broadcast every join/leave to all 100K viewers — that's 100K events at peak.

**Instead**: coalesce viewer count updates (§4 above). Emit presence only for:
- Creator (always notified)
- Moderators (always notified)
- Super chat senders (emit to creator only)

---

## 7. Fly.io Configuration

```toml
# fly.toml additions for high-concurrency live
[services]
  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [services.concurrency]
    type = "connections"
    hard_limit = 5000      # WebSocket connections per instance
    soft_limit = 4000      # Start routing to new instance at 80%

[[vm]]
  cpu_kind = "performance"
  cpus = 4
  memory_mb = 4096         # 4GB RAM handles ~5K WS connections
```

Scale command:
```bash
# Before a scheduled 100K-viewer event
fly scale count 25 --app forge-api --region ord,lax,fra
# After event ends
fly scale count 3 --app forge-api
```

---

## 8. Redis Cluster for 100K

Single Redis (Upstash) handles 100K viewer scenario comfortably:
- Upstash free tier: 10K req/sec
- Upstash Pro: 1M+ req/sec
- At 100K viewers, peak Redis ops: ~50K/sec (join + viewer count + chat rate limiting)

**Upgrade path**: Upstash Redis cluster (multi-region read replicas for global streams).

---

## 9. Mux Live (Video Delivery)

Mux handles adaptive bitrate HLS delivery without FORGE infrastructure involvement:
- Mux CDN delivers to 100K+ viewers natively
- FORGE only provides the playback URL (stored in `stream.playbackUrl`)
- On `mux.video.live_stream.active` webhook → update `stream.status = LIVE` + emit Socket.IO event

No FORGE changes needed for video delivery scaling.

---

## 10. Pre-Event Checklist

Before a scheduled high-viewership event:

- [ ] Scale API replicas: `fly scale count 20 --app forge-api`
- [ ] Warm Redis: pre-create viewer count key
- [ ] Notify Mux of expected peak (optional — Mux CDN auto-scales)
- [ ] Enable BullMQ chat persistence worker (dedicated `WORKER_ONLY=true` instance)
- [ ] Enable AI moderation queue (low-latency threshold for live chat)
- [ ] Set `stream.maxViewers` if seat-limited event

Post-event:
- [ ] Scale down: `fly scale count 3 --app forge-api`
- [ ] Trigger stream summary AI job (via `POST /streaming/:id/ai-summary`)
- [ ] Review analytics snapshot in creator dashboard

---

## 11. Rollout Phases

| Phase | Target | Prerequisite |
|-------|--------|-------------|
| Now | 1,000 concurrent viewers | Existing stack (no changes) |
| P1 | 10,000 concurrent viewers | Fly autoscale + Redis Streams for chat |
| P2 | 50,000 concurrent viewers | Upstash Pro + replica count 10 |
| P3 | 100,000+ concurrent viewers | Performance VM tier + pre-event warm-up |

---

## 12. Observability

| Metric | Alert | Source |
|--------|-------|--------|
| Socket.IO connections per replica | > 4,500 | Prometheus `forge_gateway_connections` |
| Redis pub/sub lag | > 20ms | `LATENCY HISTORY` |
| API p99 response time | > 500ms | OTel |
| Stream viewer count drift | > 5% vs Mux reported | Custom reconciler |
| Chat rate per stream | > 500 msg/sec | BullMQ queue depth |
