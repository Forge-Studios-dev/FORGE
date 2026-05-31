# Authentication Design (No Firebase Auth)

Enterprise email auth audit (verification, reset, lockout, OTP recommendation): [docs/auth-enterprise/README.md](../auth-enterprise/README.md).

## Decision

FORGE keeps **custom JWT + opaque refresh tokens** in Postgres. Firebase Auth is **not** the primary identity provider.

## Why not Firebase Auth

- Single user of record in Postgres (`users`, RBAC, creator tiers)
- Refresh rotation, session list, impersonation already built
- API uses Passport JWT + global guards
- Web middleware uses `forge_access_token` cookie mirror
- Mobile uses secure storage + same API tokens

## OAuth (Google)

Implemented via **Passport `google-oauth20`** (not Firebase):

1. `GET /auth/google` — redirect to Google
2. `GET /auth/google/callback` — link or create user via `oauth_accounts`
3. Same `issueTokens()` as email login
4. Web: redirect to API callback → `persistAuthSession()`

### `oauth_accounts` table

| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid FK users |
| provider | varchar (`google`) |
| provider_id | varchar |
| email | varchar nullable |
| created_at | timestamptz |

Unique on `(provider, provider_id)`.

## Environment

```bash
GOOGLE_OAUTH_ENABLED=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_CALLBACK_URL=https://api.example.com/api/v1/auth/google/callback
WEB_OAUTH_SUCCESS_URL=https://forgestudios.net/auth/oauth/callback
```

## SSR / middleware

- No Firebase session cookies
- Route protection unchanged in `apps/web/src/middleware.ts`
- Sensitive Server Components should call API with Bearer token

## Hybrid Firebase Auth

Only consider if product mandates Firebase console for identity. Would require ADR and token exchange endpoint — **not implemented**.
