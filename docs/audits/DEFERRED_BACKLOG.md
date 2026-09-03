# Audit deferred backlog

**Latest audit:** [FRESH_AUDIT_2026-09-03_MASTER.md](./FRESH_AUDIT_2026-09-03_MASTER.md) · Roadmap R1–R5: [FORGE_IMPLEMENTATION_ROADMAP.md](../FORGE_IMPLEMENTATION_ROADMAP.md)  
**Purpose:** Trigger-gated items — not closed by in-repo engineering alone.

Note: the *access-control* bug behind signed Mux playback was fixed 2026-08-13. F-1101b is DRM add-on.

---

## Product / engineering

| ID | Item | Trigger | Owner hint |
|----|------|---------|------------|
| **F-1101** | ~~Stripe Connect payouts~~ | Shipped — real destination charges (memberships, Super Chat, Super Thanks), confirmed live in the 2026-08-13 zero-trust re-audit, not mock | — |
| **F-1101b** | Mux DRM-grade playback (Widevine/FairPlay/PlayReady add-on) | Before large-scale premium/anti-piracy content needs justify the added cost | Product + backend |
| **F-1101a** | ~~Recurring membership subs~~ | Shipped Community 2.0 (Stripe checkout + webhooks + tier change) | — |
| **F-1302** | Search sidecar (e.g. Meilisearch) | Postgres FTS p95 degrades or catalog &gt;500K videos | Platform |
| **Load test** | 100K entitlement simulation (feed + live) | 50K MAU or pre-major marketing push — `npm run load-test:feed` | Platform + perf |
| **CSAM vendor** | Wire `CONTENT_SCAN_PROVIDER=webhook` to CSAI Match / Thorn / equivalent | Pre open-UGC launch (ADR-009); until then `CONTENT_SCAN_ALLOW_NOOP=true` | Legal + eng |

---

## Operations cadence

| Item | Trigger | Reference |
|------|---------|-----------|
| **Neon restore drill** | Quarterly (first executed 2026-07-22; next: 2026-10-22) or after major schema migration | [DISASTER_RECOVERY.md](../operations/DISASTER_RECOVERY.md) |
| **Mux monthly cost review** | First week of each month | [MUX_COST_OPS.md](../operations/MUX_COST_OPS.md) |
| **npm audit fix-all** | 55 transitive vulns; CI reports high+ non-blocking | Separate security hygiene epic |

---

## Optional post-closure

| ID | Item | Notes |
|----|------|-------|
| **F-1203** | Admin Playwright E2E | Low priority |
| **Admin + web Vercel merge** | Cost consolidation | Long-term; admin isolation still valid |

---

## Re-audit

Schedule full re-audit on **50K MAU** or **2026-12-01** — completed 2026-09-02 ([FRESH_AUDIT_2026-09_MASTER.md](../FRESH_AUDIT_2026-09_MASTER.md)).

Phase 5 status (2026-07-29): [PHASE5_DEFERRED_STATUS.md](./PHASE5_DEFERRED_STATUS.md) · load harness: `scripts/load/entitlements-k6.js`.
