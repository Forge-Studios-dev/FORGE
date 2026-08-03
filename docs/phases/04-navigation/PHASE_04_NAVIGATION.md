# Phase 04 — Navigation & Routing (Fresh)

**Status:** Complete  
**Depends on:** Phase 01 AppShell modes, Phase 02 module map

---

## Existing state (code)

### Web IA
- SideNav: Home, Shorts, Trending, Subscriptions + You / History / Watch later / Liked + Studio
- MobileNav: Home, Shorts, Subs, You (+ Studio when signed in)
- AppShell: minimal | immersive | studio | default
- next.config redirects: LMS/studio orphans → `/` or `/studio`
- Middleware protects library/playlists/messages etc.

### Mobile IA
- Bottom nav: Home, Shorts, Subs, You, Profile (Studio via Library)
- Shorts outside ShellRoute (immersive)

---

## Gaps closed this pass

| Gap | Fix |
| --- | --- |
| No Create menu (deferred in prior Phase 04) | TopBar Create details: Upload video, Create a Short, Go live |
| Mobile Discover tab label | Renamed to For you (Phase 02 feed touch) |

---

## Architecture — route chrome matrix

| Route prefix | Chrome |
| --- | --- |
| auth / offline / embed | none |
| `/watch/*`, `/shorts` | immersive (no chrome) |
| `/studio/**` | TopBar + StudioShell |
| default | full consumer chrome |

---

## Acceptance

- [x] Primary nav matches YouTube-shaped IA
- [x] Create affordance groups upload/live/shorts entry
- [x] LMS orphan redirects remain in next.config
- [x] Docs/report updated

**Deferred:** Nested App Router layouts; `/shorts/:id` deep route (player phase); full upload `videoType=short` draft wiring

See [PHASE_04_REPORT.md](./PHASE_04_REPORT.md).
