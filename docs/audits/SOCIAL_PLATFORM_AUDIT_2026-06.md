# FORGE Social Platform Audit — June 2026

**Date:** 2026-06-10 (re-audit completed)  
**Scope:** Full-stack social features (API, web, mobile, workers)  
**Complements:** [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md), [INFRASTRUCTURE_COST_AUDIT_2026-06.md](./INFRASTRUCTURE_COST_AUDIT_2026-06.md)

---

## 1. Industry Comparison

| Area | Industry pattern (YouTube, Twitch, Patreon, Skillshare, Discord) | FORGE alignment |
|------|------------------------------------------------------------------|-----------------|
| Likes | Idempotent toggle, denormalized counts + reconciliation | Implemented with daily reconciliation worker |
| Comments | Cursor pagination, 1-level replies, edit/delete, rate limits | Full CRUD + likes + viewerLiked enrichment |
| Follows | Graph lists, follow notifications, following feed | Implemented (API + web + mobile) |
| Subscriptions | Entitlement cache, cancel flow, expiring reminders | Cancel added; Stripe cancel deferred F-1101 |
| Feed | Separate discovery vs following surfaces | Discover / Following tabs (web + mobile) |
| Notifications | Event-driven, batch insert, push + socket badge | Social triggers + pagination + mark-all-read |
| Live | Ephemeral reactions (Redis), viewer counts | REST seed + socket overlay (web + mobile) |
| DM | Conversation model, read receipts | Module + web/mobile inbox with read POST |

---

## 2. Current FORGE Status (post re-audit)

### API
- Engagement: likes, comments (CRUD, replies, likes, `viewerLiked` via optional JWT), follows, follow lists
- Feed: latest, popular, forYou, **following**
- Notifications: social types, unread count, mark-all-read, cursor pagination, socket delivery
- Communities: message soft-delete + `channel:message:delete` socket
- Entitlements: subscription cancel
- Direct messages: conversations, send, list, read receipts
- Workers: daily engagement reconciliation (video likes, follow counts, comment likes, **video comment counts**)
- Streaming: `GET /streams/:id/reactions` (Redis SMEMBERS + MGET, no KEYS scan)

### Web
- CommentsPanel: load-more, replies, edit/delete, like, report, like counts
- Following feed tab, follower/following pages
- Notification badge + pagination + mark all read + unread invalidation on single read
- Messages inbox with read receipts on open
- StreamReactionPanel on live watch
- CommunityPanel: virtualized list, delete UI, delete socket handler
- Studio community: moderate link per channel

### Mobile
- Feed: Discover / Following tabs, infinite scroll, optimistic like
- Watch: comment pagination, likes, reply, socket sync
- Live: list socket sync (`join-live-feed`), watch reactions + socket cleanup
- Profile: follower/following list screens
- Notifications: pagination, mark read, mark all read
- Messages inbox (basic)
- Community socket cleanup

---

## 3. Gap Analysis (remaining)

| Gap | Priority | Notes |
|-----|----------|-------|
| Stripe subscription cancel webhook | Medium | F-1101 |
| Comment moderation queue UI (admin) | Medium | Reports support `comment` type |
| Group DM / channels | Low | 1:1 DM only |
| Community posts vs messages | Low | Messages remain primitive |
| Search sidecar at scale | Deferred | F-1302 |
| Mobile comment edit/delete UI | Low | API supported; mobile has like/reply/pagination |

---

## 4. Critical Issues (addressed)

- Denormalized count drift → daily reconciliation job (includes `videos.comment_count`)
- Mobile/web socket listener leaks → fixed with stored handlers + `off()`
- Missing comment reports → web CommentsPanel report flow
- No following feed on mobile → implemented
- Live reaction scale → Redis set index replaces KEYS scan

---

## 5. Scalability Risks

- Like notifications batched via Redis NX dedupe (1h)
- Following feed cached per-user with generation bump
- DM fan-out uses user rooms (scales with socket replicas via Redis adapter)
- Stream reactions use Redis INCR + reaction-type set (O(types) not O(keys))

---

## 6. Performance Issues (addressed)

- Stream chat redundant invalidation removed on web
- Community messages virtualized on web
- Comments socket effect stabilized
- Feed following uses indexed creator filter + cache

---

## 7. Cost Issues

- Reconciliation: 1 daily job (minimal Neon load)
- Following feed cache reduces repeat queries
- No new always-on services; reuses existing worker app

---

## 8. Recommended Improvements (shipped)

Key modules:

- `apps/api/src/modules/engagement/*`
- `apps/api/src/modules/direct-messages/*`
- `apps/api/src/modules/feed/feed.service.ts`
- `apps/api/src/modules/notifications/*`
- `apps/api/src/modules/streaming/stream-reaction.service.ts`
- `apps/web/src/components/Comments/CommentsPanel.tsx`
- `apps/web/src/components/live/StreamReactionPanel.tsx`
- `apps/web/src/components/Community/CommunityPanel.tsx`
- `apps/mobile/lib/features/feed/*`, `watch/*`, `live/*`, `messages/*`

---

## 9. Code Changes Summary

Migration: `1796000000000-social-platform-audit.ts`  
New queue: `engagement-reconciliation`  
New socket events: `notification:new`, `dm:message`, `stream:reaction`, `channel:message:delete`  
New REST: `GET /streams/:id/reactions`, optional JWT on comment list endpoints

---

## 10. Prioritized Roadmap

| Priority | Item | Status |
|----------|------|--------|
| Critical | Reconciliation, sockets, comment reports | Done |
| High | Comments, following feed, follow lists, social notifications, mobile parity | Done |
| Medium | Chat perf, community delete, sub cancel, notification pagination | Done |
| Low | Live reactions, DM module, mobile DM/followers | Done |

---

## 11. Validation Checklist

- [x] Like/unlike video (web + mobile optimistic)
- [x] Comment create, reply, load more, delete (author) — web full; mobile like/reply/pagination
- [x] Follow/unfollow + follower/following pages (web + mobile)
- [x] Following feed tab (authenticated, web + mobile)
- [x] Notifications: new follower, comment, like (deduped)
- [x] Unread badge + mark all read
- [x] DM send/receive + socket + read receipts
- [x] Live stream reaction overlay (web + mobile)
- [x] Community message delete (web)
- [x] Subscription cancel (mock)
- [ ] Regression: live, memberships, creator studio, admin (manual QA before merge)

Run before merge: `npm run build --workspace=apps/api`, `npm run build --workspace=apps/web`, targeted `npm run test --workspace=apps/api`.
