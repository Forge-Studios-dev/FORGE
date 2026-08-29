# Phase 07 — Admin Platform (Master Execution)

**Status:** Audit complete, scoped implementation complete  
**Date:** 2026-08-28  
**Scope:** Admin RBAC tiers, nav gating, destructive-action guards, AI budget surface (WIP landed)

## Shipped

| Area | Change |
| --- | --- |
| RBAC | `AdminTier` enum (`full` / `moderator`) on `users.admin_tier`; migration `2251000000000-admin-tier.ts` |
| API | `AdminFullGuard` + `@AdminFullOnly()` on impersonate, user delete/bulk/patch, strikes issue, category CRUD, subscription grant, DB reset, Mux backfill, counter-notice reject |
| JWT | Live `adminTier` on `JwtPayload` via auth user cache |
| Admin UI | `useAdminProfile()`; moderators lose fraud/billing/analytics/settings nav; user detail destructive controls hidden for moderators |
| AI ops | `/ai` page + queue depth on `GET /admin/ai/budget` (prior WIP) |

## Deferred

- Assign `adminTier=moderator` via admin user PATCH UI (API column exists; set via DB/seed until UI added)
- Bulk moderation actions on report queues

## Acceptance

- [x] Moderator JWT cannot call full-admin-only endpoints (403 `ADMIN_TIER_MODERATOR`)
- [x] Existing admins default to `full` tier
- [x] `admin-full.guard.spec.ts` green

See [PHASE_07_REPORT.md](../phases/07-admin/PHASE_07_REPORT.md).
