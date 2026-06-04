# Phase 1 — Project Inventory

**Audit date:** 2026-06-04

---

## Repository overview

| Property | Value |
|----------|-------|
| Monorepo | npm workspaces (`forge-platform`) |
| Root | `/FORGE` |
| Node | ≥20 · npm ≥10 |
| Mobile | Flutter (`apps/mobile`) — **outside** npm workspaces |

---

## Deployable units

| Module | Path | Purpose | Dependencies | Usage | Criticality | Owner | Replaceable? |
|--------|------|---------|--------------|-------|-------------|-------|--------------|
| **API** | `apps/api` | HTTP REST `/api/v1`, Socket.IO `/events`, health, metrics | Neon, Redis, S3, Mux, Firebase Admin, SMTP | Every client request | **P0** | Platform/API | Hard — core |
| **Worker** | Same codebase + `fly.worker.toml` | BullMQ: Mux ingest, analytics, FCM, subscriptions | Same as API minus HTTP | Async jobs | **P0** | Platform/API | Hard — video + analytics |
| **Web** | `apps/web` | Consumer Next.js 14 | API, `@forge/design-system`, Firebase client, HLS | Primary UX | **P0** | Web | Medium (any React SPA) |
| **Admin** | `apps/admin` | Operator Next.js 14 | API, design-system | Low traffic | **P1** | Web/Ops | High — could merge into web |
| **Mobile** | `apps/mobile` | Flutter iOS/Android | API, Firebase, socket_io_client v2 | Growing | **P1** | Mobile | Medium |
| **shared-types** | `packages/shared-types` | DTOs, flags, JWT helpers, socket events | None runtime | All TS apps | **P0** | Platform | Low risk |
| **design-system** | `packages/design-system` | Tokens, Tailwind, React primitives | React | Web + Admin | **P2** | Design/Web | Medium |

---

## API feature modules (NestJS)

Registered in `apps/api/src/app.module.ts`.

| Module | Controller / entry | Criticality | Notes |
|--------|-------------------|-------------|-------|
| AuthModule | `auth` | P0 | JWT + refresh rotation |
| UsersModule | `users` | P0 | Profiles, creator request |
| ContentModule | `videos` | P0 | VOD, Mux, multipart |
| FeedModule | `videos/feed` | P0 | Home/explore |
| StreamingModule | `streams` | P0 | Mux live |
| EntitlementsModule | root | P0 | Mock memberships |
| EngagementModule | root | P1 | Likes, comments, follows |
| SearchModule | `search` | P1 | Postgres FTS |
| CommunitiesModule | root | P1 | Creator channels |
| StreamChatModule | `streams/:id/chat` | P1 | Live chat |
| PlaylistsModule | `playlists` | P2 | User playlists |
| NotificationsModule | `notifications` | P1 | In-app + FCM tokens |
| AnalyticsModule | `analytics` | P1 | BullMQ ingest |
| ReportsModule | `reports` | P2 | Trust intake |
| AdminModule | `admin` | P1 | Moderation |
| PlatformModule | `platform` | P0 | Public config + flags |
| BillingModule | — | P2 | Stripe scaffold only |
| FirebaseModule | — | P1 | FCM + App Check |
| MailModule | — | P1 | SMTP |
| WorkersModule | — | P0 | Queue consumers |
| GatewayModule | Socket.IO | P0 | Realtime |
| DatabaseModule | — | P0 | TypeORM + migrations |

---

## Background queues (BullMQ)

| Queue | Worker | Criticality |
|-------|--------|-------------|
| `mux-vod-ingest` | MuxVodIngestWorker | P0 (prod default) |
| `video-processing` | VideoProcessorWorker | P3 prod (FFmpeg dev only) |
| `video-processing-dlq` | DLQ | P2 |
| `analytics-ingest` | AnalyticsIngestWorker | P1 |
| `push-dispatch` | PushDispatchWorker | P1 |
| `subscription-maintenance` | SubscriptionMaintenanceWorker | P1 |

Logic: `apps/api/src/modules/workers/workers.module.ts`

---

## Operational modules

| Module | Path | Purpose | Criticality |
|--------|------|---------|-------------|
| Scripts | `scripts/` | Deploy, smoke, Neon, Fly secrets, Grafana | P1 |
| Observability assets | `infra/observability/` | Grafana dashboard, alerts, scrape examples | P2 |
| CI/CD | `.github/workflows/` | ci.yml, release.yml, deploy-* | P0 |
| Fly API | `fly.toml` | `forge-studios-api` | P0 |
| Fly Worker | `fly.worker.toml` | `forge-studios-worker` | P0 |
| Docker Compose | `docker-compose.yml` | Local Postgres 16, Redis 7, mailpit | P2 (dev) |

---

## Environment & config surfaces

| File | Role |
|------|------|
| `apps/api/.env.example` | Canonical API env catalog |
| `apps/api/.env.production.example` | Prod checklist |
| `apps/api/.env.neon.example` | Neon pooled URL |
| `apps/api/.env.redis-cloud.example` | Redis Cloud |
| `apps/web/.env.example` | Web public env |
| `apps/admin/.env.example` | Admin public env |
| `secrets/auth-deploy.env.example` | Auth secrets bundle template (gitignored live file) |

---

## Key findings (Phase 1)

### F-101: Worker/API split is intentional

| Field | Value |
|-------|-------|
| **Severity** | Info |
| **Evidence** | `app.module.ts` — `shouldLoadWorkersModule()`; `fly.worker.toml` `WORKER_ONLY=true` |
| **Recommendation** | Keep split; never enable FFmpeg worker in prod |
| **Expected impact** | Isolates CPU-heavy jobs from HTTP replicas |

### F-102: Mobile outside workspaces

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Evidence** | Root `package.json` workspaces omit `apps/mobile` |
| **Recommendation** | Document mobile release separately in CI; optional future melos/mono tool |
| **Expected impact** | DX — version drift risk for API contracts |
