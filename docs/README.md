# FORGE documentation

**Repo:** [Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

---

## Start here

| Document | Who | What |
|----------|-----|------|
| **[GETTING_STARTED.md](./GETTING_STARTED.md)** | Developers | Clone, env, run locally, demo logins |
| **[MVP_GO_LIVE.md](./MVP_GO_LIVE.md)** | DevOps | Deploy MVP (Vercel + Fly + Neon + Redis Cloud) |
| **[PRODUCTION_INFRASTRUCTURE_GUIDE.md](./PRODUCTION_INFRASTRUCTURE_GUIDE.md)** | DevOps / leads | Production stack choices, costs, step-by-step roadmap |
| **[PRODUCTION_UPGRADE_CHECKLIST.md](./PRODUCTION_UPGRADE_CHECKLIST.md)** | DevOps | Paid tiers, secrets, Fly/Neon/Redis upgrades (commands) |
| **[CI_CD.md](./CI_CD.md)** | DevOps | GitHub Actions workflows + secrets |
| **[mvp-test-matrix.md](./mvp-test-matrix.md)** | QA / dev | Test every role after deploy |
| **[CLIENT_OVERVIEW.md](./CLIENT_OVERVIEW.md)** | Clients | Executive summary to share |
| **[FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)** | All | Full product + technical spec |
| **[PLATFORM_AUDIT_REMEDIATION.md](./PLATFORM_AUDIT_REMEDIATION.md)** | Engineering | Production hardening phases 0–4 |
| **[OBSERVABILITY.md](./OBSERVABILITY.md)** | DevOps | Metrics, Sentry, OpenTelemetry, smoke tests |

**Typical path:** `GETTING_STARTED` → `MVP_GO_LIVE` → `mvp-test-matrix` → send `CLIENT_OVERVIEW` to client.

---

## By topic

| Topic | Document |
|-------|----------|
| CI/CD & GitHub secrets | [CI_CD.md](./CI_CD.md) · [scripts/README.md](../scripts/README.md) |
| Observability & E2E | [OBSERVABILITY.md](./OBSERVABILITY.md) |
| Video upload (S3 / multipart) | [VIDEO_UPLOAD.md](./VIDEO_UPLOAD.md) |
| Audit remediation log | [PLATFORM_AUDIT_REMEDIATION.md](./PLATFORM_AUDIT_REMEDIATION.md) |
| Auth, navigation & access control audit | [audits/README.md](./audits/README.md) |
| Auth & session architecture (implemented) | [AUTH_SESSION.md](./AUTH_SESSION.md) |
| Pre-merge checklist | [MERGE_CHECKLIST.md](./MERGE_CHECKLIST.md) |
| AWS S3 + Mux (upload & live) | [AWS_MUX_SETUP.md](./AWS_MUX_SETUP.md) |
| Custom domain (Vercel + Fly + Squarespace DNS) | [DOMAIN_FORGESTUDIOS.md](./DOMAIN_FORGESTUDIOS.md) |
| Production stack & roadmap | [PRODUCTION_INFRASTRUCTURE_GUIDE.md](./PRODUCTION_INFRASTRUCTURE_GUIDE.md) |
| Redis (Redis Cloud, Fly secrets) | [REDIS.md](./REDIS.md) |
| Production upgrade (Redis, Neon, secrets) | [PRODUCTION_UPGRADE_CHECKLIST.md](./PRODUCTION_UPGRADE_CHECKLIST.md) |
| Local ngrok / VPS only | [DEPLOYMENT_DEMO.md](./DEPLOYMENT_DEMO.md) |
| Remediation & deferred work | [mvp-audit.md](./mvp-audit.md) |
| Scale / vendor decisions | [phase4-platform-evaluation.md](./phase4-platform-evaluation.md) |
| Tools catalog | [Recommended_Things.md](./Recommended_Things.md) |
| UI/UX for design tools | [ui-ux-design-prompt-any-ai.md](./ui-ux-design-prompt-any-ai.md) |
| Root setup & API cheat sheet | [../README.md](../README.md) |

---

## Env templates

| File | Service |
|------|---------|
| `apps/api/.env.example` | Local API |
| `apps/api/.env.neon.example` | Neon Postgres |
| `apps/api/.env.redis-cloud.example` | Redis Cloud |
| `apps/web/.env.example` | Web |
| `apps/admin/.env.example` | Admin |

---

## Scripts

See **[scripts/README.md](../scripts/README.md)** for the full list.

```bash
bash scripts/setup-local-demo.sh   # Docker Postgres/Redis + seed
npm run ci                         # Local CI parity
npm run gh:secrets                 # GitHub Actions secret helper
npm run db:neon:setup              # Neon migrate + seed
npm run redis:test                 # Redis ping
npm run smoke:api                  # API health + auth smoke
npm run verify:roles               # Role permission matrix
```

---

## Repository map

```
apps/api/       NestJS + BullMQ (:3001)
apps/web/       Next.js (:3000)
apps/admin/     Next.js (:3002)
apps/mobile/    Flutter
packages/       shared-types, design-system
docs/           ← you are here
scripts/        automation (see scripts/README.md)
.github/workflows/  CI + Fly/Vercel deploy
fly.toml        Fly.io deploy
```

---

## When you change…

| Change | Update |
|--------|--------|
| Local setup | `GETTING_STARTED.md` |
| Cloud deploy | `MVP_GO_LIVE.md` |
| CI workflows or secrets | `CI_CD.md` + `.github/workflows/` |
| Product / features | `FORGE_PROJECT_MASTER.md` + `CLIENT_OVERVIEW.md` §4 |
| UI screens | `ui-ux-design-prompt-any-ai.md` |

*Last reviewed: 2026-05-21*
