# Next.js Integration Guide (App Router)

FORGE web auth uses the **NestJS API** as identity provider — not Firebase Auth SDK for login.

## Stack

| Piece | Path / package |
|-------|----------------|
| Auth context | `apps/web/src/lib/auth.tsx` |
| Token storage | `apps/web/src/lib/auth-storage.ts` |
| API client + refresh | `apps/web/src/lib/api.ts` |
| Route protection | `apps/web/src/middleware.ts` |
| App Check | `apps/web/src/lib/app-check.ts` |
| FCM (post-login) | `apps/web/src/lib/fcm.ts` |

## Sign up / sign in (client components)

```tsx
import { api } from '@/lib/api';
import { persistAuthSession } from '@/lib/auth-storage';
import { getAppCheckToken } from '@/lib/app-check';

const appCheck = await getAppCheckToken();
const { data } = await api.post('/auth/login', { email, password }, {
  headers: appCheck ? { 'X-Firebase-AppCheck': appCheck } : undefined,
});
persistAuthSession(
  data.data.accessToken,
  data.data.refreshToken,
  JSON.stringify(data.data.user),
  data.data.sessionId,
);
```

Cookies set by API response (with `withCredentials: true`):

- `forge_refresh` — HttpOnly refresh token
- `forge_session` — middleware session marker

Access token: `sessionStorage` + `forge_access_token` cookie mirror for middleware.

## Middleware

Decodes `forge_access_token` (no signature verify — API enforces). Checks:

- Valid non-admin JWT + optional `forge_session`
- Protected routes → `/login?next=`
- Creator upload → `role === creator` + `isVerified === true`

Shared helpers: `@forge/shared-types/consumer-session`.

## Google OAuth

Link to API (not Firebase):

```tsx
const API_URL = process.env.NEXT_PUBLIC_API_URL;
<a href={`${API_URL}/auth/google`}>Continue with Google</a>
```

Callback: `/auth/oauth/callback` reads tokens from redirect query, calls `persistAuthSession`.

## Email verification

- Signup → `/verify-email?welcome=1`
- Link → `/verify-email?token=...` → API `GET /auth/verify-email` → `POST /auth/refresh`
- Resend: `POST /auth/verify-email/resend` (authenticated)

## Session expired

Server page: `apps/web/src/app/session-expired/page.tsx` — preserves `next` for login.

## Server Components

Do not read `sessionStorage` on server. For SSR user state:

- Use public data without auth, or
- Read `forge_access_token` cookie in Server Component and call internal API with Bearer token (short-lived).

Default pattern: client `AuthProvider` + `fetchMe` on mount.

## Environment variables

See `apps/web/.env.example`:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`
- `NEXT_PUBLIC_FIREBASE_*` (App Check + FCM only)

## Server Actions

Prefer existing `api` axios instance from client forms. If using Server Actions for auth:

1. Call API with `fetch` + `credentials: 'include'`
2. Forward `Set-Cookie` via `cookies().set` is fragile cross-domain — **keep auth on client + API cookies** for Vercel ↔ Fly.

## Related

- [DELIVERABLES.md](./DELIVERABLES.md)
- [docs/AUTH_SESSION.md](../AUTH_SESSION.md)
- [docs/firebase/AUTH_DESIGN.md](../firebase/AUTH_DESIGN.md)
