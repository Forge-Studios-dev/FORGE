# FORGE documentation

**Repo:** [Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

**13 docs** — everything else was consolidated here (2026-06-04).

---

## Start here

| Doc | Use |
|-----|-----|
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Local setup, demo logins |
| [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) | Architecture, modules, status |
| [CLIENT_OVERVIEW.md](./CLIENT_OVERVIEW.md) | Stakeholder summary |
| [API_SCHEMAS.md](./API_SCHEMAS.md) | Public API types & forms |

---

## Operations

| Doc | Use |
|-----|-----|
| [DEPLOY.md](./DEPLOY.md) | Go-live, Fly/Vercel/Neon, domain, Redis, upgrades |
| [CI_CD.md](./CI_CD.md) | GitHub Actions, secrets, pre-merge checks |
| [MEDIA.md](./MEDIA.md) | S3 upload, Mux live/VOD, worker |
| [AUTH.md](./AUTH.md) | Sessions, Google OAuth, SMTP enablement |
| [FIREBASE.md](./FIREBASE.md) | FCM push, FlutterFire (not Firebase Auth) |
| [OBSERVABILITY.md](./OBSERVABILITY.md) | Logs, metrics, Sentry, Grafana |
| [MEMBERSHIPS.md](./MEMBERSHIPS.md) | Mock tiers & gated content |
| [QA.md](./QA.md) | Role × flow test matrix |

---

## Env templates (not duplicated in markdown)

`apps/api/.env.example` · `apps/api/.env.neon.example` · `apps/api/.env.redis-cloud.example` · `apps/web/.env.example` · `apps/admin/.env.example`

**Scripts:** [scripts/README.md](../scripts/README.md)

---

## When you change…

| Change | Update |
|--------|--------|
| Architecture / features | `FORGE_PROJECT_MASTER.md` + `CLIENT_OVERVIEW.md` §4 |
| Public API shapes | `API_SCHEMAS.md` + `@forge/shared-types` |
| Deploy / infra | `DEPLOY.md` |
| Env vars | `apps/api/.env.example` |
