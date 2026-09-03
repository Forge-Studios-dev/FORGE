# ADR-004: Communities rooms and events

**Status:** Accepted (2026-09-03) — revalidated zero-trust  
**Supersedes:** 2026-09-02 version

## Context

Communities 2.0 includes Discord-like rooms and events/RSVPs beyond YouTube’s Community tab (posts + polls).

## Research

- YouTube Community tab = posts, images, polls; memberships gate some posts. No persistent chat rooms.
- Skill communities (workshops, cohort chat) need rooms/events; Twitch/Discord are the UX analogues.
- Code already wires rooms into web/mobile, moderation, and permissions. Flag-gating them now would be a breaking product change.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Sunset rooms to match YouTube | Breaks shipped UI and moderation investment. |
| Flag-gate like courses | Rooms are load-bearing for community RBAC; not optional skill LMS. |

## Decision

**Keep** rooms and events as a **labeled skill-community extension** (always on). Posts + polls + membership tiers remain **core** (YouTube Community tab + Channel Memberships equivalent).

## Code evidence

- `CommunitiesModule`, community RBAC (`CommunityRoleType`), web `/community/.../text|voice/`

## Consequences

- Document extension in product strategy; do not treat rooms as a YouTube-parity bug.
- Dual RBAC (ADR-014) continues: community roles ≠ platform admin.
