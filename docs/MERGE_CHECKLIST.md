# Merge checklist — platform audit (phases 0–7)

Use before merging the production-hardening branch to `main`.

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
4. **Production secrets** (Fly API + worker): strong `JWT_*`, `MUX_WEBHOOK_SECRET`, same `DATABASE_URL` / Redis / AWS as API.
5. **Do not** set `ENABLE_VIDEO_WORKER` on API machines.
6. **Smoke production:** `FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 FORGE_SMOKE_MODE=public npm run smoke:api`

## Optional toggles

| Env | Effect |
|-----|--------|
| `METRICS_ENABLED=true` | `GET /metrics` |
| `FEATURE_FLAGS=multipart_upload` | Large video multipart |
| `OTEL_EXPORTER_OTLP_ENDPOINT=...` | Distributed tracing |
| `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` (GitHub) | Authenticated Playwright in CI |

Full log: [PLATFORM_AUDIT_REMEDIATION.md](./PLATFORM_AUDIT_REMEDIATION.md).
