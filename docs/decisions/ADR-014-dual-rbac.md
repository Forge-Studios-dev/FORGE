# ADR-014: Dual RBAC (platform vs community)

**Status:** Accepted (2026-09-03)

## Context

Sep 2 listed “dual RBAC” as a medium risk to consolidate. Platform roles (`UserRole`, `AdminTier`, `Permission`) and community roles (`CommunityRoleType`) are separate systems.

## Research

- YouTube: site-wide account vs channel managers vs Community/live mods are **different** permission planes.
- Discord/Slack: guild roles ≠ platform staff.
- Collapsing them into one enum creates confused Super-admins-as-community-owners and leaks `MANAGE_PLATFORM` into rooms.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Single RBAC enum | Wrong domain; high regression risk on community routes. |
| Big-bang consolidation | XL refactor; no security win if boundaries are documented and tested. |

## Decision

**Keep two planes.** Document and enforce:

1. **Platform:** `user` / `creator` / `admin` + `AdminTier` (`full` vs `moderator`) + `PermissionsGuard`.
2. **Community:** per-community owner/admin/moderator/coach via `assertCommunityPermission` / `@CommunityRoles`.

Platform admins intervene through **admin APIs**, not by inheriting community roles. New community routes must call community permission helpers — `@Roles(CREATOR)` is not enough.

## Code evidence

- `RolesGuard`, `AdminFullGuard`, `community-permissions.constants.ts`

## Consequences

- No XL consolidation on the R4 roadmap. R4 is documentation + review of new routes, not a merge.
