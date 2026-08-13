# Phase 07 — Admin Platform

**Status:** Complete (shell IA + theme + legacy-tool discoverability)

## Goal

Make admin navigation discoverable and consistent with product chrome: grouped NAV, search reachable, dual theme.

## Shipped

- `AdminShell` NAV groups: Overview / Moderation / Community / Platform
- Header Search shortcut (desktop + mobile)
- `ThemeProvider` + light/dark toggle (`forge-admin-theme` storage)

## Superseded, 2026-08-12

This phase originally kept Mentorship/Channel-points oversight reachable off the primary sidebar
via Settings → "Additional tools." Those admin routes (`apps/admin/src/app/{mentorship,channel-points}`)
are now dead-redirect stubs to `/dashboard` — retired along with the rest of the skill-economy LMS
frontend surface (see `FORGE_PROJECT_MASTER.md` §1, `settings/page.tsx`). There is no oversight
tooling left to reach; treat the line above as historical, not current IA.

## Deferred

- Deeper admin workflow UX (report queues, bulk actions)
- Shared ThemeProvider package extraction (admin/web still duplicate)

See [PHASE_07_REPORT.md](./PHASE_07_REPORT.md).
