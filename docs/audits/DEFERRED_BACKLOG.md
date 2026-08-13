# Audit deferred backlog

**Audit closed:** 2026-06-05 (this table re-verified 2026-08-13 — several rows below were stale; see updates)  
**Purpose:** Items explicitly out of audit closure scope — tracked with triggers, not blocking re-audit until due.

Note: the *access-control* bug behind signed Mux playback (gated video ingesting with a `public` policy, making the signed-URL code decorative) was a real security fix, not a deferred feature — fixed 2026-08-13, see [PLATFORM_AUDIT_2026-08-09.md §6](../PLATFORM_AUDIT_2026-08-09.md#6-zero-trust-re-audit--fixes-2026-08-13). F-1101b below is the separate, genuinely-deferred DRM add-on (Widevine/FairPlay), not that bug.

---

## Product / engineering

| ID | Item | Trigger | Owner hint |
|----|------|---------|------------|
| **F-1101** | ~~Stripe Connect payouts~~ | Shipped — real destination charges (memberships, Super Chat, Super Thanks), confirmed live in the 2026-08-13 zero-trust re-audit, not mock | — |
| **F-1101b** | Mux DRM-grade playback (Widevine/FairPlay/PlayReady add-on) | Before large-scale premium/anti-piracy content needs justify the added cost | Product + backend |
| **F-1101a** | ~~Recurring membership subs~~ | Shipped Community 2.0 (Stripe checkout + webhooks + tier change) | — |
| **F-1302** | Search sidecar (e.g. Meilisearch) | Postgres FTS p95 degrades or catalog &gt;500K videos | Platform |
| **Load test** | 100K entitlement simulation (feed + live) | 50K MAU or pre-major marketing push | Platform + perf |

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

Schedule full re-audit on **2026-09-04** or at **50K MAU** — whichever comes first. See [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md).

Phase 5 status (2026-07-29): [PHASE5_DEFERRED_STATUS.md](./PHASE5_DEFERRED_STATUS.md) · load harness: `scripts/load/entitlements-k6.js`.
