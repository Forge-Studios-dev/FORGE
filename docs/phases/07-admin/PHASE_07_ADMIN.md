# Phase 07 — Admin Platform

**Status:** Complete (shell IA + theme + legacy-tool discoverability)

## Goal

Make admin navigation discoverable and consistent with product chrome: grouped NAV, search reachable, dual theme.

## Shipped

- `AdminShell` NAV groups: Overview / Moderation / Community / Platform
- Header Search shortcut (desktop + mobile)
- `ThemeProvider` + light/dark toggle (`forge-admin-theme` storage)
- Report queues, copyright/strikes admin, held-comments queue, durable audit log UI (`/audit`)
- Audit log depth (Wave 51): actor usernames, ILIKE action filter, targetType filter + chips

## Superseded, 2026-08-12

This phase originally kept Mentorship/Channel-points oversight reachable off the primary sidebar
via Settings → "Additional tools." Those admin routes (`apps/admin/src/app/{mentorship,channel-points}`)
are now dead-redirect stubs to `/dashboard` — retired along with the rest of the skill-economy LMS
frontend surface (see `FORGE_PROJECT_MASTER.md` §1, `settings/page.tsx`). There is no oversight
tooling left to reach; treat the line above as historical, not current IA.

## Deferred

- Continuous polish on report/appeal/copyright queues (core queues, strikes, audit log, held comments are shipped — Waves 21–29)

## Resolved (Wave 39)

- Shared ThemeProvider extracted to `@forge/design-system/client` (web `forge-theme` + preferSystemLight; admin `forge-admin-theme`)

See [PHASE_07_REPORT.md](./PHASE_07_REPORT.md).
