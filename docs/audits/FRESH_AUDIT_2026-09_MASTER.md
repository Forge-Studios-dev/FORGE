# FORGE Fresh Audit — Master Synthesis (2026-09-02)

**Audience:** Engineering, product, leadership.  
**Type:** Zero-trust re-audit (docs + code + external research).  
**Product SSOT:** [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md)  
**Roadmap:** [FORGE_IMPLEMENTATION_ROADMAP.md](../FORGE_IMPLEMENTATION_ROADMAP.md)

---

## 1. Executive summary

FORGE is a **production-deployed** skill-first creator platform with YouTube-parity video mechanics. The Aug 2026 audit resolved product framing as “YouTube replica + retired skill layer”; **this re-audit supersedes that** per stakeholder direction: skill-first positioning with selective re-enablement of courses, mentorship, and channel points.

**Code reality:** 38 API modules, 123 migrations, Mux VOD on Fly, real Stripe Connect, Postgres FTS + heuristic recs. Skill modules ship behind granular `FEATURES_*` flags with web/mobile/admin UI restored (P2–P5, 2026-09).

**Doc reality:** 227+ markdown files with duplication (`docs/phases` vs `docs/execution`, 42 `prompt_docs`, frozen V3.0 blueprint). This audit consolidates hierarchy and archives stale material.

---

## 2. Product decision (closed)

| Prior (Aug 2026) | New (Sep 2026) |
|------------------|----------------|
| YouTube-replica core; skill LMS retired | Skill-first + YouTube mechanics |
| `FEATURES_SKILL_ECONOMY_LMS` monolithic off | Granular `FEATURES_COURSES`, `_MENTORSHIP`, `_CHANNEL_POINTS` |
| Category taxonomy → YouTube genres (open) | **Keep** skills/crafts taxonomy |

See [docs/decisions/](../decisions/).

---

## 3. Domain validation matrix (code-verified)

| Domain | Doc claims | Code reality | Gap severity |
|--------|------------|--------------|--------------|
| **Product** | YouTube-replica first (`MASTER` §1) | Skill modules gated; UI redirects | **Fixed** — strategy doc + ADR-001 |
| **Auth** | MFA, JWT, OAuth (`AUTH.md`) | TOTP shipped; creator approval gate | Low — docs accurate |
| **Video/media** | Mux prod path (`MEDIA.md`) | `VIDEO_TRANSCODE_PROVIDER=mux` on Fly | Low |
| **Discovery** | FTS + filters (phase 11) | Shipped; courses in `/search?type=course` + featured rails | **Resolved** — P4 |
| **Engagement** | Comments, shares, push prefs | Shipped | Low |
| **Monetization** | Stripe Connect real (`MONETIZATION.md`) | Destination charges; no ads | Low |
| **Moderation** | Strikes, DMCA, reports | Shipped Aug 2026 waves | Low |
| **Infra** | Fly API + worker, Vercel | Deployed; synthetic monitoring | Low |
| **Mobile** | Partial parity (`CLIENT_OVERVIEW`) | 148 lib files; outside npm CI | Medium — P5 |
| **Courses** | Retired UI | API + web/mobile/admin UI behind `FEATURES_COURSES` | **Resolved** — P2 |
| **Mentorship** | Retired UI | API + UI behind `FEATURES_MENTORSHIP` | **Resolved** — P3 |
| **Channel points** | Retired UI | API + UI behind `FEATURES_CHANNEL_POINTS` | **Resolved** — P3 |
| **Content scan** | Noop default | Webhook provider only | **Critical** pre-launch |

---

## 4. Gap analysis (25 areas)

| # | Area | Status | Gap / action |
|---|------|--------|--------------|
| 1 | Product requirements | ✅ Resolved | `FORGE_PRODUCT_STRATEGY.md` |
| 2 | User/creator/admin flows | ✅ Good | Skill module flows restored (flag-gated) |
| 3 | Architecture | ✅ Solid | NestJS + BullMQ + Socket.IO documented |
| 4 | Database/models | ✅ Solid | TypeORM 83 entities; no Prisma |
| 5 | APIs | ✅ Broad | Skill routes gated; granular flags shipped P1 |
| 6 | Frontend/web | ✅ Good | Courses/mentorship/points restored; flag-gated |
| 7 | Mobile | ✅ Good | Routes restored; Flutter CI in main workflow |
| 8 | Video pipeline | ✅ Production | Mux + S3 multipart |
| 9 | Search/discovery | ✅ Good | `type=course` in unified search + home/explore rails |
| 10 | Recommendations | ⚠️ MVP | SQL heuristics; no ML |
| 11 | Creator tools/analytics | ✅ Good | Studio + KPIs |
| 12 | Engagement | ✅ Good | Shares, moderation gates shipped |
| 13 | Auth/authz | ⚠️ Partial | Dual RBAC systems (platform vs community) |
| 14 | Notifications | ✅ Good | FCM + email digest |
| 15 | Monetization | ✅ Good | No ads by design |
| 16 | Moderation | ✅ Good | Strikes, DMCA, severity triage |
| 17 | Security/privacy | ⚠️ Partial | CSAM vendor missing; cookie consent shipped |
| 18 | Cloud/DevOps | ✅ Good | Fly + Vercel + CI |
| 19 | Scalability | ⚠️ Planned | LOAD_TEST deferred; SCALE_* docs exist |
| 20 | Caching/queues | ✅ Good | Redis + BullMQ workers |
| 21 | Observability | ✅ Good | Sentry, Prometheus, synthetic monitoring |
| 22 | Backup/DR | ⚠️ Cadence | Next Neon drill 2026-10-22 |
| 23 | Testing/QA | ⚠️ Partial | API strong; admin E2E deferred |
| 24 | SEO/a11y | ⚠️ Partial | Web ~80%; mobile a11y started |
| 25 | Cost optimization | ✅ Audited | `COST_AUDIT_2026-09-01.md` |

---

## 5. Risk register

| ID | Risk | Severity | Mitigation | Owner | Trigger |
|----|------|----------|------------|-------|---------|
| R-01 | CSAM/pre-publish scanning noop | **Critical** | Legal vendor + webhook provider | Legal + eng | Pre-launch |
| R-02 | Skill module UI absent | **Resolved** | P2–P3 shipped (flag-gated) | Product + eng | — |
| R-03 | Courses not in search/feed | **Resolved** | Search `type=course` + home rail | Platform | — |
| R-04 | Mobile outside npm CI | **Resolved** | Flutter job in `ci.yml` | Mobile lead | — |
| R-05 | Postgres FTS at scale | Medium | F-1302 Meilisearch | Platform | 500K videos / p95 degrade |
| R-06 | Worker SPOF | Medium | Scale worker replicas | DevOps | Queue backlog |
| R-07 | Dual authz systems | Medium | Document boundaries; consolidate XL | Security | New role features |
| R-08 | Neon connection budget | Low | PgBouncer, pool limits | DevOps | Connection errors |
| R-09 | Stripe prod cutover | Medium | `STRIPE_PRODUCTION_ENABLEMENT.md` | Ops | Go-live |
| R-10 | Doc sprawl / stale claims | Low | Archive + SSOT hierarchy | Docs | Ongoing |

---

## 6. Documentation actions completed

| Action | Status |
|--------|--------|
| Create `FORGE_PRODUCT_STRATEGY.md` | ✅ |
| Create `FORGE_IMPLEMENTATION_ROADMAP.md` | ✅ |
| Create `docs/decisions/` ADR-001–010 | ✅ |
| Create `platform-research/skill-first-positioning.md` | ✅ |
| Append re-audit 2026-09 to platform-research/* | ✅ |
| Archive stale audits/prompts/V3.0 | ✅ |
| Update `docs/README.md` hierarchy | ✅ |
| Rewrite agent rule `forge-product.mdc` | ✅ |
| Reconcile CEOS tracker header | ✅ |
| Granular feature flags (P1) | ✅ |

---

## 7. Stale doc corrections

| File | Issue | Fix |
|------|-------|-----|
| `CLIENT_OVERVIEW.md` | Skill layer “removed” | Updated to selective re-enable |
| `FORGE_PROJECT_MASTER.md` §1 | YouTube-replica only | Points to product strategy |
| `docs/README.md` | CEOS tracker as sole SSOT | Product + technical SSOT split |
| `YOUTUBE_PARITY_ROADMAP.md` | Superseded | Redirect note → implementation roadmap |
| Phase docs 11–21 | Some stale deferred lists | Refer to this audit §3 |

---

## 8. CEOS tracker reconciliation

Add/reopen task theme (manual tracker update):

- **CEOS-REAUDIT-P1:** Granular feature flags — ✅ shipped
- **CEOS-REAUDIT-P2:** Courses MVP web/mobile UI — ✅ shipped
- **CEOS-REAUDIT-P3:** Mentorship + channel points UI — ✅ shipped
- **CEOS-REAUDIT-P4:** Course discovery in search/feed — ✅ shipped
- **CEOS-REAUDIT-P5:** Mobile CI + Studio parity — ✅ CI shipped; Studio gaps tracked in DEPTH_BACKLOG
- **CEOS-REAUDIT-P6:** CSAM vendor integration

Mark Aug 2026 “sunset skill UI” decisions as **superseded** by ADR-001.

---

## 9. Next re-audit trigger

Per [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md): **50K MAU** or **2026-12-01** (quarterly cadence from this pass).

---

*Zero-trust re-audit completed 2026-09-02. Ground-truthed against `apps/api`, `apps/web`, `apps/mobile`, Fly/Vercel configs.*
