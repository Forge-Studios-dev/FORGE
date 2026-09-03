# FORGE Implementation Roadmap

**Audience:** Engineering, product, DevOps.  
**Status:** Active sequencing plan (zero-trust rewrite 2026-09-03; evening revalidation + SSOT hygiene same day).  
**Supersedes:** 2026-09-02 P0–P6 narrative and [YOUTUBE_PARITY_ROADMAP.md](./YOUTUBE_PARITY_ROADMAP.md) (stub only) for product direction.  
**Product SSOT:** [FORGE_PRODUCT_STRATEGY.md](./FORGE_PRODUCT_STRATEGY.md)  
**Audit SSOT:** [audits/FRESH_AUDIT_2026-09-03_MASTER.md](./audits/FRESH_AUDIT_2026-09-03_MASTER.md) (§2a ledger, §4a gaps)  
**Open backlog SSOT:** [audits/DEFERRED_BACKLOG.md](./audits/DEFERRED_BACKLOG.md)

---

## How to read this

Phases are dependency-ordered by **launch risk**, then depth. Feature-status SSOT is [FORGE_PROJECT_MASTER.md §16](./FORGE_PROJECT_MASTER.md#16-feature-status-matrix) — not tracker percentages.

```mermaid
flowchart TB
  R0[R0 Research and SSOT]
  R1[R1 Launch blockers]
  R2[R2 Mobile and Studio]
  R3[R3 Discovery and recs]
  R4[R4 Security reliability scale]
  R5[R5 Remaining readiness]
  R0 --> R1
  R1 --> R2
  R2 --> R3
  R3 --> R4
  R4 --> R5
```

| Phase | Focus | Status |
|-------|--------|--------|
| **R0** | Docs, ADRs, master audit, agent rules; evening revalidation + dual-SSOT hygiene | Complete (2026-09-03) |
| **R1** | CSAM gate, Stripe ops, load test, Neon DR, DMCA agent | In-repo engineering shipped; **ops/legal still open** |
| **R2** | Mobile/Studio parity + SEO metadata | **In-repo complete** (Copilot gated; VoiceOver/a11y smoke shipped) |
| **R3** | FTS/recs hardening | In-repo (watch_history index, course-aware recs) |
| **R4** | Security/reliability docs + health | Dual RBAC kept; topology documented; health honesty |
| **R5** | Sitemap, status matrix, deferred items | Docs + SEO; ML/DRM stay trigger-gated |

---

## R0 — Research and SSOT (complete)

- [FORGE_PRODUCT_STRATEGY.md](./FORGE_PRODUCT_STRATEGY.md)
- [decisions/](./decisions/) ADR-001–014 — all **Keep** on evening revalidation ([audit §2a](./audits/FRESH_AUDIT_2026-09-03_MASTER.md))
- [audits/FRESH_AUDIT_2026-09-03_MASTER.md](./audits/FRESH_AUDIT_2026-09-03_MASTER.md)
- Agent rules: `forge-product` frames; `forge-youtube-replica` = mechanics only
- Evening hygiene: stubbed Sep 2 / Aug audits / parity body; CEOS % neutralized; DEPTH open → DEFERRED; Master/CLIENT sync

**Architecture stance:** No Google/YouTube-scale rewrite at current stage. Modular Nest monolith + Fly worker + Mux + Postgres FTS + SQL recs remain the production default.

---

## R1 — Launch blockers

| Item | In-repo | Ops / legal | Owner | Ref |
|------|---------|-------------|-------|-----|
| CSAM / vendor scan | Webhook + fail-closed hold + `CONTENT_SCAN_ALLOW_NOOP` prod gate (ADR-012) + admin/uploader notify | **Vendor contract** (CSAI Match / Thorn / equivalent); NCMEC process | Legal + eng | [CONTENT_SCANNING.md](./CONTENT_SCANNING.md) |
| Stripe live cutover | Connect/Checkout/webhooks shipped; health `billing` | Live keys, Connect branding, Vercel `NEXT_PUBLIC_BILLING_ENABLED`, one `chargesEnabled` creator | Ops | [STRIPE_PRODUCTION_ENABLEMENT.md](./operations/STRIPE_PRODUCTION_ENABLEMENT.md) |
| Load test | `npm run load-test:feed` / `:community` / `:entitlements` | Run on **staging**, attach evidence | Perf | [LOAD_TEST_RUNBOOK.md](./operations/LOAD_TEST_RUNBOOK.md) |
| Neon DR | Runbook + `scripts/verify-neon-dr-checklist.sh` | Quarterly PITR drill — next **2026-10-22** | Ops | [DISASTER_RECOVERY.md](./operations/DISASTER_RECOVERY.md) |
| DMCA agent | Pipeline shipped | USPTO designated agent filing | Legal | [LEGAL.md](./LEGAL.md) |
| Mux signing | Playback util present | Signing keys for private/unlisted | Ops | [MEDIA.md](./MEDIA.md) |

**R1 is not “green” until legal picks a scanner and Stripe live checklist is executed.** Engineering cannot close those boxes from git. Execute: [R1_LAUNCH_GATES.md](./operations/R1_LAUNCH_GATES.md). Post-merge smoke: [POST_REAUDIT_CUTOVER.md](./operations/POST_REAUDIT_CUTOVER.md).

---

## R2 — Mobile and Studio depth

**In-repo complete** this pass (see prior ship notes): Studio playlists/upload-reliability/analytics/go-live; SEO metadata; scan-hold deep links; FCM routing; VoiceOver skill screens; Copilot gated on `ai.creatorInsights`.

Still open (priority order):

| Item | Notes |
|------|-------|
| Admin billing actions | Ledger is read-only by design until Stripe disputes process is staffed |

Podcasts / wiki / gamification **UI** are out of R2 (ADR-007).

---

## R3 — Discovery and recommendations

Shipped: `watch_history(watched_at DESC)` index; course-enrollment lesson boost in SQL recs.

Triggers (do **not** build early) — see **Post-launch evolution** below.

---

## R4 — Security, reliability, scale

| Item | Decision |
|------|----------|
| Dual RBAC | **Keep** two planes (ADR-014) — document, don’t merge |
| Worker SPOF | **Accepted** until idempotency review + cost (ADR-013) |
| API 1 machine + auto-stop | **Accepted** MVP; rollback path in `FLY_SLO.md` |
| App Check | Code present; ops flip `APP_CHECK_ENABLED` + Firebase |
| Cookie consent | Banner shipped; full EEA CMP is legal-scoped |
| SCALE_LIVE / MESSAGING / MULTI_REGION | Remain **proposed** until a scale trigger |

---

## R5 — Remaining production readiness

| Item | Status |
|------|--------|
| Sitemap: live directory + playlists bound | Shipped |
| Cost follow-up | [COST_AUDIT_2026-09-01.md](./audits/COST_AUDIT_2026-09-01.md) — still valid if DEPLOY matches fly.toml |
| Mux DRM F-1101b | Premium-scale trigger |
| Admin Playwright deep moderation | Staging credentials; skipped in CI by design |
| Kids / Restricted Mode | Product + legal scope before build |
| Next full re-audit | **50K MAU** or **2026-12-01** |

---

## Post-launch evolution path (do not build early)

| Trigger | Work | ADR / doc |
|---------|------|-----------|
| ~100K MAU **or** forYou quality stall | pgvector / semantic retrieval slice | ADR-008, `AI-LLM-STRATEGY.md` |
| ~500K videos **or** search p95 regress | Meilisearch F-1302 | ADR-010 |
| Auth/live p95 or cold starts unacceptable | `min_machines_running=2`, `auto_stop=false` | ADR-013, `FLY_SLO.md` |
| BullMQ backlog / worker downtime hurting ingest | Second worker **after** idempotency review | ADR-013 |
| Large-scale premium anti-piracy | Mux DRM (Widevine/FairPlay) F-1101b | DEFERRED |
| 100K concurrent live or multi-region RTO | Execute `SCALE_*` designs | Proposed only today |
| Course catalog justifies unified FTS | Course `search_vector` | ADR-010 |

**Explicit non-goals until product reverses an ADR:** ad network/VAST (ADR-005), full LMS consumer UI (ADR-007), microservices split, Elasticsearch, MediaConvert rewrite.

---

## Domain coverage (25 areas → phase)

| # | Domain | Phase |
|---|--------|-------|
| 1 | Product vision | R0 |
| 2 | User/creator/admin flows | R0, R2 |
| 3 | Architecture | R0, R4 |
| 4 | Data models | R0, R3 |
| 5 | APIs | R0 |
| 6 | Web/mobile architecture | R2 |
| 7 | Video/media pipeline | R1 (scan), else shipped Mux |
| 8 | Search | R3 |
| 9 | Recs/feeds | R3 |
| 10 | Creator tools/analytics | R2 |
| 11 | Engagement | Shipped |
| 12 | AuthN/Z | R4 / ADR-014 |
| 13 | Notifications | R1 (scan hold) |
| 14 | Monetization | R1 Stripe ops |
| 15 | Moderation | R1 CSAM |
| 16 | Security/privacy | R1, R4 |
| 17 | Cloud/DevOps | R4 / ADR-013 |
| 18 | Scalability | Post-launch triggers |
| 19 | Cache/queues | R4 worker SPOF |
| 20 | Observability | Shipped + health honesty |
| 21 | Backup/DR | R1 |
| 22 | Testing/QA | R1 load test; R5 admin E2E |
| 23 | SEO/a11y | R2, R5 |
| 24 | Cost | ADR-013 |
| 25 | Extensibility | Flags + ADRs |

---

## Carried YouTube-parity (still done)

Community permission enforcement, strikes/DMCA, MFA, DSAR export, monetization eligibility UI, caption search, scheduled publish, share tracking, comment moderation gate.

---

*Update phase status on merge. Feature status SSOT: `FORGE_PROJECT_MASTER.md` §16. Open work: `audits/DEFERRED_BACKLOG.md`.*
