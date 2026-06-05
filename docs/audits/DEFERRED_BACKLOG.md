# Audit deferred backlog

**Audit closed:** 2026-06-05  
**Purpose:** Items explicitly out of audit closure scope — tracked with triggers, not blocking re-audit until due.

---

## Product / engineering

| ID | Item | Trigger | Owner hint |
|----|------|---------|------------|
| **F-1101** | Stripe Phase 2 — real billing, webhooks, `PaymentProvider` | Before paid marketing scale or creator payouts | Product + backend |
| **F-1302** | Search sidecar (e.g. Meilisearch) | Postgres FTS p95 degrades or catalog &gt;500K videos | Platform |
| **Load test** | 100K entitlement simulation (feed + live) | 50K MAU or pre-major marketing push | Platform + perf |

---

## Operations cadence

| Item | Trigger | Reference |
|------|---------|-----------|
| **Neon restore drill** | Annual (next: 2027-06) or after major schema migration | [DISASTER_RECOVERY.md](../operations/DISASTER_RECOVERY.md) |
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

Schedule full 14-phase re-audit on **2026-09-04** or at **50K MAU** — whichever comes first. See [14_EXECUTIVE_SUMMARY.md](./14_EXECUTIVE_SUMMARY.md).
