# Authentication

Identity: **custom JWT + Postgres refresh sessions** — not Firebase Auth. Schemas: [API_SCHEMAS.md](./API_SCHEMAS.md).

---

## API endpoints

| Endpoint | Notes |
|----------|--------|
| `POST /auth/login` | `{ accessToken, refreshToken, sessionId, user }` + HttpOnly `forge_refresh` |
| `POST /auth/oauth/exchange` | Exchange one-time Google OAuth `code` (60s TTL) for `{ accessToken, sessionId, user }`; refresh via HttpOnly cookie |
| `GET /auth/google/callback` | Sets refresh cookie; redirects to web with `?code=` only (no tokens in URL) |
| `POST /auth/refresh` | Body `{ refreshToken }` or cookie |
| `POST /auth/logout` | `{ allDevices?: boolean }` — default: current device only |
| `GET /auth/sessions` | List devices |
| `DELETE /auth/sessions/:id` | Revoke one |

Refresh tokens: opaque, SHA-256 hashed, rotated each refresh. Reuse of revoked token revokes **all** sessions.

---

## Clients

| Client | Storage |
|--------|---------|
| **Web** | Access in memory/`sessionStorage`; `forge_access_token` cookie for middleware; HttpOnly refresh on API host |
| **Admin** | `forge_admin_token` + same refresh cookie; `withCredentials` |
| **Mobile** | `flutter_secure_storage`; refresh in JSON body |

Production: `AUTH_REFRESH_COOKIE_DOMAIN=.forgestudios.net` when web and API are on different subdomains.

Protected routes: `apps/web/src/middleware.ts`. Return path: `?next=` (`@forge/shared-types` `safe-return-path`).

---

## Enable Google + SMTP + Firebase admin (production)

```bash
cp secrets/auth-deploy.env.example secrets/auth-deploy.env
# Fill Google OAuth, SMTP, FIREBASE_* (see below)
bash scripts/deploy-auth-secrets.sh
bash scripts/verify-production-auth.sh
```

Expect `GET /platform/config`:

- `auth.googleOAuth: true`
- `auth.mailConfigured: true`
- `firebase.adminConfigured: true`
- `firebase.usesFirebaseAuth: false`

**Google OAuth redirect:** `https://api.forgestudios.net/api/v1/auth/google/callback`  
**Origins:** `https://forgestudios.net`, `http://localhost:3000`

**SMTP:** Resend/SendGrid/Mailgun — set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` on Fly.

**Local mail:** `npm run auth:bootstrap` → Mailpit at `http://localhost:8025`

**Firebase service account blocked by org policy:** use workload identity — `bash scripts/deploy-firebase-json-secret.sh` or see script output for WIF steps.

**Scripts:** `check-auth-env.sh` · `enable-production-auth-features.sh` · `audit-production-auth.sh`

Push (FCM): [FIREBASE.md](./FIREBASE.md)

---

## Verify locally

```bash
npm run test --workspace=apps/api -- --testPathPattern=auth
cd apps/web && npm run test:e2e -- e2e/auth-nav.spec.ts
```
