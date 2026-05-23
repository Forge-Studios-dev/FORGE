# Merge checklist — platform audit (phases 0–8)

Use before merging the production-hardening branch to `main`.

## Production status (verified 2026-05-23)

| Check | Result |
|-------|--------|
| `https://api.forgestudios.net/api/v1/health` | 200 — db, redis, video queue ok |
| API Fly env | No `WORKER_ONLY` / `ENABLE_VIDEO_WORKER` |
| Worker Fly env | `WORKER_ONLY=true` |
| Public smoke | `FORGE_SMOKE_MODE=public npm run smoke:api:prod` |
| Prometheus | `METRICS_ENABLED=true` on API — `GET /metrics` |
| Multipart upload | `FEATURE_FLAGS=multipart_upload` on API (≥50MB uploads) |
| Release CI | API → worker secret sync (`flyctl`) → worker deploy → Vercel |

**Incident resolved:** Fly crash loop (`Cannot find module .../dist/main.js`) — fixed via `apps/api/docker-entrypoint.sh` and Nest dist path. Worker JWT boot failure — use `npm run sync:fly:worker-secrets`, not local `.env`.

**Video pipeline smoke (creator login required):** `npm run verify:video-pipeline:prod` with `FORGE_CREATOR_EMAIL` / `FORGE_CREATOR_PASSWORD`.

## Local verification

```bash
npm run ci                    # or: bash scripts/ci-local.sh
npm run verify:production     # with production-like apps/api/.env
npm run smoke:api             # API running locally
cd apps/web && npm run test:e2e
```

## Code review highlights

| Area | Key paths |
|------|-----------|
| Production boot guard | `apps/api/src/config/validate-production-config.ts` |
| Worker split | `fly.worker.toml`, `workers.module.ts`, `release.yml` deploy-worker |
| Feed cache (no Redis KEYS) | `feed.service.ts` |
| Async views / analytics | `view-count-flush.service.ts`, `analytics-ingest.worker.ts` |
| Multipart upload | `video-multipart.service.ts`, `upload-storage-multipart.ts`, `VIDEO_UPLOAD.md` |
| Feature flags | `packages/shared-types/src/feature-flags.ts`, `platform.controller.ts` |
| Observability | `forge-metrics.ts`, `infra/observability/`, `OBSERVABILITY.md` |
| Web E2E | `apps/web/e2e/`, `playwright.config.ts` |
| Cursor rules | `.cursor/rules/*.mdc` |

## After merge to `main`

1. **CI** must pass on `main`.
2. **Release workflow** deploys API → worker → Vercel (or run manually).
3. **First-time worker:** `npm run deploy:fly:worker` if `forge-studios-worker` does not exist.
4. **Worker secrets:** `npm run sync:fly:worker-secrets` (copies from running API machine; release workflow runs this before worker deploy).
5. **Production secrets** (Fly API + worker): strong `JWT_*`, `MUX_WEBHOOK_SECRET`, same `DATABASE_URL` / Redis / AWS as API.
6. **Do not** set `ENABLE_VIDEO_WORKER` on API machines.
7. **Smoke production:** `FORGE_SMOKE_MODE=public npm run smoke:api:prod`

## Optional toggles

| Env | Effect |
|-----|--------|
| `METRICS_ENABLED=true` | `GET /metrics` |
| `FEATURE_FLAGS=multipart_upload` | Large video multipart (enabled on prod API) |
| `OTEL_EXPORTER_OTLP_ENDPOINT=...` | Distributed tracing |
| `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` (GitHub) | Authenticated Playwright in CI |

Full log: [PLATFORM_AUDIT_REMEDIATION.md](./PLATFORM_AUDIT_REMEDIATION.md).
