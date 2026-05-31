# Middleware & Route Protection (Phase 9)

## Classification

| Class | Web examples | API enforcement |
|-------|--------------|-----------------|
| PUBLIC | `/`, `/login`, `/watch`, `/explore` | `@Public()` |
| AUTH_ONLY | `/library`, `/notifications` | JWT + permissions |
| VERIFIED_CREATOR | `/upload`, `/studio` (creator) | `isVerified` + creator approved |
| ADMIN_ONLY | `admin.forgestudios.net` | `role === admin` + consumer blocked |

## Web middleware (`apps/web/src/middleware.ts`)

- Protected prefixes: `/studio`, `/upload`, `/library`, `/profile`, …
- Requires valid consumer JWT + `forge_session` (or legacy token-only)
- Admin JWT on consumer site → redirect login
- Creator upload paths check JWT `role === creator`

## API guards (order)

`JwtAuthGuard` → `RolesGuard` → `ConsumerOnlyGuard` → `PermissionsGuard` → `ThrottlerGuard`

Optional: `@RequireVerified()` + `EmailVerifiedGuard` on specific routes.

## Bypass prevention

- Direct URL: middleware redirect to `/login?next=`
- API without token: 401
- Admin on consumer API: 403 `ConsumerOnlyGuard`
- Session cookie manipulation alone: insufficient without valid JWT
