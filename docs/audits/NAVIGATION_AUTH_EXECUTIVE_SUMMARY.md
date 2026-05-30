# Executive Summary — Navigation, Auth & Access Control Audit

**Date:** May 2026  
**Scope:** `apps/web`, `apps/admin`, `apps/mobile`, `apps/api`, `packages/shared-types`

## Verdict

FORGE’s **API layer is production-grade**: global JWT guard, opaque refresh tokens with rotation and reuse detection, permission tiers, creator approval guard, and admin isolation via `ConsumerOnlyGuard`.

**Client and edge layers need hardening** before YouTube-scale traffic: consumer Next.js middleware previously accepted any non-empty session cookie; tokens were readable from JavaScript (XSS risk); signup ignored deep-link `next`; several routes relied on client-only gates.

## Top risks (addressed in remediation branch)

| Severity | Issue | Status |
|----------|-------|--------|
| Critical | JWT + refresh in `localStorage` | Partial — refresh HttpOnly; access still in LS |
| High | Middleware cookie presence only | **Fixed** — expiry + admin reject |
| High | Impersonation token in URL | Open (P2) |
| Medium | Signup ignoring `next` | **Fixed** |
| Medium | Mobile tier drift | **Fixed** |

## Remediation (implemented)

- **P0:** HttpOnly `forge_refresh` cookie from API; web `withCredentials`; middleware validates JWT expiry; rejects admin on consumer site.
- **P1:** `@forge/shared-types/safe-return-path`; signup/login/session-expired `next`; `/profile` middleware; upload step creator gate; playlists/NoAccessCallout `next`.
- **E2E:** [`apps/web/e2e/auth-nav.spec.ts`](../../apps/web/e2e/auth-nav.spec.ts) — library, profile, settings, upload redirect, session-expired, signup, playlists.
- **Tests:** `consumer-session.spec.ts`, `safe-return-path.spec.ts`, `auth-cookies.spec.ts`.
- **Mobile:** [`forge_access.dart`](../../apps/mobile/lib/core/access/forge_access.dart) parity with shared-types.
- **Build:** Home page refactored to [`HomePageContent`](../../apps/web/src/components/home/HomePageContent.tsx) client boundary (fixes prerender error).

## Recommended next (post-merge)

- Access token in memory only (remove from localStorage).
- Per-device logout using `DELETE /auth/sessions/:id`.
- `studio.` subdomain for creator tools.
- Session management UI on web.

See [PRIORITY_FIX_ROADMAP.md](./PRIORITY_FIX_ROADMAP.md) for full P0–P3 tracking.
