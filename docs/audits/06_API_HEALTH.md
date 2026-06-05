# Phase 6 — API Health Report

**Audit date:** 2026-06-04  
**Surface:** REST `/api/v1` · Socket.IO `/events` · Metrics `GET /metrics`

---

## API topology

| Type | Prefix / path | Auth |
|------|---------------|------|
| REST | `/api/v1/*` | JWT Bearer default; `@Public()` opt-out |
| Socket.IO | namespace `/events` | JWT in `auth.token` handshake |
| Health | `/api/v1/health`, `/live`, `/ready` | Public |
| Metrics | `/metrics` | Optional `METRICS_SCRAPE_TOKEN` |
| Swagger | `/api/docs` | Dev only (`main.ts`) |

No GraphQL. Single version `v1` — no v2 deprecation policy documented.

---

## Naming & consistency

- Controllers follow Nest resource naming (`videos`, `streams`, `users`).
- Public shapes documented in `docs/API_SCHEMAS.md`; mappers in `*.mapper.ts`.
- Envelope: `{ success, data }` via `TransformInterceptor`.

**Gap:** Some routes on root vs prefixed controllers — documented in FORGE_PROJECT_MASTER §20.

---

## Security controls (API layer)

| Control | Implementation |
|---------|----------------|
| Global guards | `JwtAuthGuard` → `RolesGuard` → `ConsumerOnlyGuard` → `PermissionsGuard` → `ThrottlerGuard` → `EmailVerifiedGuard` |
| Validation | `ValidationPipe` whitelist + forbidNonWhitelisted (`main.ts:74-80`) |
| Admin isolation | `ConsumerOnlyGuard` — admin JWT blocked on consumer APIs |
| Public DTO strip | `video.mapper.ts` — hides `s3Key`, `muxAssetId`, etc. |
| Playback URLs | `playback-url.util.ts`, `mux-playback.util.ts` allowlist |
| Mux webhooks | `rawBody: true`; signature verification in `streaming.controller.ts` |

---

## Rate limiting

| Layer | Config |
|-------|--------|
| Global | `@nestjs/throttler` — default from `RATE_LIMIT_TTL` / `RATE_LIMIT_MAX` (~100/min) |
| Auth | Stricter `@Throttle` on forgot-password, login (`auth.controller.ts`) |
| Uploads | 20–120/min on video endpoints (`videos.controller.ts`) |
| Analytics | 120/min (`analytics.controller.ts`) |
| Stream chat | Redis slow-mode per user (`stream-chat.service.ts`) — not HTTP throttle |

**F-301:** `express-rate-limit` removed — Throttler only.

---

## Pagination

| Endpoint family | Pattern |
|-----------------|---------|
| Feed | Cursor-based base64url (`feed.service.ts`) |
| Comments / notifications | Offset/limit — verify caps in controllers |
| Admin lists | Query params — ensure max limit enforced |

**Recommendation:** Audit all `take`/`limit` query params for upper bound (e.g. max 50) to prevent abuse.

---

## Error handling

- `GlobalExceptionFilter` — no stack traces to clients on 500
- Structured codes on auth (`ACCOUNT_DISABLED`, etc.)
- Sentry capture when `SENTRY_DSN` set

---

## Versioning & breaking changes

- Only `/api/v1` — **gap:** no written deprecation timeline
- Shared contracts in `@forge/shared-types` — mobile/web must bump together

---

## WebSocket health

- Redis adapter required in production for multi-instance
- CORS aligned via `socket-cors.util.ts`
- Events typed in `@forge/shared-types` `SocketEvents`

---

## Findings

### F-601: No API versioning policy — **Resolved (Wave 4)**

| Field | Value |
|-------|-------|
| **Severity** | Medium (velocity) |
| **Evidence** | Single global prefix `api/v1` |
| **Resolution** | [API_SCHEMAS.md](../API_SCHEMAS.md) § API versioning — v1 stability, 90-day deprecation, shared-types lockstep |
| **Expected impact** | Safer mobile/web parallel releases |

### F-602: Pagination caps not centrally enforced — **Resolved (Wave 1)**

| Field | Value |
|-------|-------|
| **Severity** | Medium (performance) |
| **Evidence** | Various controllers — unbounded `limit` |
| **Resolution** | `pagination.util.ts` `clampLimit` max 50 |
| **Expected impact** | Prevents expensive list queries |

### F-603: Optional JWT on hot public routes

| Field | Value |
|-------|-------|
| **Severity** | Info |
| **Evidence** | `OptionalJwtAuthGuard` on feed/search/streaming |
| **Recommendation** | Keep — enables personalization without forcing login |
| **Expected impact** | Good UX; ensure optional path still uses cache |
