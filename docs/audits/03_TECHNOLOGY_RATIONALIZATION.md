# Phase 3 — Technology Rationalization

**Audit date:** 2026-06-04  
**Classification:** KEEP · REPLACE · REMOVE · CONSOLIDATE

---

## Backend

| Technology | Class | Why | Risks if wrong |
|------------|-------|-----|----------------|
| **NestJS 10** | KEEP | Mature module model, guards, BullMQ integration | Rewrite cost |
| **TypeORM 0.3 + PostgreSQL 16** | KEEP | 28 entities, 22 migrations; Neon pooling | Migration effort to Prisma/Drizzle |
| **BullMQ 5** | KEEP | Video, analytics, push, subscriptions | Redis dependency (required anyway) |
| **ioredis** | KEEP | BullMQ, cache, lockout, view counts | — |
| **`redis` npm (node-redis)** | CONSOLIDATE | Only for `@socket.io/redis-adapter` in gateway | Two connection pools to same URL |
| **Socket.IO 4.7** | KEEP | Gateway + web client v4 | Mobile on v2 client — see REPLACE |
| **Mux** | KEEP | Prod-enforced VOD/live (`validate-production-config.ts`) | Primary variable COGS |
| **FFmpeg (fluent-ffmpeg)** | KEEP (dev only) | Local transcode; **REMOVE from prod worker images** if unused | Accidental prod enable = CPU + duplicate path |
| **AWS SDK S3** | KEEP | Uploads, multipart, avatars | Egress costs |
| **Firebase Admin** | KEEP (narrow) | FCM + App Check — not auth | Scope creep into Firebase Auth |
| **Passport JWT + bcrypt** | KEEP | Custom auth aligned with Postgres sessions | — |
| **nodemailer** | KEEP | SMTP abstraction (Resend/Mailpit as transport) | — |
| **@nestjs/throttler** | KEEP | Global + per-route limits | — |
| **express-rate-limit** | REMOVE | In `package.json`; zero usage in `src/` | Dead dep, audit noise |
| **OpenTelemetry** | KEEP | Opt-in via `OTEL_EXPORTER_OTLP_ENDPOINT` | Cost if always-on without sampling |
| **Sentry NestJS v10** | KEEP | Error tracking | Event volume / PII — tune in prod |
| **prom-client** | KEEP | `/metrics` for Grafana | Scrape token rotation |

---

## Frontend (web + admin)

| Technology | Class | Why |
|------------|-------|-----|
| **Next.js 14 App Router** | KEEP | SSR/ISR, Vercel deploy |
| **React 18** | KEEP | Ecosystem |
| **TanStack Query 5** | KEEP | Server state, caching |
| **Tailwind CSS 4** | KEEP | Design system integration |
| **@forge/design-system** | KEEP | Product differentiation rule |
| **hls.js** | KEEP | Mux HLS playback (web only) |
| **socket.io-client v4** | KEEP | Matches API Socket.IO 4 |
| **@sentry/nextjs v9** | CONSOLIDATE | Align major version with API Sentry v10 when upgrading |
| **Firebase JS v11** | KEEP | App Check + messaging hooks (web) |
| **Playwright** | KEEP | E2E smoke in CI |

---

## Mobile

| Technology | Class | Why |
|------------|-------|-----|
| **Flutter 3.19+** | KEEP | Single codebase iOS/Android |
| **Riverpod + go_router** | KEEP | State + deep links |
| **dio** | KEEP | HTTP to API |
| **video_player + chewie** | KEEP | Playback (needs Mux URL parity) |
| **socket_io_client ^2.0.3** | **REPLACE** | API uses Socket.IO 4 — protocol/client mismatch risk |
| **flutter_secure_storage** | KEEP | Token storage |

---

## Data & infra

| Technology | Class | Why |
|------------|-------|-----|
| **Neon Postgres** | KEEP | Serverless/pooled prod DB |
| **Redis Cloud** | KEEP | Queues + cache + socket adapter |
| **Fly.io** | KEEP | API + worker hosting |
| **Vercel** | KEEP (short term) | Web + admin — **CONSOLIDATE** long-term if admin traffic tiny |
| **Docker Compose** | KEEP | Local dev only |
| **Stripe** | N/A (future) | `BillingModule` scaffold — implement once, retire mock overlap carefully |

---

## Not used (no action)

React Native, GraphQL, MongoDB, DynamoDB, Auth0, Clerk, Cloudflare Stream, Razorpay, RevenueCat, Mixpanel, PostHog (in codebase).

---

## Findings

### F-301: Remove express-rate-limit

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Evidence** | `apps/api/package.json` line 53; no imports in `apps/api/src/` |
| **Recommendation** | `npm uninstall express-rate-limit` in `@forge/api` |
| **Expected impact** | Smaller install; less confusion vs Throttler |

### F-302: Upgrade mobile Socket.IO client

| Field | Value |
|-------|-------|
| **Severity** | High (scale/reliability) |
| **Evidence** | `apps/mobile/pubspec.yaml` `socket_io_client: ^2.0.3+1` vs API `socket.io ^4.7.5` |
| **Recommendation** | Upgrade to Socket.IO v4-compatible Dart client; regression-test live chat |
| **Expected impact** | Fewer reconnect bugs; consistent realtime at scale |

### F-303: Consolidate Redis clients (investigate) — **Documented (Wave 4)**

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Evidence** | ioredis (BullMQ) + `redis` package (socket adapter) |
| **Resolution** | [REDIS_CONNECTIONS.md](../operations/REDIS_CONNECTIONS.md) — dual-client rationale, connection budget, monitoring |
| **Expected impact** | Ops clarity; connection budgeting per Fly machine |
