# Phase 7 — Performance Bottleneck Report

**Audit date:** 2026-06-04  
**Priority lens:** Cost + scale

---

## Priority legend

| Priority | Definition |
|----------|------------|
| **High** | Degrades with traffic or directly increases infra COGS |
| **Medium** | Noticeable at 100K MAU or under load test |
| **Low** | Polish / dev experience |

---

## Backend — High

| Issue | Evidence | Recommendation | Impact |
|-------|----------|----------------|--------|
| JWT DB lookup per request | `jwt.strategy.ts:36-39` | Cache user snapshot (F-501) | Neon QPS, API CPU |
| Live streams N+1 entitlements | `streaming.service.ts:143-163` | Batch access (F-502) | p95 on `/streams/live` |
| Fly API cold start | `fly.toml` `min_machines_running = 0` | min=1 or pre-warm (F-402) | First-request latency |
| Unbounded admin/list limits | Various controllers | Max limit pipe (F-602) | DB + memory spikes |

---

## Backend — Medium

| Issue | Evidence | Recommendation | Impact |
|-------|----------|----------------|--------|
| Permissions guard extra user fetch | `permissions.guard.ts` when CLS missing | Ensure CLS always populated post-JWT | Duplicate user reads |
| Playlist deep relations | `playlists.service.ts` wide `relations` | Pagination on items | Large payloads |
| Analytics table growth | `analytics-event.entity` | Retention job (F-504) | Storage + query time |
| Redis memory | Multiple TTL caches + queues | Monitor memory; alert 80% | Redis tier upgrade cost |

---

## Backend — Low

| Issue | Evidence | Recommendation | Impact |
|-------|----------|----------------|--------|
| Worker queue depth visibility | No Grafana alert in CI | Import queue depth panels | Ops MTTR |
| OTel always-off | `otel-bootstrap.ts` conditional | Sampled traces in prod | Debug time |

---

## Caching (strengths)

| Cache | TTL | File |
|-------|-----|------|
| Guest feed (non-forYou) | ~300s + jitter | `feed.service.ts` |
| Video detail | 120s | `content/video-cache.ts` |
| Active subscription | 60s | `entitlements.service.ts` |
| View counts | Redis incr → flush | `videos.service.ts`, `ViewCountFlushService` |

---

## Frontend — Web (Next.js 14)

| Area | Assessment | Priority |
|------|------------|----------|
| App Router | Route-based code splitting by default | Low |
| TanStack Query | Server state caching in `lib/api.ts` | Medium — review staleTime per screen |
| HLS playback | `hls.js` in VideoPlayer | Medium — Mux CDN handles delivery; watch player memory on long sessions |
| Socket.IO | `lib/socket.ts` | Medium — reconnect backoff |
| Bundle size | Not measured in CI | Medium — add `@next/bundle-analyzer` on release branch |

**Recommendation:** Run `npm run build` in `apps/web` and record First Load JS for `/`, `/watch/[id]`, `/studio` — set budget thresholds.

---

## Frontend — Admin

| Area | Assessment | Priority |
|------|------------|----------|
| Charts (recharts) | Admin-only bundle | Low |
| No E2E in CI | lint + build only | Medium — ops risk |

---

## Mobile — Flutter

| Area | Assessment | Priority |
|------|------------|----------|
| VOD/live parity | Master §16 — partial | **High** — more Mux playback from mobile MAU |
| Socket.IO v2 client | `pubspec.yaml` | **High** (F-302) |
| No widget tests | 0 `*_test.dart` | Medium |

---

## Streaming & upload

| Path | Behavior | Priority |
|------|----------|----------|
| Upload | Presigned S3; multipart ≥50MB with `multipart_upload` flag | Medium — monitor failed multipart cleanup |
| Transcode | Mux webhook-driven | High — webhook retry/idempotency |
| Playback | Mux HLS URLs; gated by entitlements | High — null URL when denied (correct) |

---

## Queue performance

| Queue | Risk at scale |
|-------|---------------|
| `mux-vod-ingest` | Backlog if upload spike — scale worker replicas |
| `analytics-ingest` | Write amplification — batch inserts in worker |
| `push-dispatch` | FCM rate limits — worker concurrency cap |

---

## Summary table

| Priority | Count (top items) |
|----------|-------------------|
| High | 5 |
| Medium | 8 |
| Low | 4 |

See [10_COST_OPTIMIZATION.md](./10_COST_OPTIMIZATION.md) and [13_SCALABILITY_ROADMAP.md](./13_SCALABILITY_ROADMAP.md) for remediation sequencing.
