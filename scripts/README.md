# Scripts

Run from **repository root** unless noted.

| Script | NPM alias | Purpose |
|--------|-----------|---------|
| `setup-local-demo.sh` | — | Docker Postgres/Redis + API seed |
| `reset-demo-users.sh` | — | Reset demo user roles/passwords |
| `wipe-platform-data.sh` | `FORGE_WIPE_CONFIRM=yes` | Wipe DB + S3 + Redis and re-seed demo users |
| `flush-redis.sh` | `FORGE_FLUSH_CONFIRM=yes` | Flush all Redis keys (cache + BullMQ) |
| `ci-local.sh` | `npm run ci` | Same checks as `.github/workflows/ci.yml` |
| `smoke-api.sh` | `npm run smoke:api` | Health + auth smoke against API |
| `check-production.sh` | `npm run check:production` | Prod smoke + metrics + Grafana ingest |
| `verify-grafana-metrics.sh` | `npm run verify:grafana-metrics` | Query Grafana for `forge_http_requests_total` |
| `verify-production-ready.sh` | `npm run verify:production` | Pre-deploy env checklist (JWT, worker, Redis) |
| `neon-db-setup.sh` | `npm run db:neon:setup` | Neon migrate + seed |
| `redis-test.sh` | `npm run redis:test` | Redis connectivity |
| `fly-setup.sh` | `npm run deploy:fly` | First-time / update Fly API app |
| `fly-worker-setup.sh` | `npm run deploy:fly:worker` | Fly worker app (FFmpeg / BullMQ, `WORKER_ONLY`) |
| `sync-fly-worker-secrets.sh` | `npm run sync:fly:worker-secrets` | Copy secrets from API Fly app → worker |
| `setup-fly-metrics-token.sh` | `npm run setup:fly:metrics-token` | Generate/set `METRICS_SCRAPE_TOKEN` on Fly API |
| `configure-grafana-metrics-scrape.sh` | `npm run configure:grafana-scrape` | Print Grafana scrape job values (token from Fly) |
| `import-grafana-dashboard.sh` | `npm run import:grafana-dashboard` | Import API dashboard (`GRAFANA_SA_TOKEN`) |
| `import-grafana-alerts.sh` | `npm run import:grafana-alerts` | Provision Grafana alert rules |
| `verify-grafana-alerts.sh` | `npm run verify:grafana-alerts` | Confirm alert rules exist |
| `verify-metrics-scrape.sh` | `npm run verify:metrics-scrape` | Check `/metrics` 401/200 + forge_http_* |
| `discover-grafana-cloud.sh` | `npm run discover:grafana-cloud` | Stack + Connections URLs (`GRAFANA_CLOUD_*` token) |
| `create-grafana-scrape-job.sh` | `npm run create:grafana-scrape-job` | PUT scrape job (needs `GRAFANA_STACK_ID` + `glc_` token) |
| `vercel-setup.sh` | `npm run deploy:vercel` | Deploy web + admin to Vercel |
| `deploy-production-complete.sh` | `npm run deploy:production` | Fly + Vercel + DNS hints |
| `print-github-secrets.sh` | `npm run gh:secrets` | Print Vercel IDs; copy Fly token |
| `verify-platform-roles.sh` | `npm run verify:roles` | Role permission matrix |
| `sync-api-to-docker.sh` | — | Dev only: hot-sync API `dist/` into `forge-api` container |
| `package-for-sharing.sh` | — | Small ZIP for sharing (excludes `node_modules`, `.next`, `dist`; optional `--strip-local`) |

**CI/CD details:** [docs/CI_CD.md](../docs/CI_CD.md)

**Go-live:** [docs/MVP_GO_LIVE.md](../docs/MVP_GO_LIVE.md)
