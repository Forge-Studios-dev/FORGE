# Community Permission Matrix

**Enforcement status (updated 2026-08-29):** This matrix is the **display** source
for `GET /api/v1/communities/:communityId/permissions/matrix` and the **lookup table**
for fine-grained checks via `CommunityAccessService.assertCommunityPermission` /
`permissionsForRole` (e.g. `view_analytics`, `manage_events`). Coarse
moderation paths still use `assertModeratorAccess` / `assertAdminAccess` in
`community-moderation.service.ts`, plus `CommunityRoleGuard` /
`CommunityStudioGuard`. Keep matrix constants and those gates aligned — do not
treat the matrix as decorative-only.

**Matrix source (code):** `apps/api/src/modules/communities/community-permissions.constants.ts`
**Actual enforcement (code):** `apps/api/src/modules/communities/community-moderation.service.ts` (`assertModeratorAccess`, `assertAdminAccess`), `guards/community-role.guard.ts`, `guards/community-studio.guard.ts`, and several endpoints (`updateCommunity`, `exportMembersCsv`, `communityAnalytics`) that are literal-creator-only via `assertOwnedCommunity` — stricter than the matrix implies for `admin`/`coach`, not looser.

**Security audit, 2026-08-09** (`docs/PLATFORM_AUDIT_2026-08-09.md §2.1 #6`): checked every real enforcement path against this matrix. Found and fixed one genuine over-permissive gap — `assignRole` let a delegated `ADMIN` (not just `OWNER`) grant `owner`/`admin` roles to anyone, a privilege-escalation path the matrix's `assign_roles` key (owner-only) was supposed to prevent. Fixed in `community-moderation.service.ts` (`hasOwnerPrivileges` gate on the two top-tier role grants) — `ADMIN` can still assign `moderator`/`coach`. Every other checked path was **stricter** than the matrix (e.g. `coach`'s documented `view_analytics`/`manage_events` access didn't actually exist — those routes were creator-only or owner/admin-only) — a completeness gap for delegated roles, not a vulnerability.

**Completeness gap closed, 2026-08-12:** `coach`/`moderator` now reach exactly the routes the matrix already documented for them, no more:
- `GET creators/me/communities/:communityId/analytics` — was literal-creator-only (`community.creatorId !== actorId`, no delegated role considered at all, and gated behind `CreatorApprovedGuard` which requires the *caller* to be a platform-approved creator — blocking a delegated coach who may not be a creator on their own account). Now uses `CommunityRoleGuard` + `CommunityAccessService.assertCommunityPermission(..., 'view_analytics')`: owner/admin/coach (matrix's `view_analytics` holders) or platform `ADMIN`.
- Event studio routes (`POST/PATCH/DELETE .../events/:eventId`, `GET .../events/:eventId/rsvps`) — were owner/admin-only via the blanket `CommunityStudioGuard`. Now use `CommunityRoleGuard` + `@CommunityRoles(OWNER, ADMIN, MODERATOR, COACH)` matching `manage_events`, and `CommunityEventsService` asserts via the same new `assertCommunityPermission('manage_events')` helper.

`CommunityStudioGuard`/`assertCommunityStudioAccess` (owner/admin-only, unchanged) still gates posts/rooms/members and every other studio mutation the matrix reserves for owner/admin — this change only extended the two capabilities the matrix explicitly grants to `coach`/`moderator`. See `CommunityAccessService.assertCommunityPermission` (`community-access.service.ts`).

**API:** `GET /api/v1/communities/:communityId/permissions/matrix`

## Role → permissions

| Role | Permissions |
|------|-------------|
| **owner** | All 14 community permissions |
| **admin** | All except `assign_roles` |
| **moderator** | view, post, manage_posts, moderate, ban, suspend, approve_join_requests, manage_events |
| **coach** | view, post, manage_posts, manage_events, view_analytics |
| **member** | view_community, post_in_community |

## Permission keys

`view_community` · `post_in_community` · `manage_posts` · `manage_rooms` · `manage_channels` · `manage_events` · `moderate_content` · `ban_members` · `suspend_members` · `approve_join_requests` · `assign_roles` · `export_members` · `view_analytics` · `manage_settings`

Room-level overrides: `community-room-permissions.service.ts`

**Task tracker:** [FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md](./FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md) — `CEOS-P14-T004`, `CEOS-P14-T028`
