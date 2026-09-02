# FORGE documentation

**Repo:** [Forge-Studios-dev/FORGE](https://github.com/Forge-Studios-dev/FORGE)

All project documentation lives in `docs/`. Start with **[FORGE_PRODUCT_STRATEGY.md](./FORGE_PRODUCT_STRATEGY.md)** for product direction, then **[FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)** for modules, routes, workers, and feature status.

---

## Essential docs

| Doc | Use |
|-----|-----|
| [FORGE_PRODUCT_STRATEGY.md](./FORGE_PRODUCT_STRATEGY.md) | **Product SSOT** — skill-first + YouTube mechanics |
| [FORGE_IMPLEMENTATION_ROADMAP.md](./FORGE_IMPLEMENTATION_ROADMAP.md) | Phased delivery plan (P0–P6) |
| [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) | **Technical SSOT** — modules, routes, entities, status matrix |
| [decisions/](./decisions/) | Architecture decision records (ADR-001–011) |
| [audits/FRESH_AUDIT_2026-09_MASTER.md](./audits/FRESH_AUDIT_2026-09_MASTER.md) | Latest zero-trust re-audit |
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
| [MEMBERSHIPS.md](./MEMBERSHIPS.md) | Tiers, Stripe Connect, entitlements, access sessions |
| [FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md](./FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md) | Task-level CEOS tracker (reconcile with product strategy; not primary SSOT) |
| [FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md](./archive/FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md) | **Archived** frozen blueprint |
| [AI-LLM-STRATEGY.md](./AI-LLM-STRATEGY.md) | AI/LLM audit, provider selection, architecture & rollout plan |
| [DESIGN.md](./DESIGN.md) | Design system & Stitch blueprints |
| [CLIENT_OVERVIEW.md](./CLIENT_OVERVIEW.md) | Stakeholder summary |
| [LEGAL.md](./LEGAL.md) | Terms & privacy |
| [COPYRIGHT_DMCA.md](./COPYRIGHT_DMCA.md) | DMCA notice/counter-notice pipeline, account strike ladder |
| [QA.md](./QA.md) | Test matrix |

**Env templates:** `apps/api/.env.example` · `apps/web/.env.example` · `apps/admin/.env.example`

---

## Platform research (YouTube-parity audit, 2026-08)

Cross-domain research auditing FORGE against YouTube (+ secondary creator platforms) across 8 domains, ground-truthed against the live codebase. Start with the audit summary; see the roadmap for sequencing.

| Doc | Use |
|-----|-----|
| [platform-research/skill-first-positioning.md](./platform-research/skill-first-positioning.md) | Competitive positioning, non-goals, stack validation |
| [PLATFORM_AUDIT_2026-08-09.md](./PLATFORM_AUDIT_2026-08-09.md) | Aug 2026 cross-domain audit (partially superseded by Sep re-audit) |
| [YOUTUBE_PARITY_ROADMAP.md](./YOUTUBE_PARITY_ROADMAP.md) | Historical MVP closure notes — see [FORGE_IMPLEMENTATION_ROADMAP.md](./FORGE_IMPLEMENTATION_ROADMAP.md) |
| [platform-research/product-vision-data-model.md](./platform-research/product-vision-data-model.md) | Product vision, personas, core data model (User/Channel/Follow/Video/Community) |
| [platform-research/upload-media-pipeline.md](./platform-research/upload-media-pipeline.md) | Upload, transcode, captions, live streaming pipeline |
| [platform-research/discovery-search-recommendations.md](./platform-research/discovery-search-recommendations.md) | Search, recommendations, trending, taxonomy |
| [platform-research/engagement-social.md](./platform-research/engagement-social.md) | Comments, likes, subscriptions, notifications, communities |
| [platform-research/creator-monetization-analytics.md](./platform-research/creator-monetization-analytics.md) | Memberships, Super Thanks, payouts, creator analytics/KPIs |
| [platform-research/moderation-safety-admin.md](./platform-research/moderation-safety-admin.md) | Reports, moderation, admin tooling, trust & safety |
| [platform-research/infra-scalability-reliability.md](./platform-research/infra-scalability-reliability.md) | Scaling, storage/CDN, DB, DR, observability, cost |
| [platform-research/security-privacy-compliance.md](./platform-research/security-privacy-compliance.md) | Auth/MFA, privacy/DSAR, RBAC, accessibility, compliance |

---

## Operations & audits

| Doc | Use |
|-----|-----|
| [operations/README.md](./operations/README.md) | Runbooks index |
| [operations/DISASTER_RECOVERY.md](./operations/DISASTER_RECOVERY.md) | Restore drill log, rollback procedures |
| [audits/DEFERRED_BACKLOG.md](./audits/DEFERRED_BACKLOG.md) | Tracked post-audit items |
| [audits/NEON_COST.md](./audits/NEON_COST.md) | Neon billing audit — monitoring & connection budget |
| [audits/INFRASTRUCTURE_COST_AUDIT_2026-06.md](./audits/INFRASTRUCTURE_COST_AUDIT_2026-06.md) | Full infra/cost audit + shipped optimizations |
| [audits/SOCIAL_PLATFORM_AUDIT_2026-06.md](./audits/SOCIAL_PLATFORM_AUDIT_2026-06.md) | Social features audit + implementation |
| [audits/EXECUTIVE_SUMMARY.md](./audits/EXECUTIVE_SUMMARY.md) | Closed 2026-06 enterprise audit summary |
| `../FORGE_Production_Readiness_Audit.docx` (repo root, untracked) | External production-readiness audit, 2026-07-12 (score 65/100). All 4 Critical findings resolved as of 2026-07-22: mobile Android/iOS scaffolding shipped, exposed AWS/Google OAuth credentials rotated, Neon PITR restore drill executed and logged. |

Enterprise audit **closed** 2026-06-05. **Re-audit completed** 2026-09-02 ([FRESH_AUDIT_2026-09_MASTER.md](./audits/FRESH_AUDIT_2026-09_MASTER.md)). Next: 50K MAU or 2026-12-01.

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
| Product direction | `FORGE_PRODUCT_STRATEGY.md` + `docs/decisions/` |
| New module or route | `FORGE_PROJECT_MASTER.md` §4 + §20 |
| Live / streaming feature | `LIVE.md` + `FORGE_PROJECT_MASTER.md` §20 |
| AI / LLM feature | `AI-LLM-STRATEGY.md` + master tracker Phase 12 (`CEOS-P12-*`) |
| Channel points / gamification | `FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md` + `FORGE_PROJECT_MASTER.md` §4 |
| Community / Creator Economy task | `FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md` (update task status on merge) |
| Public response shape | `API_SCHEMAS.md` + `@forge/shared-types` |
| Feature status snapshot | `FORGE_PROJECT_MASTER.md` §16 + master tracker + `CLIENT_OVERVIEW.md` |

*Do not add new top-level doc files without updating this index.*
