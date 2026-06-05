# Phase 5 — Database Optimization

**Audit date:** 2026-06-04

---

## Schema summary

| Metric | Value | Evidence |
|--------|-------|----------|
| Entities | 28 | `apps/api/src/**/*.entity.ts` |
| Migrations | 22 | `apps/api/src/database/migrations/` |
| Auto-sync | Off | `typeorm-shared-options.ts` — `synchronize: false`, `migrationsRun: true` |
| Pool | `DB_POOL_MAX` (default 20) | `configuration.ts` |

---

## Index coverage (highlights)

| Area | Migration / entity | Purpose |
|------|-------------------|---------|
| Feed listing | `1739120000000-enhancement-indexes-and-fts.ts` | Partial index `IDX_videos_feed_public_ready` |
| Search | Same + `1740000000001-video-search-tags-text.ts` | GIN `search_vector` on videos/users |
| Video listing | `1714975500000-video-indexes.ts`, `1740000000000-video-publish-metadata.ts` | Status, category, publish |
| Engagement | Initial + MVP migrations | likes, follows, comments |
| Live/subs/community | `1750000000000-live-subs-community.ts` | Streams, tiers, channels |

Entity-level indexes on `video.entity.ts` (`userId`, `status`, `createdAt`, `categoryId`, `publishStatus`), `user.entity.ts` (unique `email`, `username`).

---

## Query patterns — good

| Pattern | Location | Impact |
|---------|----------|--------|
| Feed joins in one QB | `feed.service.ts` — `leftJoinAndSelect` creator, tags, category | Avoids N+1 on feed cards |
| Guest feed Redis cache | `feed.service.ts` — `FEED_CACHE_TTL_BASE` 300s + jitter | Reduces Neon read load |
| Video detail cache | `videos.service.ts` / `video-cache.ts` | TTL 120s |
| Subscription cache | `entitlements.service.ts` | Redis 60s for active sub |
| Async analytics writes | BullMQ `analytics-ingest` | Keeps POST `/analytics/events` fast |
| View count batching | Redis pending → Postgres flush | `ViewCountFlushService` |

---

## Issues

### F-501: JWT validate — DB read every authenticated request — **Resolved (Wave 1)**

| Field | Value |
|-------|-------|
| **Severity** | **High** (scale) |
| **Evidence** | `jwt.strategy.ts` — was `userRepository.findOne` per request |
| **Resolution** | `auth-user-cache.service.ts` — Redis snapshot 60s; bust on `logoutAll` / admin user updates |
| **Expected impact** | Major reduction in Neon QPS at 100K+ DAU |

### F-502: Live streams list — N× checkAccess — **Resolved (Wave 1)**

| Field | Value |
|-------|-------|
| **Severity** | **High** (scale) |
| **Evidence** | `streaming.service.ts` — per-stream `checkAccess` |
| **Resolution** | `checkAccessMany` batches follow + subscription lookups |
| **Expected impact** | List endpoint latency stable as live count grows |

### F-503: Community channel membership lookups — **Resolved (Wave 4)**

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Evidence** | `communities.service.ts` — per-channel `memberRepository.findOne` |
| **Resolution** | Single `IN` query + `checkChannelAccessMany` |
| **Expected impact** | Faster community page for creators with many channels |

### F-504: Analytics events unbounded growth

| Field | Value |
|-------|-------|
| **Severity** | Medium (cost) |
| **Evidence** | `analytics-event.entity.ts` — ingest without documented retention |
| **Recommendation** | Partition by month or archive to cold storage; TTL job |
| **Expected impact** | Lower Neon storage bill; faster admin analytics queries |

### F-505: Tier lookup in meetsTierRequirement — **Resolved (Wave 4)**

| Field | Value |
|-------|-------|
| **Severity** | Low–medium |
| **Evidence** | `entitlements.service.ts` — repeated `getTierById` |
| **Resolution** | Redis cache `ent:tier:{tierId}` TTL 300s; bust on tier update/delete |
| **Expected impact** | Fewer reads on tier-gated playback paths |

---

## Denormalization opportunities

| Opportunity | When | Tradeoff |
|-------------|------|----------|
| Viewer entitlement bitmap per creator | 100K MAU | Stale until subscription webhook (Phase 2) |
| Materialized popular feed | High read:write ratio | Refresh job complexity |
| Creator stats on `users` | Studio dashboard | Write amplification on engagement |

---

## Data consistency

- Refresh tokens: hashed, rotation + reuse revocation — `auth.service.ts`
- Transactions used on multi-step writes (auth, content) — spot-check critical paths
- Soft delete: `user.deletedAt` — JWT validate rejects deleted users

---

## Priority fix table

| ID | Issue | Severity | Expected impact |
|----|-------|----------|-----------------|
| F-501 | JWT DB lookup | High | Neon QPS −30–50% at auth-heavy traffic |
| F-502 | Live list N+1 | High | p95 latency stable as live count grows |
| F-504 | Analytics retention | Medium | Storage cost control |
| F-503 | Community N+1 | Medium | Creator community UX |
| F-505 | Tier cache | Low–medium | Playback path efficiency |
