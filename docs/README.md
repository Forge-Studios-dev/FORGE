# FORGE documentation

**Repo:** [Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

All project documentation lives in `docs/`. Start with **[FORGE_PRODUCT_STRATEGY.md](./FORGE_PRODUCT_STRATEGY.md)** (product SSOT), then **[FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)** (technical SSOT, including **§16 feature status**).

**Current audit:** [audits/FRESH_AUDIT_2026-09-03_MASTER.md](./audits/FRESH_AUDIT_2026-09-03_MASTER.md) (supersedes 2026-09-02).

---

## Essential docs

| Doc | Use |
|-----|-----|
| [FORGE_PRODUCT_STRATEGY.md](./FORGE_PRODUCT_STRATEGY.md) | **Product SSOT** — skill-first + YouTube mechanics |
| [FORGE_IMPLEMENTATION_ROADMAP.md](./FORGE_IMPLEMENTATION_ROADMAP.md) | **R0–R5** production roadmap |
| [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) | **Technical SSOT** — modules, routes, entities, §16 status |
| [decisions/](./decisions/) | ADRs (001–014) |
| [audits/FRESH_AUDIT_2026-09-03_MASTER.md](./audits/FRESH_AUDIT_2026-09-03_MASTER.md) | Latest zero-trust re-audit |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Local setup |
| [LIVE.md](./LIVE.md) | Live streaming |
| [API_SCHEMAS.md](./API_SCHEMAS.md) | Public JSON contracts |
| [DEPLOY.md](./DEPLOY.md) | Production deploy (must match `fly.toml`) |
| [CI_CD.md](./CI_CD.md) | GitHub Actions |
| [SCRIPTS.md](./SCRIPTS.md) | Repo scripts |
| [AUTH.md](./AUTH.md) | JWT sessions, OAuth, **dual RBAC** |
| [MEDIA.md](./MEDIA.md) | S3 + Mux |
| [CONTENT_SCANNING.md](./CONTENT_SCANNING.md) | Pre-publish scan (noop until vendor) |
| [FIREBASE.md](./FIREBASE.md) | FCM / App Check — not Auth |
| [OBSERVABILITY.md](./OBSERVABILITY.md) | Metrics, Sentry, Grafana |
| [MEMBERSHIPS.md](./MEMBERSHIPS.md) / [MONETIZATION.md](./MONETIZATION.md) | Stripe Connect; no ads |
| [CLIENT_OVERVIEW.md](./CLIENT_OVERVIEW.md) | Stakeholder snapshot (status → Master §16) |
| [LEGAL.md](./LEGAL.md) / [COPYRIGHT_DMCA.md](./COPYRIGHT_DMCA.md) | Legal + DMCA |
| [IMPLEMENTATION_PROMPTS.md](./IMPLEMENTATION_PROMPTS.md) | Agent task prompts → roadmap |
| [DESIGN.md](./DESIGN.md) | Design system |
| [AI-LLM-STRATEGY.md](./AI-LLM-STRATEGY.md) | LLM / recs later slice |
| [FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md](./FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md) | Historical CEOS tasks — **not** % SSOT |
| [archive/FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md](./archive/FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md) | Frozen blueprint |

**Env templates:** `apps/api/.env.example` · `apps/web/.env.example` · `apps/admin/.env.example`

---

## Research (context, not SSOT)

Aug 2026 research packs remain useful as **benchmarks**. Product decisions live in strategy + ADRs. Latest positioning: [platform-research/skill-first-positioning.md](./platform-research/skill-first-positioning.md).

| Doc | Use |
|-----|-----|
| [PLATFORM_AUDIT_2026-08-09.md](./PLATFORM_AUDIT_2026-08-09.md) | Historical — superseded |
| [YOUTUBE_PARITY_ROADMAP.md](./YOUTUBE_PARITY_ROADMAP.md) | Historical MVP notes |
| [platform-research/](./platform-research/) | Domain research (banners mark stale framing) |

`docs/phases/` and `docs/execution/` are **historical phase closeouts**, not the active roadmap.

---

## Operations & audits

| Doc | Use |
|-----|-----|
| [operations/README.md](./operations/README.md) | Runbooks index |
| [operations/DISASTER_RECOVERY.md](./operations/DISASTER_RECOVERY.md) | Neon PITR, rollback |
| [operations/STRIPE_PRODUCTION_ENABLEMENT.md](./operations/STRIPE_PRODUCTION_ENABLEMENT.md) | Live Stripe checklist |
| [operations/LOAD_TEST_RUNBOOK.md](./operations/LOAD_TEST_RUNBOOK.md) | Staging soak |
| [operations/FLY_SLO.md](./operations/FLY_SLO.md) | Cost-first Fly topology |
| [audits/README.md](./audits/README.md) | Audit index |
| [audits/DEFERRED_BACKLOG.md](./audits/DEFERRED_BACKLOG.md) | Trigger-gated items |
| [audits/COST_AUDIT_2026-09-01.md](./audits/COST_AUDIT_2026-09-01.md) | Latest cost audit |
| [audits/NEON_COST.md](./audits/NEON_COST.md) | Neon connection budget |

**Re-audit completed** 2026-09-03. Next: 50K MAU or 2026-12-01.

---

## Quick lookup

| Need | Where |
|------|-------|
| API modules | [FORGE_PROJECT_MASTER §4](./FORGE_PROJECT_MASTER.md#4-api-modules-mandatory-reference) |
| HTTP routes | [FORGE_PROJECT_MASTER §20](./FORGE_PROJECT_MASTER.md#20-api-route-catalog) |
| Feature status | [FORGE_PROJECT_MASTER §16](./FORGE_PROJECT_MASTER.md#16-feature-status-matrix) |
| BullMQ workers | [FORGE_PROJECT_MASTER §5](./FORGE_PROJECT_MASTER.md#5-background-workers-bullmq) |
| Live deploy | [LIVE.md](./LIVE.md) |

---

## Maintenance

| Change | Update |
|--------|--------|
| Product direction | `FORGE_PRODUCT_STRATEGY.md` + `docs/decisions/` + agent `forge-product` |
| New module or route | `FORGE_PROJECT_MASTER.md` §4 + §20 |
| Feature status | **Only** Master §16 + `CLIENT_OVERVIEW.md` (do not invent tracker %) |
| Live / streaming | `LIVE.md` + master §20 |
| Public response shape | `API_SCHEMAS.md` + `@forge/shared-types` |

*Do not add new top-level doc files without updating this index.*
