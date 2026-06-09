# FORGE documentation

**Repo:** [Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

All project documentation lives in `docs/`. Start with **[FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)** for modules, routes, workers, and feature status.

---

## Essential docs

| Doc | Use |
|-----|-----|
| [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) | Modules, routes, design system, entities, status matrix |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Local setup |
| [LIVE.md](./LIVE.md) | Live streaming deploy, workers, capabilities |
| [API_SCHEMAS.md](./API_SCHEMAS.md) | Public JSON contracts |
| [DEPLOY.md](./DEPLOY.md) | Production deploy |
| [CI_CD.md](./CI_CD.md) | GitHub Actions & secrets |
| [SCRIPTS.md](./SCRIPTS.md) | Repo scripts reference |
| [AUTH.md](./AUTH.md) | Sessions & OAuth |
| [MEDIA.md](./MEDIA.md) | S3 + Mux |
| [FIREBASE.md](./FIREBASE.md) | FCM push |
| [OBSERVABILITY.md](./OBSERVABILITY.md) | Metrics, Sentry, Grafana |
| [MEMBERSHIPS.md](./MEMBERSHIPS.md) | Mock tiers |
| [DESIGN.md](./DESIGN.md) | Design system & Stitch blueprints |
| [CLIENT_OVERVIEW.md](./CLIENT_OVERVIEW.md) | Stakeholder summary |
| [LEGAL.md](./LEGAL.md) | Terms & privacy |
| [QA.md](./QA.md) | Test matrix |

**Env templates:** `apps/api/.env.example` · `apps/web/.env.example` · `apps/admin/.env.example`

---

## Operations & audits

| Doc | Use |
|-----|-----|
| [operations/README.md](./operations/README.md) | Runbooks index |
| [audits/DEFERRED_BACKLOG.md](./audits/DEFERRED_BACKLOG.md) | Tracked post-audit items |
| [audits/NEON_COST.md](./audits/NEON_COST.md) | Neon DB cost & monitoring |
| [audits/EXECUTIVE_SUMMARY.md](./audits/EXECUTIVE_SUMMARY.md) | Closed 2026-06 enterprise audit summary |

Enterprise audit **closed** 2026-06-05. Re-audit **2026-09-04** or 50K MAU.

---

## Quick lookup

| Need | Where |
|------|-------|
| API modules | [FORGE_PROJECT_MASTER §4](./FORGE_PROJECT_MASTER.md#4-api-modules-mandatory-reference) |
| HTTP routes | [FORGE_PROJECT_MASTER §20](./FORGE_PROJECT_MASTER.md#20-api-route-catalog) |
| BullMQ workers | [FORGE_PROJECT_MASTER §5](./FORGE_PROJECT_MASTER.md#5-background-workers-bullmq) |
| Live deploy | [LIVE.md](./LIVE.md) |

---

## Maintenance

| Change | Update |
|--------|--------|
| New module or route | `FORGE_PROJECT_MASTER.md` §4 + §20 |
| Live feature | `LIVE.md` + master §20 |
| Public response shape | `API_SCHEMAS.md` + `@forge/shared-types` |
| Feature status | Master §16 + `CLIENT_OVERVIEW.md` |

*Do not add new top-level doc files without updating this index.*
