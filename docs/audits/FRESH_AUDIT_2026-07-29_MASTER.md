# FORGE — Fresh Audit Master (2026-07-29 / Wave 2)

**Date:** 2026-07-29  
**Branch:** `fix/production-hardening-audit-2026-07-26`  
**PR:** https://github.com/Forge-Studios-dev/FORGE/pull/161  
**Method:** Independent re-verify of prior July-26 findings against committed Wave 1 + live Neon MCP + Fly CLI. Prior audit docs used for merge only — not ground truth.

**Related:** [IMPLEMENTATION_TRACKER](./IMPLEMENTATION_TRACKER_2026-07-26.md) · [INFRA_AUDIT_2026-07-29](./INFRA_AUDIT_2026-07-29.md) · [FRESH_AUDIT_2026-07-26_MASTER](./FRESH_AUDIT_2026-07-26_MASTER.md)

---

## Executive summary

Wave 1 hardening is committed and in PR #161 (Mux 5m/15m backup cadence, `installExtensions: false`, Communities/gateway/entitlements extractions, JWT purpose, shared CSRF, reports index migration, DevOps pins). Tracker statuses were marked **partial** where honesty required.

Live Neon shows a small ~40MB production DB with no application-query latency hotspots (slowest app queries &lt;30ms mean). Fly inventory matches prior audit: 2× API + 1× worker in `bom`, healthy. **Prod still runs old Mux poll intervals until Fly deploy.**

Wave 3 (Creator Economy surfaces) lands admin CP/mentorship oversight, earn hooks for chat/watch, Connect status clarity, mobile Studio CP/mentorship, and onboarding→recommendations via Redis interests.

**Overall posture:** production-capable; cost wins pending deploy; Phase 5 product triggers unchanged (Stripe Connect payouts/DRM, search sidecar).

---

## Live infra evidence (2026-07-29)

### Neon (`orange-math-53675581` / branch `production`)

| Metric | Value |
|--------|-------|
| Region | aws-ap-southeast-1 |
| PG | 17 |
| Autoscaling | 0.25–2 CU, suspend 300s |
| Logical size | ~39.9 MB |
| Synthetic storage | ~48.9 MB |
| Active time (billing window) | ~2,446,207 s |
| CPU used | ~622,790 s |
| Data transfer | ~301 MB |
| Slow queries | Neon internals + tiny app queries; no &gt;100ms mean app hot path |

Notable: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` appears in `pg_stat_statements` once — aligns with Wave 1 `installExtensions: false` (not yet on prod).

### Fly

| App | Machines | Region | State | Checks |
|-----|----------|--------|-------|--------|
| `forge-studios-api` | 2 (v253) | bom | started | passing |
| `forge-studios-worker` | 1 (v225) | bom | started | passing |

### Blocked without credentials

Mux minute/cost tables · AWS Cost Explorer / live S3 versioning apply · Vercel build minutes · Redis `CLIENT LIST` (no live `REDIS_URL` this session)

---

## Merge vs July-26 Critical / High

| ID | Prior | 2026-07-29 |
|----|-------|------------|
| C1–C5 | Mostly ✅ | Confirmed (C2 still facade ~900 LOC — ⚠️) |
| C6 | Checklist | ⚠️ Process only |
| H-* remediations | Claimed ✅ in WT | Committed in Wave 1; several ⚠️ partial (H-A1, H-M1, H-M2, M-I1) |
| Mux/Neon idle | WIP | Code committed; **prod pending deploy** |
| H-F4 / H-M4 / H-Q3 / F-1101 / F-1302 | Deferred | Still deferred |

---

## New / updated findings this pass

1. **CSRF shared-types build break** — `packages/shared-types/src/csrf.ts` used DOM `document` without `dom` lib → fixed via `globalThis` (blocks `ci:local`).
2. **Channel points earn incompleteness** — only `community.post.created` wired → Wave 3 adds room chat, stream chat, stream viewer join (rate-limited).
3. **Admin CP/mentorship stubs** → replaced with API-backed oversight UIs + admin endpoints.
4. **Onboarding interests were fake slug IDs** → now real `/categories` UUIDs + `PUT /users/me/interests` → RecommendationsService cold-start.

---

## Wave 3 deliverables (Creator Economy surfaces)

- Admin: `/admin/channel-points/*`, `/admin/mentorship/overview` + UI pages
- CP earn: `room.message`, `stream.chat.message`, `stream.viewer.joined`
- Connect status always visible on Studio tiers (connected / charges / payouts)
- Mobile: `/studio/channel-points`, `/studio/mentorship`
- Onboarding → Redis interests → personalized feed

---

## Product / UX inventory (light — for `newPrompt.md`)

Roles: viewer, creator (pending/approved), collaborator, admin.  
Flagship flows: feed/watch, live, studio upload, checkout/tiers, community rooms, moderation, admin triage.  
Gaps deferred: full Connect payout ledger/tax, semantic search, concurrent-session DRM, mass form-validation / Flutter dropdown migration.

---

## Prioritized backlog (remaining)

| Priority | Item | Effort |
|----------|------|--------|
| P0 | Fly deploy API+worker after PR merge (Mux/Neon savings) | Ops |
| P0 | Apply migration `1840000000000` on deploy | Ops |
| P1 | Operator C6 flagship checklist on staging | 1 day |
| P2 | F-1101 Connect payouts when product trigger | Large |
| P2 | H-F4 / H-M4 incremental | Medium |
| P3 | F-1302 search sidecar on catalog trigger | Large |

---

## Wave 4 gate

Production deploy / merge to `main` requires **explicit user authorization** per `forge-ship` and this program plan.
