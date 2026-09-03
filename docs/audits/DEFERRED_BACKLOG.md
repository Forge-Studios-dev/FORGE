# Audit deferred backlog

**Latest audit:** [FRESH_AUDIT_2026-09-03_MASTER.md](./FRESH_AUDIT_2026-09-03_MASTER.md) (§4a gaps) · Roadmap: [FORGE_IMPLEMENTATION_ROADMAP.md](../FORGE_IMPLEMENTATION_ROADMAP.md)  
**Purpose:** Trigger-gated and ops/legal items — **the only open backlog SSOT** (not CEOS %, not DEPTH ship log).  
**Human execution for launch gates:** [operations/R1_LAUNCH_GATES.md](../operations/R1_LAUNCH_GATES.md)

Note: the *access-control* bug behind signed Mux playback was fixed 2026-08-13. F-1101b is DRM add-on. Stripe Connect destination charges (**F-1101**) are **shipped in code**; live keys remain ops.

---

## Launch / legal (cannot close from git alone)

| ID | Item | Trigger | Owner |
|----|------|---------|-------|
| **CSAM vendor** | Wire `CONTENT_SCAN_PROVIDER=webhook` to CSAI Match / Thorn / equivalent | Pre open-UGC launch (ADR-009); until then `CONTENT_SCAN_ALLOW_NOOP=true` | Legal + eng |
| **Stripe live** | Live keys + Connect checklist | Go-live monetization | Ops — [STRIPE_PRODUCTION_ENABLEMENT.md](../operations/STRIPE_PRODUCTION_ENABLEMENT.md) |
| **DMCA agent** | USPTO designated agent filing | Open UGC / copyright posture | Legal — [LEGAL.md](../LEGAL.md) |
| **Neon PITR drill** | Quarterly restore drill | Next **2026-10-22** (or after major schema migration) | Ops — [DISASTER_RECOVERY.md](../operations/DISASTER_RECOVERY.md) |
| **Load evidence** | Staging soak (`load-test:feed` / community / entitlements) | 50K MAU or pre-major marketing push | Perf — [LOAD_TEST_RUNBOOK.md](../operations/LOAD_TEST_RUNBOOK.md) |
| **Mux signing** | Signing keys for private/unlisted playback | Before premium private content | Ops — [MEDIA.md](../MEDIA.md) |

---

## Product / engineering (trigger-gated)

| ID | Item | Trigger | Owner hint |
|----|------|---------|------------|
| **F-1101** | ~~Stripe Connect payouts~~ | Shipped — destination charges (memberships, Super Chat, Super Thanks) | — |
| **F-1101a** | ~~Recurring membership subs~~ | Shipped Community 2.0 (checkout + webhooks + tier change) | — |
| **F-1101b** | Mux DRM-grade playback (Widevine/FairPlay/PlayReady) | Large-scale premium / anti-piracy need | Product + backend |
| **F-1302** | Search sidecar (e.g. Meilisearch) | Postgres FTS p95 degrades or catalog &gt;500K videos | Platform — ADR-010 |
| **pgvector recs** | Semantic retrieval slice | ~100K MAU or forYou quality stall | Platform — ADR-008 |
| **Course FTS** | Course `search_vector` in unified search | Course catalog size justifies (discover API OK until then) | Platform |
| **Kids / Restricted Mode** | Made-for-kids / restricted viewing | Product + legal scope before any build | Product + legal |
| **Ads / VAST** | ~~Ad network~~ | **Permanently N/A** — ADR-005 | — |
| **App Check** | Enable `APP_CHECK_ENABLED` after Firebase Admin ready | Auth abuse / open launch hardening. Flag-on without Admin **fail-closed** (shipped). | Ops — [FIREBASE.md](../FIREBASE.md) |
| **Worker / API HA** | Second worker; `min_machines_running=2` | Queue backlog SLI or cold-start/p95 unacceptable | DevOps — ADR-013 / [FLY_SLO.md](../operations/FLY_SLO.md) |
| **Admin billing writes** | Dispute/refund actions beyond read-only ledger | Disputes process staffed | Ops + eng |
| **EEA CMP remainder** | Full CMP beyond cookie banner | Legal-scoped EEA requirement | Legal |

---

## Operations cadence

| Item | Trigger | Reference |
|------|---------|-----------|
| **Mux monthly cost review** | First week of each month | [MUX_COST_OPS.md](../operations/MUX_COST_OPS.md) |
| **npm audit fix-all** | Transitive vulns; CI high+ non-blocking | Security hygiene epic |

---

## Optional post-closure

| ID | Item | Notes |
|----|------|-------|
| **F-1203** | Admin Playwright E2E | Low priority; skipped in CI by design |
| **Admin + web Vercel merge** | Cost consolidation | Long-term; admin isolation still valid |
| **Nest LMS source deletion** | Delete unused trees | Flags/410 sufficient — do not delete without product ask |

---

## Re-audit

Schedule full re-audit on **50K MAU** or **2026-12-01**. Current SSOT: [FRESH_AUDIT_2026-09-03_MASTER.md](./FRESH_AUDIT_2026-09-03_MASTER.md) (Sep 2 file is a stub only).

Historical Phase 5 status (2026-07-29): [archive/audits-pre-2026-09/PHASE5_DEFERRED_STATUS.md](../archive/audits-pre-2026-09/PHASE5_DEFERRED_STATUS.md) · load harness: `scripts/load/entitlements-k6.js`.
