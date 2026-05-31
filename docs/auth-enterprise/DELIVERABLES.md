# Phase 13 — Final Deliverables

Consolidated diagrams and reports for the FORGE enterprise authentication audit.

---

## 1. Authentication Architecture

```mermaid
flowchart TB
  subgraph clients [Clients]
    Web[Next.js App Router]
    Mobile[Flutter]
    Admin[Admin Next.js]
  end
  subgraph identity [Identity - System of Record]
    API[NestJS AuthModule]
    PG[(users)]
    RT[(refresh_tokens)]
    OAuth[(oauth_accounts)]
  end
  subgraph complement [Firebase Complement Only]
    AppCheck[App Check]
    FCM[FCM Push]
  end
  Web --> API
  Mobile --> API
  Admin --> API
  API --> PG
  API --> RT
  API --> OAuth
  API -.-> AppCheck
  API -.-> FCM
```

**Decision:** Custom JWT + Postgres — not Firebase Auth primary. See [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 2. Session Flow

```mermaid
sequenceDiagram
  participant C as Client
  participant API as API
  participant DB as refresh_tokens

  C->>API: POST /auth/login
  API->>DB: Insert refresh hash + sessionId
  API-->>C: access JWT + HttpOnly forge_refresh + forge_session
  Note over C: Access in sessionStorage + cookie mirror
  C->>API: API call with Bearer JWT
  alt JWT expired
    C->>API: POST /auth/refresh (cookie)
    API->>DB: Revoke old, insert new refresh
    API-->>C: New access JWT
  else Refresh invalid
    C->>C: Redirect /session-expired
  end
```

Details: [SESSION_MANAGEMENT.md](./SESSION_MANAGEMENT.md).

---

## 3. Email Verification Flow

```mermaid
sequenceDiagram
  participant U as User
  participant API as API
  participant Mail as SMTP

  U->>API: POST /auth/signup
  API->>Mail: Link 48h (hashed token in DB)
  U->>API: GET /auth/verify-email?token=
  API->>API: isVerified=true, clear hash
  U->>API: GET /users/me (refresh profile)
```

- Resend: `POST /auth/verify-email/resend` (JWT, throttled)
- Web middleware blocks creator **upload** until JWT `isVerified`
- API: `CreatorApprovedGuard` + optional `@RequireVerified()`

Details: [EMAIL_SIGNUP_SIGNIN.md](./EMAIL_SIGNUP_SIGNIN.md).

---

## 4. Password Reset Flow

```mermaid
sequenceDiagram
  participant U as User
  participant API as API
  participant DB as Postgres

  U->>API: POST /auth/forgot-password
  API-->>U: 204 (always)
  U->>API: POST /auth/reset-password
  API->>DB: Update password, revoke ALL refresh tokens
```

Details: [PASSWORD_RESET.md](./PASSWORD_RESET.md).

---

## 5. OTP Flow

**Not implemented** — recommendation is verification links only.

```mermaid
flowchart LR
  A[Option A: Email links] --> R[Recommended]
  B[Option B: 6-digit OTP] --> D[Deferred post-PMF]
  C[Option C: Both] --> X[Not needed for MVP]
```

Details: [OTP_RECOMMENDATION.md](./OTP_RECOMMENDATION.md).

---

## 6. Security Audit Report

| Severity | Finding | Status |
|----------|---------|--------|
| Critical | Middleware JWT not signature-verified | Mitigated — API enforces |
| High | Access token readable in JS | Session cookie + short TTL |
| High | No account lockout | **Fixed** — Redis lockout |
| Medium | Soft verification for viewers | By design; strict mode env |
| Medium | No MFA | Post-PMF |
| Low | No dedicated login audit table | Sessions list = device history |

Full report: [SECURITY.md](./SECURITY.md).

---

## 7. Middleware Architecture

| Class | Web | API |
|-------|-----|-----|
| PUBLIC | `/`, `/login`, `/watch` | `@Public()` |
| AUTH_ONLY | `/library`, `/profile` | JWT |
| VERIFIED_CREATOR | `/upload/*` (not become-creator) | `isVerified` + creator approved |
| ADMIN_ONLY | Blocked on consumer host | `role === admin` |

Details: [MIDDLEWARE_ROUTES.md](./MIDDLEWARE_ROUTES.md).

---

## 8. Firebase CLI Setup Guide

Firebase is used for **FCM + App Check only** — not Authentication.

```bash
firebase login
firebase use forge-studios-prod
# Enable Cloud Messaging + App Check in console
```

Full guide: [FIREBASE_INTEGRATION.md](./FIREBASE_INTEGRATION.md) and [docs/firebase/CLI_SETUP.md](../firebase/CLI_SETUP.md).

---

## 9. Next.js Integration Guide

| Concern | Implementation |
|---------|----------------|
| Login/signup | Client components + `api.post` + `persistAuthSession` |
| Cookies | `forge_refresh`, `forge_session`, `forge_access_token` mirror |
| Middleware | `apps/web/src/middleware.ts` — JWT decode + route classes |
| OAuth callback | `/auth/oauth/callback` |
| App Check | `getAppCheckToken()` on auth requests |
| Session expired | `/session-expired` server page |

Not used: Firebase Auth SDK, `signInWithEmailAndPassword`, Firebase session cookies.

Full guide: [NEXTJS_INTEGRATION.md](./NEXTJS_INTEGRATION.md).

---

## 10. Production Readiness Report

Checklist: [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md).

**Verdict:** Production-ready for millions of users on custom auth; Firebase remains a complement.
