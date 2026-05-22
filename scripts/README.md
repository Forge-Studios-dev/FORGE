# Scripts

Run from **repository root** unless noted.

| Script | NPM alias | Purpose |
|--------|-----------|---------|
| `setup-local-demo.sh` | — | Docker Postgres/Redis + API seed |
| `reset-demo-users.sh` | — | Reset demo user roles/passwords |
| `wipe-platform-data.sh` | `FORGE_WIPE_CONFIRM=yes` | Wipe DB + S3 + Redis and re-seed demo users |
| `flush-redis.sh` | `FORGE_FLUSH_CONFIRM=yes` | Flush all Upstash/Redis keys (cache + BullMQ) |
| `ci-local.sh` | `npm run ci` | Same checks as `.github/workflows/ci.yml` |
| `smoke-api.sh` | `npm run smoke:api` | Health + auth smoke against API |
| `neon-db-setup.sh` | `npm run db:neon:setup` | Neon migrate + seed |
| `upstash-redis-test.sh` | `npm run redis:upstash:test` | Upstash connectivity |
| `fly-setup.sh` | `npm run deploy:fly` | First-time / update Fly API app |
| `vercel-setup.sh` | `npm run deploy:vercel` | Deploy web + admin to Vercel |
| `deploy-production-complete.sh` | `npm run deploy:production` | Fly + Vercel + DNS hints |
| `print-github-secrets.sh` | `npm run gh:secrets` | Print Vercel IDs; copy Fly token |
| `verify-platform-roles.sh` | `npm run verify:roles` | Role permission matrix |
| `sync-api-to-docker.sh` | — | Dev only: hot-sync API `dist/` into `forge-api` container |

**CI/CD details:** [docs/CI_CD.md](../docs/CI_CD.md)

**Go-live:** [docs/MVP_GO_LIVE.md](../docs/MVP_GO_LIVE.md)
