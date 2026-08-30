# Phase 04 — Navigation & Routing (Fresh · 2026-08-04)

**Status:** Verified + aligned with Phase 01 Create IA · Closed  
**Source:** Live AppShell / middleware / GoRouter

---

## Architecture

### Web AppShell modes (contract)

| Mode | Routes | Chrome |
| --- | --- | --- |
| Minimal | auth, offline, maintenance, embed, session-expired | None |
| Shorts | `/shorts` | Full-bleed |
| Watch-like / Studio | `/watch/*`, `/live/[id]`, `/community/*/voice|text/*`, `/studio/*` | TopBar only |
| Default | home, library, explore, `/live` list, … | TopBar + SideNav + MobileNav |

### Mobile bottom IA (Phase 01)

Home · Shorts · **Create** · Subs · You  
Immersive (outside ShellRoute): watch, live, shorts, community rooms.  
Library → **Trending** (`/trending`) and **Explore** (`/explore`) as separate rows.

### Middleware

Protected prefixes: studio, upload, history, notifications, library, profile, messages, playlists/me.  
Creator JWT required for `/upload` except become-creator. CSP + nonce threaded.

---

## Findings this pass (2026-08-29)

| ID | Sev | Finding | Action |
| --- | --- | --- | --- |
| P04-A1 | High | Live watch + community rooms used full SideNav chrome | Fixed — watch-like TopBar-only |
| P04-R1 | Med | Studio orphan aliases (`copilot`/`rooms`/`engagement`) missing on web | Fixed — next.config redirects |
| N4 | Med | Mobile had `getTrendingFeed` but no `/trending` route | Fixed — screen + Library link |
| M1 | Med | `/upload?type=short` depends on upload draft `videoType` | Phase 08 / upload |
| L1 | Low | `/explore/skills/*` → search redirect | Keep |

---

## Acceptance

- [x] AppShell mode matrix matches YouTube masthead/guide patterns (incl. live/rooms)
- [x] Mobile Create center tab
- [x] Mobile Trending route + Library entry
- [x] LMS / Studio orphan redirects present (web + admin)
- [x] Middleware protects creator/upload paths
