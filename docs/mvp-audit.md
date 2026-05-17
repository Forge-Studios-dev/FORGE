# MVP audit summary

**Last updated:** 2026-05-16  
**Verdict:** Core production blockers addressed in this pass; see [mvp-test-matrix.md](./mvp-test-matrix.md) for role-based QA.

## What was fixed (remediation pass)

### API
- Opaque refresh tokens on `POST /auth/refresh` (no JWT refresh guard mismatch)
- `OptionalJwtAuthGuard` on public feed routes for `forYou` personalization
- Public read routes for user profiles (`by-username`, `:id`, videos, playlists)
- Socket.IO connects with verified JWT (`auth.token`), not client-supplied `userId`
- Analytics ingest rate limit; admin user patch DTO validation

### Web
- Watch page uses `WatchExperience` with guest gates and report flow
- `VideoPlayer` records watch progress (`POST /videos/:id/watch`)
- Unified auth storage (cookie + localStorage) and `/users/me` on boot
- Session refresh failure → `/session-expired`
- Studio videos use `getMyVideos()`; explore prioritizes API categories
- Mobile nav shows Studio for approved creators

### Admin
- Route middleware (`forge_admin_token` cookie)
- `/unauthorized` for non-admin logins
- Confirmations on role change, content removal, report dismiss
- Analytics bar chart (recharts); report deep links to web watch URLs
- Token refresh interceptor

### Mobile
- Native upload (file picker → presign → S3 PUT → complete)
- Creator upload gate on `/upload`
- Profile video grid, follow, comments on watch, like on feed
- Explore loads API categories; logout in settings
- User JSON persisted for router gates

## Latest pass (continued)

- Email verification required before creator application (API)
- Production guard: Mux must be configured to go live (`ServiceUnavailableException`)
- SMTP missing logs error in production
- Playlist create UI aligned with design system
- Mobile upload supports optional skill tag; refresh persists user JSON
- Admin login inline validation
- `users.service.spec.ts` for creator request rules

## Still deferred (post-MVP)

- Google OAuth
- Push notifications (mobile)
- Playlists on mobile
- Dedicated creator analytics API
- Full blueprint parity for every Stitch error/empty state
- E2E test suite expansion

## Canonical matrices

- Feature matrix: [FORGE_PROJECT_MASTER.md §24](./FORGE_PROJECT_MASTER.md#24-implementation-status-mvp-audit)
- Test matrix: [mvp-test-matrix.md](./mvp-test-matrix.md)
