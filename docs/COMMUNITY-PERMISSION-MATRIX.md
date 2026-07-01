# Community Permission Matrix

**Canonical source (code):** `apps/api/src/modules/communities/community-permissions.constants.ts`

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
