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
| Watch / Studio | `/watch/*`, `/studio/*` | TopBar only |
| Default | home, library, explore, … | TopBar + SideNav + MobileNav |

### Mobile bottom IA (Phase 01)

Home · Shorts · **Create** · Subs · You  
Immersive (outside ShellRoute): watch, live, shorts, community rooms.

### Middleware

Protected prefixes: studio, upload, history, notifications, library, profile, messages, playlists/me.  
Creator JWT required for `/upload` except become-creator. CSP + nonce threaded.

---

## Findings this pass

| ID | Sev | Finding | Action |
| --- | --- | --- | --- |
| — | — | Prior report claimed Create only in TopBar; MobileNav Create now shipped (P01) | Docs updated |
| M1 | Med | `/upload?type=short` depends on upload draft `videoType` | Phase 08 / upload |
| L1 | Low | `/explore/skills/*` → search redirect | Keep |

No Critical navigation bugs found.

---

## Acceptance

- [x] AppShell mode matrix matches YouTube masthead/guide patterns
- [x] Mobile Create center tab
- [x] LMS orphan redirects present (admin + next.config)
- [x] Middleware protects creator/upload paths
