# Phase 4 — Third-Party Dependency Audit

**Audit date:** 2026-06-04  
**Note:** Dollar amounts are **qualitative** (no billing API access). Validate against vendor dashboards.

---

## Vendor matrix

| Service | Usage in FORGE | Env / config | Lock-in | Cost driver | Consolidation / alt |
|---------|----------------|--------------|---------|-------------|---------------------|
| **Mux** | VOD transcode, live streams, webhooks | `MUX_*`, `VIDEO_TRANSCODE_PROVIDER=mux` | High (playback IDs, live IDs) | Minutes stored + delivered; live hours | None at scale without rebuild; optimize ingest idempotency |
| **Fly.io** | API `forge-studios-api`, worker `forge-studios-worker` | `fly.toml`, `fly.worker.toml` | Medium | Machine RAM/CPU hours; `min_machines_running=1` (F-1002) | Alternative: AWS ECS/Railway — migration cost high |
| **Neon** | Production Postgres | `DATABASE_URL` pooled | Medium | Storage + compute hours | Supabase PG, RDS — migration moderate |
| **Redis Cloud** | BullMQ, cache, sockets, lockout, views | `REDIS_URL` | Medium | Memory tier + ops | Upstash not supported per docs; self-host Redis ops burden |
| **AWS S3** | Uploads, multipart, thumbnails | `AWS_*`, `S3_BUCKET_NAME` | Low–medium | Storage + egress | R2 cheaper egress; migration effort |
| **CloudFront** | Optional CDN for FFmpeg path | `CLOUDFRONT_DOMAIN` | Low | Egress if enabled | Only if FFmpeg/signed URLs need CDN |
| **Vercel** | Web + admin (2 projects) | `VERCEL_*` | Medium | Builds + bandwidth | Single project with path-based admin (CONSOLIDATE) |
| **Firebase** | FCM push, App Check (not login) | `FIREBASE_*`, web `NEXT_PUBLIC_*` | Low–medium | FCM volume | OneSignal duplicate — avoid |
| **Google OAuth** | Passport login | `GOOGLE_*` | Low | Free tier | — |
| **SMTP / Resend** | Transactional mail | `SMTP_*` | Low | Email count | Resend vs SendGrid — one provider |
| **Sentry** | API + web + admin errors | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Low | Events + attachments | Tune sample rate; disable default PII |
| **Grafana / Prometheus** | API metrics scrape | `METRICS_*`, `infra/observability/` | Low | Grafana Cloud tier | — |
| **OpenTelemetry** | Optional traces | `OTEL_EXPORTER_OTLP_ENDPOINT` | Low | Collector + storage | Enable with sampling only |
| **Stripe** | Not integrated | Scaffold in `BillingModule` | — | — | Phase 2 per `MEMBERSHIPS.md` |

---

## Redundant or risky spend

| Risk | Severity | Evidence |
|------|----------|----------|
| FFmpeg worker in production | Critical | `validate-production-config.ts` blocks non-mux — keep enforced |
| Duplicate VOD ingest (Mux + FFmpeg) | Critical (if misconfigured) | `workers.module.ts` mutual registration |
| Two Vercel projects for low admin traffic | Low–medium | `apps/admin` + `apps/web` separate deploys |
| OTel without collector | Low | `otel-bootstrap.ts` conditional — paying for nothing if endpoint unset |
| Sentry on all platforms without sampling | Medium | High event volume at scale |

---

## Services correctly scoped (not redundant)

| Pair | Verdict |
|------|---------|
| Firebase vs JWT auth | **Not duplicate** — Firebase is FCM/App Check only (`docs/FIREBASE.md`) |
| Mux vs S3 | **Complementary** — S3 raw upload, Mux transcode/playback |
| Mock subscriptions vs future Stripe | **Sequential** — avoid running both as source of truth |

---

## Findings

### F-401: Mux is dominant COGS

| Field | Value |
|-------|-------|
| **Severity** | High (cost) |
| **Evidence** | Prod requires Mux; all VOD/live playback via Mux IDs |
| **Recommendation** | Webhook idempotency, asset lifecycle policy, monitor minutes delivered |
| **Expected impact** | Largest controllable media cost — see [10_COST_OPTIMIZATION.md](./10_COST_OPTIMIZATION.md) |

### F-402: Fly scale-to-zero tradeoff — **Resolved (Wave 2)**

| Field | Value |
|-------|-------|
| **Severity** | Was High (scale/UX) |
| **Evidence** | Was `fly.toml` `min_machines_running = 0` |
| **Resolution** | `min_machines_running = 1` — [FLY_SLO.md](../operations/FLY_SLO.md) |
| **Expected impact** | Stable API p95; modest baseline Fly cost |

### F-902: Staging — **Resolved (Wave 2)**

| Field | Value |
|-------|-------|
| **Resolution** | [STAGING.md](../operations/STAGING.md), `.github/workflows/deploy-staging.yml` |

### F-403: No third-party search/analytics product

| Field | Value |
|-------|-------|
| **Severity** | Info |
| **Evidence** | Postgres FTS + internal `analytics_events` table |
| **Recommendation** | At 1M+ users evaluate Meilisearch/Elastic — defer until query latency fails SLO |
| **Expected impact** | Avoid premature SaaS spend |
