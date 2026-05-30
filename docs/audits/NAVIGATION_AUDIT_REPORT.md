# Navigation Audit Report

## App Router structure (web)

- **Root layout:** `apps/web/src/app/layout.tsx` — `Providers` → `AuthProvider` → `AppShell`.
- **Studio layout:** `apps/web/src/app/studio/layout.tsx` — `StudioGate` wraps all `/studio/*`.
- **Route group `(auth)`:** organizational only; no shared layout.
- **Shell:** `AppShell.tsx` — minimal chrome on auth/status routes; hides side nav on `/watch/*`.

## Navigation components

| Component | Path | Role |
|-----------|------|------|
| TopBar | `components/shell/TopBar.tsx` | Search, auth CTAs, upload |
| SideNav | `components/shell/SideNav.tsx` | Primary desktop nav; `guestHref` for Library |
| MobileNav | `components/shell/MobileNav.tsx` | Bottom tabs |
| AuthGateModal | `components/gates/AuthGateModal.tsx` | Soft sign-in on engage actions |
| StudioGate | `components/gates/StudioGate.tsx` | Creator tier gate |

## Deep linking

- **Param:** `next` (internal return path).
- **Login:** honors `next` with `safeReturnPath()` (blocks `//`, auth loops).
- **Middleware:** redirects to `/login?next=<pathname+search>` (bounded length).
- **Signup:** now honors `next` after creator status routing.

## Browser history & refresh

- No parallel/intercepting routes (no modal-over-feed watch).
- No feed scroll restoration.
- RSC pages use public `serverApi`; auth rehydrates via `AuthProvider.fetchMe`.
- Multi-tab: `storage` event on `forge_user` / `forge_access_token`.

## Gaps vs YouTube

| Gap | Priority |
|-----|----------|
| Modal watch routing | P3 |
| Infinite scroll restore | P2 |
| Separate studio subdomain | P2 |
| Consistent `continue_url` naming | P3 (using `next` is fine) |

## Orphan / dead-end routes

None identified. `/profile` is a client redirect to `/{username}`.
