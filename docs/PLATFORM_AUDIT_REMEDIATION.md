# FORGE Platform Audit — Remediation Log

**Date:** 2026-05-23  
**Scope:** Phase 0 (production safety) + Phase 1 (hot-path scale) from senior engineering audit.

## Deployed in code

### Phase 0 — Production safety

| Item | Change |
|------|--------|
| JWT / Mux secrets | `validateProductionConfig()` fails boot in `NODE_ENV=production` if default JWT secrets or missing `MUX_WEBHOOK_SECRET` |
| Mux webhooks | Production rejects unconfigured verification; dev may run without secret |
| Feed cache | Replaced Redis `KEYS` with generation counter (`feed:cache:generation`, keys `feed:v4:g{n}:...`) |
| Redis TLS | Production verifies certificates by default; override with `REDIS_TLS_REJECT_UNAUTHORIZED=false` |
| Wipe script | Blocks `DATABASE_URL` matching production markers unless `FORGE_WIPE_ALLOW_PRODUCTION=yes` |
| Worker topology | `VideoProcessorWorker` only when `WORKER_ONLY=true` or `ENABLE_VIDEO_WORKER=true`; added `fly.worker.toml` |
| Proxy upload | Disabled in production unless `ALLOW_PROXY_UPLOAD=true` |

### Phase 1 — Hot paths & clients

| Item | Change |
|------|--------|
| View counts | Redis buffer + hourly dedupe per viewer; `ViewCountFlushService` flushes to Postgres every 60s |
| Analytics | `analytics-ingest` BullMQ queue + worker; API enqueues instead of sync INSERT |
| Auth | Signup email check uses normalized email; refresh-token reuse revokes all user sessions |
| JWT guards | Single user load in `JwtStrategy` → CLS; guards reuse snapshot |
| Socket.IO | `stream:*` events target `streams:live`, `stream:{id}`, `user:{id}`; web joins `join-live-feed` |
| Web watch | `RelatedVideos` rendered from server page; `VideoPlayer` lazy-loaded (`hls.js` code-split) |

## Manual ops (required for production)

1. **Fly worker app:** `fly apps create forge-studios-worker` → deploy with `fly deploy -c fly.worker.toml` and same secrets as API + `WORKER_ONLY=true`.
2. **API app:** Do **not** set `ENABLE_VIDEO_WORKER` on Fly API machines.
3. **Secrets:** Set strong `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MUX_WEBHOOK_SECRET` before `NODE_ENV=production`.
4. **Observability:** Enable `SENTRY_DSN` and `METRICS_ENABLED=true` (still recommended; not auto-enabled).

## Phase 2 (2026-05-23)

| Item | Change |
|------|--------|
| Feed DOM cap | `FeedGrid` uses TanStack `maxPages: 5` (60 cards), explore-more CTA |
| Query tuning | `refetchOnMount: false` on feed + ready watch videos |
| ISR | Home `revalidate=60`, explore `300` / `120` (removed `force-dynamic` on discovery shells) |
| Prometheus | `forge_http_requests_total` + `forge_http_request_duration_seconds` when `METRICS_ENABLED=true` |
| Release CI | `deploy-worker` job (`fly.worker.toml`), public `smoke-api.sh` after API deploy |
| Mobile CI | `flutter analyze` on `apps/mobile/**` changes |
| Admin UX | `error.tsx` + `not-found.tsx` |
| Smoke | `FORGE_SMOKE_MODE=public` for production (health, feed, search — no demo login) |

## Phase 3 (2026-05-23)

| Item | Change |
|------|--------|
| Feed virtualization | `@tanstack/react-virtual` row virtualizer in `FeedGrid` (window scroll, responsive columns) |
| Feature flags | `GET /api/v1/platform/config`, `FEATURE_FLAGS` / `NEXT_PUBLIC_FEATURE_FLAGS`, `@forge/shared-types` helpers |
| Trace correlation | W3C `traceparent` → CLS + pino `traceId` (OTel-ready without full SDK) |
| Playwright | `apps/web/e2e/smoke.spec.ts` + CI after web build |
| Creator errors | `studio/error.tsx`, `upload/error.tsx` |

## Phase 4 (2026-05-23)

| Item | Change |
|------|--------|
| S3 multipart upload | Flag `multipart_upload` + files ≥50MB → multipart session, part presigns, complete; web `upload-storage-multipart.ts` |
| OpenTelemetry | Optional OTLP via `OTEL_EXPORTER_OTLP_ENDPOINT` (`otel-bootstrap.ts`) |
| E2E auth | `e2e/auth.spec.ts` when `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` set |
| Observability doc | `docs/OBSERVABILITY.md` |

### Multipart API

- `POST /videos/presigned-url` → `{ uploadMode: 'multipart', partSize, partCount, ... }`
- `POST /videos/:id/multipart/parts` → presigned PUT URLs per part
- `POST /videos/:id/multipart/complete` → S3 `CompleteMultipartUpload`
- Then existing `POST /videos/:id/complete` for metadata + transcoding

## Phase 5 (2026-05-23) — docs & ops polish

| Item | Change |
|------|--------|
| Fly worker script | `scripts/fly-worker-setup.sh`, `npm run deploy:fly:worker` |
| Multipart session resume | `sessionStorage` tracks completed S3 parts per `videoId` |
| Docs | `GETTING_STARTED`, `docs/README`, `MVP_GO_LIVE` worker section |
| Gitignore | Playwright artifacts; allow committing `.cursor/rules/` |

## Phase 6 (2026-05-23) — resume, mobile, observability IaC

| Item | Change |
|------|--------|
| Multipart checkpoint | `GET .../multipart/progress`, `POST .../multipart/checkpoint` — Redis stores completed parts (24h) |
| Web resume | Merges sessionStorage + server progress before upload continues |
| Mobile multipart | `multipart_upload.dart` for files ≥50MB when API returns `uploadMode: multipart` |
| Grafana/Prometheus | `infra/observability/` scrape example, alerts, dashboard JSON |

## Ready to merge

See [MERGE_CHECKLIST.md](./MERGE_CHECKLIST.md) for local CI, review map, and post-merge deploy steps.

## Phase 7 (2026-05-23) — production polish

| Item | Change |
|------|--------|
| Video upload doc | `docs/VIDEO_UPLOAD.md` — single + multipart API flow |
| Multipart race fix | Web merges batch parts after workers finish (no shared `etags` mutation) |
| Smoke | `smoke-api.sh` checks `x-correlation-id`, `/metrics` |
| CI local | `ci-local.sh` runs `flutter analyze` when Flutter is installed |
| Master doc | §24.4 / §25.3 updated; root `README` links |

## Phase 8 (2026-05-23) — merge readiness

| Item | Change |
|------|--------|
| Merge checklist | `docs/MERGE_CHECKLIST.md` |
| Production config tests | `validate-production-config.spec.ts` |
| Release worker | Explicit `-a forge-studios-worker` in `release.yml` |

## Phase 9 (2026-05-23) — Fly production incident + ops

| Item | Change |
|------|--------|
| Docker entrypoint | `docker-entrypoint.sh` resolves `main.js` for Nest monorepo dist layout |
| Fly bind | `app.listen(port, '0.0.0.0')` |
| Socket.IO | Redis adapter on root IO server (`events.gateway.ts`) |
| Worker secrets | `sync-fly-worker-secrets.sh`, `npm run sync:fly:worker-secrets`; CI runs before worker deploy |
| Queue consumers | Production API enqueues only; `AnalyticsIngestWorker` + `VideoProcessorWorker` on worker app |
| Mux guard | `MUX_WEBHOOK_SECRET` required only when `MUX_TOKEN_ID` is set |

## Phase 10 (2026-05-23) — Grafana + release verification

| Item | Change |
|------|--------|
| Metrics format | `/metrics` returns raw Prometheus (not JSON wrapper) for Grafana scrape test |
| Grafana docs | `GRAFANA_SETUP.md` — correct Connections URL, example form, troubleshooting |
| Release CI | `verify-metrics-scrape` after API deploy |
| Ops | `npm run check:production` — smoke + metrics in one command |

## Phase 11 (2026-05-23) — Grafana ingest verification

| Item | Change |
|------|--------|
| Grafana verify | `verify-grafana-metrics.sh` — queries Cloud Prometheus for `forge_http_requests_total` |
| Production check | `check:production` runs Grafana verify when `GRAFANA_SA_TOKEN` is set |
| Secret rotation | `docs/SECRET_ROTATION.md` |

## Next phases

- **Rotate secrets** if any were shared outside a vault — `docs/SECRET_ROTATION.md`
- Persist multipart state in Postgres for audit / longer TTL
- Prod video pipeline E2E with real creator credentials

See `FORGE_PROJECT_MASTER.md` §31 and `docs/OBSERVABILITY.md`.
