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
| [MEMBERSHIPS.md](./MEMBERSHIPS.md) | Tiers, Stripe Connect, entitlements, access sessions |
| [FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md](./FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md) | **Single source of truth** — 684 task-level items, 96.6% complete, gaps, roadmap, status |
| [FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md](../FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md) | **Historical/frozen** — self-describes as a frozen blueprint snapshot, not updated as tasks complete. Superseded as current guidance by [FORGE_PROJECT_MASTER.md §1](./FORGE_PROJECT_MASTER.md#1-executive-summary) + [PLATFORM_AUDIT_2026-08-09.md](./PLATFORM_AUDIT_2026-08-09.md). Kept for historical context only. |
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
| [PLATFORM_AUDIT_2026-08-09.md](./PLATFORM_AUDIT_2026-08-09.md) | Cross-domain executive summary — accepted YouTube-parity-core + extension-layer decision, consolidated gaps/conflicts, assumptions |
| [YOUTUBE_PARITY_ROADMAP.md](./YOUTUBE_PARITY_ROADMAP.md) | Phased build roadmap (MVP / post-MVP / future scale) with dependency ordering across domains |
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
| Live / streaming feature | `LIVE.md` + `FORGE_PROJECT_MASTER.md` §20 |
| AI / LLM feature | `AI-LLM-STRATEGY.md` + master tracker Phase 12 (`CEOS-P12-*`) |
| Channel points / gamification | `FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md` + `FORGE_PROJECT_MASTER.md` §4 |
| Community / Creator Economy task | `FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md` (update task status on merge) |
| Public response shape | `API_SCHEMAS.md` + `@forge/shared-types` |
| Feature status snapshot | `FORGE_PROJECT_MASTER.md` §16 + master tracker + `CLIENT_OVERVIEW.md` |

*Do not add new top-level doc files without updating this index.*
