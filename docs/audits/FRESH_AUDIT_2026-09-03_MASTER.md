# FORGE Fresh Audit — Master Synthesis (2026-09-03)

**Audience:** Engineering, product, leadership.  
**Type:** Zero-trust re-audit (independent research + live code).  
**Supersedes:** [FRESH_AUDIT_2026-09_MASTER.md](./FRESH_AUDIT_2026-09_MASTER.md) (2026-09-02) in full.  
**Product SSOT:** [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md)  
**Roadmap:** [FORGE_IMPLEMENTATION_ROADMAP.md](../FORGE_IMPLEMENTATION_ROADMAP.md)  
**ADRs:** [docs/decisions/](../decisions/)  
**Extension:** 2026-09-03 evening — independent revalidation + SSOT hygiene (ledger §2a, gaps §4a). Sep 3 findings treated as *evidence*, not authority.

The 2026-09-02 pass is treated as an **untrusted candidate**. Findings below were re-derived from `apps/api`, `apps/web`, `apps/admin`, `apps/mobile`, Fly/Vercel configs, and external research (YouTube mechanics, Skillshare courses, Patreon/Twitch monetization, Google CSAI Match / NCMEC, two-stage recommenders). The evening extension re-checked ADRs and stack against live code without assuming prior acceptance.

---

## 1. Executive summary

FORGE is a **production-deployed** skill-first creator platform with YouTube-parity video mechanics (Mux VOD/live, Stripe Connect code, Postgres FTS, SQL recommendations, NestJS + BullMQ + Flutter).

**Architecture stance (revalidated):** A Google/YouTube-scale rewrite is **not** warranted at current stage. Keep the modular Nest monolith + Fly worker, Mux control-plane media path, Postgres FTS, and SQL recs. Document evolution triggers (Meili, pgvector, HA Fly, DRM) — do not build them early.

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

**Doc drift found in evening revalidation (hygiene pass):** dual-SSOT leftovers (Sep 2 audit body, Aug platform audit body, YouTube parity open-framing, CEOS “authoritative %”, DEPTH “Still open” ads/VAST vs ADR-005, stale Master footer / DEFERRED date).

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

## 2a. Revalidation ledger (2026-09-03 evening)

Zero-trust pass: each decision re-checked against live code + independent alternatives. **Keep** = strongest practical choice now. **Amend** = wording/docs only. **Overturn** = none this pass.

| ID | Decision | Verdict | Evidence (not “already approved”) |
|----|----------|---------|-----------------------------------|
| ADR-001 | Skill-first + YouTube mechanics | **Keep** | Vertical already in `Category`/`SkillTag`, approval gate, flag-gated courses; pure YouTube clone is commodity; Skillshare royalty pool ≠ Stripe Connect model already shipped |
| ADR-002 | Creator approval gate | **Keep** | Trust/safety for teaching vertical; YouTube open-upload is wrong default for skill marketplace; `CreatorApprovedGuard` wired on upload/live/billing |
| ADR-003 | Skills/crafts taxonomy | **Keep** | Migration to YouTube genres destroys differentiation and forces creator re-tag; seed + FTS already skill-shaped |
| ADR-004 | Rooms/events as extension | **Keep** | Posts/polls/tiers = Community tab core; rooms/events = Discord-shaped skill cohorts — labeled, not removed |
| ADR-005 | No ad network / RPM | **Keep** | Creator-owned Stripe Connect matches Patreon/Twitch-membership pattern; ads need sales, policy, VAST ops — DEPTH “Ad breaks/VAST” is **not** open product work |
| ADR-006 | Granular `FEATURES_*` | **Keep** | `skill-platform.ts` + `GET /platform/config`; fly.toml enables courses/mentorship/points; LMS master switch separate |
| ADR-007 | Courses = video-lesson MVP | **Keep** | Quizzes/cohorts stay behind `FEATURES_SKILL_ECONOMY_LMS`; Master CoursesModule listing quizzes is inventory of *backend*, not default UI |
| ADR-008 | SQL recs until ~100K MAU | **Keep** | Two-tower/ANN needs scale + labels (Covington→modern LRM); `recommendations.service.ts` multi-signal SQL + course boost is correct MVP |
| ADR-009 | CSAM vendor = launch gate | **Keep** | `NoopContentScanProvider` approves all; webhook plugin fail-closed exists — noop ≠ protection (CSAI Match / Thorn / NCMEC process) |
| ADR-010 | Postgres FTS first | **Keep** | `search.service.ts` tsvector/GIN; Meili/ES add sync+ops before ~500K videos / p95 regress (F-1302) |
| ADR-011 | `/creators/me` before `:id` | **Keep** | Nest route-order correctness; not product philosophy |
| ADR-012 | Prod must ack noop scan | **Keep** | Explicit `CONTENT_SCAN_ALLOW_NOOP` prevents silent unsafe launch; health reports `noop_ack` |
| ADR-013 | Cost-first Fly 1 machine | **Keep** | `fly.toml`: `min_machines_running=1`, `auto_stop=stop`, `sin`, rolling; Mux absorbs media; HA when SLO/cold-start fails (`FLY_SLO.md`) |
| ADR-014 | Dual RBAC (platform ≠ community) | **Keep** | Different principals/scopes; forced merge creates privilege bugs; document boundaries |

### Stack ledger

| Topic | Verdict | Why |
|-------|---------|-----|
| Nest modular monolith + separate worker | **Keep** | 37 modules; clear queue boundary; microservices add ops without traffic justification |
| Neon Postgres + TypeORM | **Keep** | Relational + FTS + entitlements; no Prisma rewrite benefit |
| Mux prod / ffmpeg local | **Keep** | No MediaConvert in repo; Mux CDN+HLS; ffmpeg opt-in worker image |
| Redis + BullMQ | **Keep** | Extensive queues with DLQ patterns; SPOF accepted until backlog |
| Stripe Connect | **Keep** | Real destination charges; stub blocked in prod when billing on |
| JWT + MFA (not Firebase Auth) | **Keep** | Firebase = FCM/App Check only (`AUTH.md`) |
| Next.js web/admin + Flutter mobile | **Keep** | Substantial mobile app; not React Native |

---

## 3. Domain validation matrix (25)

| # | Domain | Doc (pre-pass) | Code reality | Gap | Severity | Phase |
|---|--------|----------------|--------------|-----|----------|-------|
| 1 | Product vision | Mixed YouTube vs skill | Strategy + flags match skill-first | Agent-rule conflict | Fixed this pass | R0 |
| 2 | User/creator/admin flows | Claimed complete | Signup→watch, apply→approve→upload, report→admin: **complete**. Mobile + web Studio Copilot gated on `ai.creatorInsights` | Copilot ops flag | Low | R2 |
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
| R-15 | Dual-SSOT doc sprawl (tracker %, DEPTH ads, Aug/Sep2 bodies) | Low | Evening hygiene: stub + DEFERRED fold | Docs | **Fixed evening pass** |
| R-16 | Mux unsigned private/unlisted playback | High | Ops: signing keys | Ops | Pre premium private content |
| R-17 | USPTO DMCA designated agent missing | High | Legal filing | Legal | Open UGC / copyright posture |
| R-18 | Kids / Restricted Mode undefined | Medium | Product+legal scope before build | Product | Pre under-13 / COPPA markets |

---

## 4a. Gap analysis refresh (evening pass)

Prioritized by launch risk. Status = as of evening revalidation.

| P | Gap | Sev | Owner | Detection | Mitigation | Trigger | Status |
|---|-----|-----|-------|-----------|------------|---------|--------|
| 1 | CSAM vendor + webhook | **Critical** | Legal + eng | `contentScan` health = `noop`/`noop_ack` | Contract CSAI Match / Thorn / equiv; `CONTENT_SCAN_PROVIDER=webhook` | Open UGC launch | **Open** (git cannot close) |
| 2 | Stripe live Connect checklist | High | Ops | Test keys / no `chargesEnabled` creator | [STRIPE_PRODUCTION_ENABLEMENT.md](../operations/STRIPE_PRODUCTION_ENABLEMENT.md) | Go-live monetization | **Open** |
| 3 | USPTO DMCA designated agent | High | Legal | LEGAL.md incomplete agent | File designated agent | Open UGC | **Open** |
| 4 | Neon PITR drill | High | Ops | Cadence overdue | Runbook + `verify-neon-dr-checklist.sh` | **2026-10-22** | **Scheduled** |
| 5 | Staging load-test evidence | High | Perf | No attached soak report | `load-test:feed` / community / entitlements | Pre marketing spike | **Open** |
| 6 | Mux signing keys (private/unlisted) | High | Ops | Unsigned playback URLs | Mux signing secrets + util path | Private premium content | **Open** |
| 7 | App Check off by default | Medium | Ops | Abuse on auth | `APP_CHECK_ENABLED` + Firebase | Auth abuse | **Accepted until flip** |
| 8 | Worker SPOF | Medium | DevOps | Queue backlog / worker down | Scale worker after idempotency review | Backlog SLI | **Accepted MVP** |
| 9 | API auto-stop cold start (~20s) | Medium | DevOps | p95 / live wake | `FLY_SLO.md` HA rollback | p95 / live concurrency | **Accepted MVP** |
| 10 | Recs quality vs ML | Medium | Platform | forYou watch-through stall | Keep SQL; pgvector at trigger | 100K MAU / quality stall | **Trigger-gated** |
| 11 | FTS at catalog scale | Medium | Platform | Search p95 | Meilisearch F-1302 | 500K videos / p95 | **Trigger-gated** |
| 12 | Course FTS | Low–med | Platform | Course catalog growth | Discover API OK until size justifies `search_vector` | Catalog size | **Deferred** |
| 13 | Full EEA CMP / kids mode | Medium | Legal + product | Banner-only CMP; no made-for-kids | Legal-scoped CMP; product decision before build | EEA / under-13 markets | **Open (scope)** |
| 14 | Admin billing write actions | Low | Ops + eng | Ledger read-only | Staff disputes process first | Disputes staffed | **By design** |
| 15 | Dual-SSOT leftovers | Low | Docs | Conflicting % / ads / Aug framing | Evening stub/archive pass | Ongoing | **Closing this pass** |

Canonical deferred list: [DEFERRED_BACKLOG.md](./DEFERRED_BACKLOG.md). Cutover ops: [POST_REAUDIT_CUTOVER.md](../operations/POST_REAUDIT_CUTOVER.md). **Human R1 execution:** [R1_LAUNCH_GATES.md](../operations/R1_LAUNCH_GATES.md).

---

## 5. Decision outcomes vs Sep 2

All ADR-001–011 **re-accepted** with stronger evidence. **New:** ADR-012 (noop ack), ADR-013 (cost-first Fly), ADR-014 (keep dual RBAC).

Overturned *operational* claims: DEPLOY HA, recs course-awareness, §16 playlists/reports/FCM/gamification UI, dual-RBAC-as-debt, audits/README latest pointer.

**Evening revalidation:** ADR-001–014 and stack table all **Keep** (ledger §2a). No Overturn. No Google/YouTube-scale rewrite warranted; evolution path stays trigger-gated (roadmap post-launch section).

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
| Evening: revalidation ledger §2a + gaps §4a | ✅ |
| Evening: stub dual SSOTs; fold DEPTH open → DEFERRED; Master/CLIENT sync | ✅ (hygiene pass) |

---

## 7. Next re-audit trigger

**50K MAU** or **2026-12-01**, whichever first — or immediately if a CSAM vendor or multi-region failover is chosen.

---

*Zero-trust re-audit completed 2026-09-03; evening extension revalidated ADRs/stack and closed dual-SSOT doc drift. Ground-truthed against live modules, `fly.toml`, and independent YouTube/skill-platform research. Production readiness awaits ops/legal R1.*
