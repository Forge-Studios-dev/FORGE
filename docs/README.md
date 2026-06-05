# FORGE documentation

**Repo:** [Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

**Single source of truth for the whole product:** [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) — every API module, route (§20), worker queue, web/admin/mobile route, design system, Stitch blueprints, feature flags, entities, and status matrix.

---

## Enterprise audit — **closed** 2026-06-05

Full 14-phase technical audit (cost + scale lens): **[audits/README.md](./audits/README.md)** · [Completion checklist](./audits/AUDIT_COMPLETION.md) · [Deferred backlog](./audits/DEFERRED_BACKLOG.md) · Re-audit **2026-09-04** or 50K MAU

---

## Canonical docs (14 + blueprints folder)

| Doc | Use |
|-----|-----|
| [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) | **Mandatory reference** — modules, routes, blueprints, architecture |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Local setup |
| [CLIENT_OVERVIEW.md](./CLIENT_OVERVIEW.md) | Stakeholders |
| [API_SCHEMAS.md](./API_SCHEMAS.md) | Public JSON / forms |
| [DEPLOY.md](./DEPLOY.md) | Production deploy |
| [CI_CD.md](./CI_CD.md) | GitHub Actions |
| [MEDIA.md](./MEDIA.md) | S3 + Mux |
| [AUTH.md](./AUTH.md) | Sessions & OAuth |
| [FIREBASE.md](./FIREBASE.md) | FCM push |
| [OBSERVABILITY.md](./OBSERVABILITY.md) | Metrics & Sentry |
| [MEMBERSHIPS.md](./MEMBERSHIPS.md) | Mock tiers |
| [LEGAL.md](./LEGAL.md) | Terms & privacy |
| [QA.md](./QA.md) | Test matrix |
| [operations/README.md](./operations/README.md) | Mux cost ops, disaster recovery |
| [design/blueprints/README.md](./design/blueprints/README.md) | Stitch HTML exports |

**Env:** `apps/api/.env.example` · **Scripts:** [scripts/README.md](../scripts/README.md)

---

## Quick lookup

| Need | Section |
|------|---------|
| All API modules | [FORGE_PROJECT_MASTER §4](./FORGE_PROJECT_MASTER.md#4-api-modules-mandatory-reference) |
| Every HTTP route | [FORGE_PROJECT_MASTER §20](./FORGE_PROJECT_MASTER.md#20-api-route-catalog) |
| BullMQ workers | [FORGE_PROJECT_MASTER §5](./FORGE_PROJECT_MASTER.md#5-background-workers-bullmq) |
| Web routes | [FORGE_PROJECT_MASTER §9](./FORGE_PROJECT_MASTER.md#9-web-app-routes-appsweb) |
| Admin routes | [FORGE_PROJECT_MASTER §10](./FORGE_PROJECT_MASTER.md#10-admin-app-routes-appsadmin) |
| Mobile | [FORGE_PROJECT_MASTER §11](./FORGE_PROJECT_MASTER.md#11-mobile-app-appsmobile) |
| Design system + `/blueprints` | [FORGE_PROJECT_MASTER §8](./FORGE_PROJECT_MASTER.md#8-design-system--blueprints) |
| Entities / DB | [FORGE_PROJECT_MASTER §12](./FORGE_PROJECT_MASTER.md#12-data-model-entities) |

---

## Maintenance

| Change | Update |
|--------|--------|
| New module or route | `FORGE_PROJECT_MASTER.md` §4 + §20 |
| Public response shape | `API_SCHEMAS.md` + `@forge/shared-types` |
| Feature status | §16 + `CLIENT_OVERVIEW.md` |

*Do not add new top-level doc files without merging into the master or README index.*
