# Scripts

Run from **repository root** unless noted.

## Core dev & CI

| Script | NPM alias | Purpose |
|--------|-----------|---------|
| `setup-local-demo.sh` | — | Docker Postgres/Redis + API seed |
| `reset-demo-users.sh` | — | Reset demo user roles/passwords |
| `bootstrap-local-auth.sh` | `auth:bootstrap` | Local Mailpit + auth env for email/OAuth testing |
| `wipe-platform-data.sh` | `FORGE_WIPE_CONFIRM=yes` | Wipe DB + S3 + Redis and re-seed demo users |
| `flush-redis.sh` | `FORGE_FLUSH_CONFIRM=yes` | Flush all Redis keys (cache + BullMQ) |
| `ci-local.sh` | `npm run ci` / `ci:local` | Same checks as `.github/workflows/ci.yml` |
| `sync-api-to-docker.sh` | — | Dev only: hot-sync API `dist/` into `forge-api` container |
| `package-for-sharing.sh` | — | Small ZIP for sharing (excludes `node_modules`, `.next`, `dist`; optional `--strip-local`) |

## Smoke & verification

| Script | NPM alias | Purpose |
|--------|-----------|---------|
| `smoke-api.sh` | `smoke:api` / `smoke:api:prod` | Health + auth smoke against API |
| `smoke-memberships.sh` | `smoke:memberships` / `smoke:memberships:prod` | Membership tier + mock subscribe smoke |
| `smoke-community-2.0.sh` | `smoke:community-2.0` | Community 2.0: multi-community, brands, business analytics (funnel + cohorts), courses, gamification, access sessions |
| `load-test-feed.sh` | `load-test:feed` | Staging feed/search/watch soak |
| `load-test-community.sh` | `load-test:community` | Community hot path |
| `load-test-entitlements.sh` | `load-test:entitlements` | Entitlements soak |
| `verify-neon-dr-checklist.sh` | `verify:neon-dr` | Neon DR checklist (+ optional `dr-db-verify.sh`) |

| `create-skill-platform-pr.sh` | `pr:skill-platform` | Create PR for `feature/skill-first-platform` (requires `gh auth login`) |

GitHub Actions: **Skill features smoke** (`workflow_dispatch` in `.github/workflows/skill-smoke.yml`) — run against staging/prod API after deploy; set `expect_flags=1` when courses must be on.
| `smoke-channel-sunset.sh` | — | Channel-sunset flow smoke (staging/prod) — see [operations/CHANNEL_SUNSET.md](./operations/CHANNEL_SUNSET.md) |
| `generate-ceos-tracker.py` | — | Regenerate `docs/FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md` (684 tasks) |
| `check-production.sh` | `check:production` | Prod smoke + metrics + Grafana ingest |
| `verify-production-ready.sh` | `verify:production` | Pre-deploy gate: runs authoritative env schema (`check:prod-env`) + infra/topology checks |
| `apps/api/scripts/check-production-env.ts` | `check:prod-env` | Authoritative prod env validation (same `validateProductionEnv` the API runs at boot) |
| `verify-platform-roles.sh` | `verify:roles` | Role permission matrix |
| `verify-video-pipeline.sh` | `verify:video-pipeline` / `verify:video-pipeline:prod` | VOD upload + Mux ingest smoke |
| `cleanup-stuck-videos.sh` | `cleanup:stuck-videos` | Mark stuck uploads for retry |
| `dr-db-verify.sh` | — | Post-restore DB integrity checks |

## Database & Redis

| Script | NPM alias | Purpose |
|--------|-----------|---------|
| `neon-db-setup.sh` | `db:neon:setup` | Neon migrate + seed |
| `neon-consumption-report.sh` | — | Monthly CU-hour / cost report (see [audits/NEON_COST.md](./audits/NEON_COST.md)) |
| `redis-test.sh` | `redis:test` | Redis connectivity |
| `load-test-entitlements.sh` | — | Entitlement-heavy load probe (requires running API) |
| `load-test-community.sh` | — | Community search/live read load probe — **staging only** |

## Deploy (Fly + Vercel)

| Script | NPM alias | Purpose |
|--------|-----------|---------|
| `fly-setup.sh` | `deploy:fly` | First-time / update Fly API app |
| `fly-worker-setup.sh` | `deploy:fly:worker` | Fly worker app (FFmpeg / BullMQ, `WORKER_ONLY`) |
| `sync-fly-worker-secrets.sh` | `sync:fly:worker-secrets` | Copy secrets from API Fly app → worker (includes `CONTENT_SCAN_*`) |
| `set-content-scan-secrets-fly.sh` | `set:fly:content-scan-secrets` | Set ADR-012 content-scan secrets (`ALLOW_NOOP` or webhook) on API + worker |
| `vercel-setup.sh` | `deploy:vercel` | Deploy web + admin to Vercel |
| `deploy-production-complete.sh` | `deploy:production` | Fly + Vercel + DNS hints |
| `fly-gcp-oidc-token.sh` | — | GCP OIDC token helper for Firebase WIF |

## Auth & Firebase

| Script | NPM alias | Purpose |
|--------|-----------|---------|
| `check-auth-env.sh` | `auth:check` / `auth:check:fly` | Validate auth env vars (local or Fly) |
| `deploy-auth-secrets.sh` | `auth:deploy` | Push Google/SMTP/Firebase secrets to Fly |
| `verify-production-auth.sh` | `auth:verify` | Post-deploy auth feature smoke |
| `audit-production-auth.sh` | — | Full production auth audit |
| `enable-production-auth-features.sh` | — | Enable auth-related Fly secrets |
| `push-auth-secrets-to-github.sh` | — | Sync auth secrets to GitHub Actions |
| `import-google-oauth-client.sh` | — | Import Google OAuth client JSON |
| `check-firebase-connection.sh` | `firebase:check` | Verify FCM admin SDK connectivity |
| `apply-firebase-service-account.sh` | — | Apply Firebase service account to Fly |
| `configure-mobile-firebase.sh` | — | Mobile Firebase config helper |
| `deploy-firebase-json-secret.sh` | — | Deploy Firebase JSON via Fly secret |
| `sync-vercel-firebase-env.sh` | — | Sync Firebase env to Vercel |

## Observability (Grafana / metrics)

| Script | NPM alias | Purpose |
|--------|-----------|---------|
| `setup-fly-metrics-token.sh` | `setup:fly:metrics-token` | Generate/set `METRICS_SCRAPE_TOKEN` on Fly API |
| `configure-grafana-metrics-scrape.sh` | `configure:grafana-scrape` | Print Grafana scrape job values (token from Fly) |
| `import-grafana-dashboard.sh` | `import:grafana-dashboard` | Import API dashboard (`GRAFANA_SA_TOKEN`) |
| `import-grafana-alerts.sh` | `import:grafana-alerts` | Provision Grafana alert rules |
| `verify-grafana-alerts.sh` | `verify:grafana-alerts` | Confirm alert rules exist |
| `verify-metrics-scrape.sh` | `verify:metrics-scrape` | Check `/metrics` 401/200 + forge_http_* |
| `verify-grafana-metrics.sh` | `verify:grafana-metrics` | Query Grafana for `forge_http_requests_total` |
| `discover-grafana-cloud.sh` | `discover:grafana-cloud` | Stack + Connections URLs (`GRAFANA_CLOUD_*` token) |
| `create-grafana-scrape-job.sh` | `create:grafana-scrape-job` | PUT scrape job (needs `GRAFANA_STACK_ID` + `glc_` token) |
| `set-sentry-secrets-fly.sh` | — | Set `SENTRY_DSN` on Fly API + worker |
| `set-sentry-vercel-env.sh` | — | Set Sentry DSN on Vercel web + admin |

## Third-party secrets (Fly)

| Script | NPM alias | Purpose |
|--------|-----------|---------|
| `set-mux-secrets-fly.sh` | — | Set Mux credentials on Fly |
| `set-resend-api-key-fly.sh` | — | Set Resend SMTP API key on Fly |
| `set-stripe-secrets-fly.sh` | — | Set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` on Fly — see [operations/STRIPE_PRODUCTION_ENABLEMENT.md](./operations/STRIPE_PRODUCTION_ENABLEMENT.md) |
| `set-channel-sunset-fly.sh` | — | Set channel-sunset feature flags/secrets on Fly — see [operations/CHANNEL_SUNSET.md](./operations/CHANNEL_SUNSET.md) |
| `setup-aws-forge.sh` | — | AWS S3 bucket + IAM setup |
| `fix-s3-cors.sh` | — | Fix S3 CORS for upload origins |

## GitHub secrets

| Script | NPM alias | Purpose |
|--------|-----------|---------|
| `print-github-secrets.sh` | `gh:secrets` | Print Vercel IDs; copy Fly token |
| `setup-github-secrets.sh` | `gh:secrets:set` | Push Fly + Vercel secrets to GitHub |

**CI/CD:** [CI_CD.md](./CI_CD.md) · **Deploy:** [DEPLOY.md](./DEPLOY.md)
