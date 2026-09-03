# FORGE Fresh Audit — Master Synthesis (2026-09-03)

**Audience:** Engineering, product, leadership.  
**Type:** Zero-trust re-audit (independent research + live code).  
**Supersedes:** [FRESH_AUDIT_2026-09_MASTER.md](./FRESH_AUDIT_2026-09_MASTER.md) (2026-09-02) in full.  
**Product SSOT:** [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md)  
**Roadmap:** [FORGE_IMPLEMENTATION_ROADMAP.md](../FORGE_IMPLEMENTATION_ROADMAP.md)  
**ADRs:** [docs/decisions/](../decisions/)

The 2026-09-02 pass is treated as an **untrusted candidate**. Findings below were re-derived from `apps/api`, `apps/web`, `apps/admin`, `apps/mobile`, Fly/Vercel configs, and external research (YouTube mechanics, Skillshare courses, Patreon/Twitch monetization, Google CSAI Match / NCMEC, two-stage recommenders).

---

## 1. Executive summary

FORGE is a **production-deployed** skill-first creator platform with YouTube-parity video mechanics (Mux VOD/live, Stripe Connect code, Postgres FTS, SQL recommendations, NestJS + BullMQ + Flutter).

**What Sep 2 got right:** product framing (skill-first), granular flags, Mux-in-prod, no ads, FTS-first, SQL recs until scale, CSAM as the real launch blocker.

**What Sep 2 got wrong or left stale:**

- Claimed course-aware recs (P4) — **not in code** until this pass.
- Master §16: mobile playlists ⏳, reports missing, FCM web missing, gamification UI ✅ — **incorrect vs code**.
- Tracker % conflict (96.6 vs 92.0 vs 86.3) treated as SSOT.
- `DEPLOY.md` still described **2 always-on API machines**; `fly.toml` is cost-first **1 machine + auto-stop**.
- `audits/README.md` still pointed at July masters and a 2026-09-04 re-audit.
- Agent rule `forge-youtube-replica` still told agents to **remove FORGE-unique divergences** (approval gate, rooms, skill modules).
- Dual RBAC listed as something to “consolidate XL” — **wrong**; keep two planes (ADR-014).

**Critical remaining (cannot close in git):** vendor CSAM integration; Stripe **live** secrets/Connect checklist; quarterly Neon drill (due 2026-10-22); designated DMCA agent filing.

---

## 2. Stack decisions (revalidated)

| Topic | Decision | ADR / note |
|-------|----------|------------|
| Product | Skill-first + YouTube mechanics | ADR-001 |
| Auth | Custom JWT + Postgres sessions; **not** Firebase Auth. Firebase = FCM / App Check | AUTH.md |
| Media | Mux required in production; S3 upload; FFmpeg local/low-volume only | env-production.schema |
| DB | Neon Postgres + pooler; TypeORM (~84 entities) | ADR-013 adjacent |
| Search | Postgres FTS | ADR-010 |
| Recs | SQL heuristics + course boost; pgvector at 100K MAU | ADR-008 |
| Billing | Stripe Connect destination charges; no ads | ADR-005 |
| Compute | Fly API+worker `sin`; Vercel web/admin; Redis Cloud | ADR-013 |
| Scan | Webhook plugin; vendor TBD; prod noop requires ack | ADR-009, ADR-012 |

---

## 3. Domain validation matrix (25)

| # | Domain | Doc (pre-pass) | Code reality | Gap | Severity | Phase |
|---|--------|----------------|--------------|-----|----------|-------|
| 1 | Product vision | Mixed YouTube vs skill | Strategy + flags match skill-first | Agent-rule conflict | Fixed this pass | R0 |
| 2 | User/creator/admin flows | Claimed complete | Signup→watch, apply→approve→upload, report→admin: **complete**. Mobile Studio live depth shipped | Copilot gated | Low | R2 |
| 3 | Architecture | Nest + workers | 37 modules; workers **not** on prod API replicas | Worker SPOF accepted | Medium | R4 |
| 4 | Data models | TypeORM | 84 entities; course tables always present | Trending CTE index | Low–med | R3 |
| 5 | APIs | Broad | `/api/v1`; skill 410 when flags off | Community path sprawl | Low | — |
| 6 | Web | Deep Studio | ~87 pages; skill gated via `/platform/config` | SEO mostly shipped | Low | R2/R5 |
| 7 | Mobile | §16 ⚠️/⏳ | Playlists **shipped**; reports **shipped**; Studio playlists + upload-reliability + analytics-details + go-live parity | Copilot gated | Low | R2 |
| 8 | Video pipeline | Mux prod | Mux required; LiveKit optional egress | Scan noop on ready | **Critical** | R1 |
| 9 | Search | FTS + course type | FTS videos/channels/playlists; courses via discover API | No course FTS | Low | R3 |
| 10 | Recs/feeds | “Course-aware P4” | SQL; course enrollment boost shipped this pass | Quality vs YouTube ML | Medium | R3 |
| 11 | Creator tools | Studio + KPIs | Web Studio deep; mobile Studio live/analytics depth shipped | Copilot | Low | R2 |
| 12 | Engagement | Comments/likes/subs | Shipped web+mobile | — | Low | — |
| 13 | Notifications | FCM + digest | In-app + FCM worker + email digest | Scan-hold notify shipped | Low | R1 |
| 14 | AuthN/Z | MFA, JWT, OAuth | TOTP; Google OAuth; dual RBAC | Dual system is correct | Low | R4 |
| 15 | Monetization | Stripe; no ads | Real Connect code; `BILLING_PROVIDER=stripe` in fly.toml; keys ops | Live cutover | Medium | R1 |
| 16 | Moderation | Strikes, DMCA | Shipped; held videos in admin `/content` | CSAM vendor | **Critical** | R1 |
| 17 | Security/privacy | MFA, DSAR | Export/delete + purge worker; App Check off by default | CMP/App Check ops | Medium | R4 |
| 18 | Cloud/DevOps | “2 API machines” | **1** machine, auto-stop, rolling | Doc drift | Medium | R4 |
| 19 | Scalability | SCALE_* | **Proposed only** | Don’t build yet | Low | R4 |
| 20 | Cache/queues | Redis + BullMQ | Many workers; single consumer | SPOF accepted | Medium | R4 |
| 21 | Observability | Sentry, Prom | Health + metrics token required | contentScan honesty | Low | R1 |
| 22 | Backup/DR | PITR drilled 2026-07-22 | 24h retention; next 2026-10-22 | Cadence | Medium | R1 |
| 23 | Testing/QA | API strong | ~209 API specs; Playwright smoke; admin mod skipped | Load evidence on staging | Low | R1 |
| 24 | SEO/a11y | Partial | sitemap live/courses; Shorts/live/search + `/live/[id]` metadata; discover a11y smoke | VoiceOver skill screens | Low | R2/R5 |
| 25 | Cost | Sep 1 audit | Matches 1 VM; audit said bluegreen vs rolling drift | Doc | Low | R4 |
| — | Extensibility | Flags | Granular `FEATURES_*` | LMS UI temptation | Low | ADR-006/007 |

---

## 4. Risk register

| ID | Risk | Severity | Mitigation | Owner | Trigger |
|----|------|----------|------------|-------|---------|
| R-01 | CSAM scan noop | **Critical** | Vendor + webhook; until then `CONTENT_SCAN_ALLOW_NOOP` | Legal + eng | Open UGC launch |
| R-02 | Skill UI missing | **Resolved** | Flag-gated UI shipped | — | — |
| R-03 | Courses absent from search | **Resolved** | `type=course` | — | — |
| R-04 | Mobile outside CI | **Resolved** | `ci.yml` Flutter job | — | — |
| R-05 | FTS at scale | Medium | F-1302 Meili | Platform | 500K videos / p95 |
| R-06 | Worker SPOF | Medium | Accepted MVP; scale after idempotency | DevOps | Queue backlog |
| R-07 | Dual authz “bug” | **Closed** | Keep two planes (ADR-014) | — | — |
| R-08 | Neon pool | Low | PgBouncer; `DB_POOL_MAX` | DevOps | connection errors |
| R-09 | Stripe live keys | Medium | Runbook | Ops | Go-live monetization |
| R-10 | Doc sprawl | Low | This hierarchy + archive | Docs | Ongoing |
| R-11 | API auto-stop cold start | Medium | Accepted; HA rollback in FLY_SLO | DevOps | p95 / live |
| R-12 | Recs quality | Medium | SQL + course boost; pgvector at 100K MAU | Platform | MAU / metrics |
| R-13 | App Check off | Medium | Flag + Firebase | Ops | Abuse on auth |
| R-14 | Stale DEPLOY HA claims | **Fixed this pass** | Align with fly.toml | Docs | — |

---

## 5. Decision outcomes vs Sep 2

All ADR-001–011 **re-accepted** with stronger evidence. **New:** ADR-012 (noop ack), ADR-013 (cost-first Fly), ADR-014 (keep dual RBAC).

Overturned *operational* claims: DEPLOY HA, recs course-awareness, §16 playlists/reports/FCM/gamification UI, dual-RBAC-as-debt, audits/README latest pointer.

---

## 6. Documentation actions (this pass)

| Action | Status |
|--------|--------|
| Rewrite product strategy, roadmap R0–R5, ADRs 001–014 | ✅ |
| New master audit (this file) | ✅ |
| Archive pre-Sep audits | ✅ |
| Supersede Sep 2 audit | ✅ |
| Fix `docs/README`, `audits/README`, `operations/README` | ✅ |
| Reconcile tracker % — Master §16 is status SSOT | ✅ |
| Agent rules: youtube-replica mechanics-only | ✅ |
| Domain docs: CONTENT_SCANNING, AUTH dual RBAC, DEPLOY, AI-LLM link | ✅ |
| R1–R5 in-repo engineering (scan gate, Studio mobile, FCM, SEO, health honesty) | ✅ |
| Ops/legal launch blockers (vendor, Stripe live, Neon drill, USPTO) | Open — not closable from git |

---

## 7. Next re-audit trigger

**50K MAU** or **2026-12-01**, whichever first — or immediately if a CSAM vendor or multi-region failover is chosen.

---

*Zero-trust re-audit completed 2026-09-03. Ground-truthed against live modules, `fly.toml`, and independent YouTube/skill-platform research. In-repo follow-through completed same day; production readiness awaits ops/legal R1.*
