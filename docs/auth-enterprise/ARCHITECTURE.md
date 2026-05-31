# Authentication Architecture

## Phase 1 — Current audit verdict

| Component | Verdict | Notes |
|-----------|---------|-------|
| Custom JWT + opaque refresh (Postgres) | **KEEP** | Rotation, reuse detection, device sessions |
| Email/password signup & login | **KEEP** | bcrypt(12), strong password DTO |
| Email verification (link) | **KEEP** | 48h token; soft enforcement for viewers |
| Forgot/reset password | **KEEP** | 1h token; revokes all sessions on reset |
| Google OAuth (Passport) | **KEEP** | Account linking by email |
| HttpOnly `forge_refresh` + `forge_session` | **KEEP** | Web middleware marker |
| Firebase Auth as IdP | **DO NOT USE** | Duplicates users; breaks PR #26 architecture |
| Firebase Admin | **KEEP** | FCM + App Check only |
| Disposable email block | **ENHANCED** | Signup blocklist |
| Account lockout | **ENHANCED** | Redis-backed failed login |
| OTP codes | **DEFER** | See OTP_RECOMMENDATION.md |
| MFA / TOTP | **POST-PMF** | |

## System diagram

```mermaid
flowchart TB
  subgraph clients [Clients]
    Web[Next.js]
    Mobile[Flutter]
    Admin[Admin app]
  end
  subgraph api [NestJS API]
    Auth[AuthModule]
    PG[(users)]
    RT[(refresh_tokens)]
    OAuth[(oauth_accounts)]
    RST[(password_reset_tokens)]
    Redis[(Redis lockout)]
  end
  subgraph firebase_complement [Firebase complement only]
    FCM[FCM push]
    AppCheck[App Check]
  end
  Web --> Auth
  Mobile --> Auth
  Admin --> Auth
  Auth --> PG
  Auth --> RT
  Auth --> OAuth
  Auth --> RST
  Auth --> Redis
  Auth -.-> AppCheck
```

## Why not Firebase Authentication for email

| Requirement | Custom auth | Firebase Auth primary |
|-------------|-------------|------------------------|
| Single user in Postgres | Native | Sync / dual-write |
| Refresh rotation + session list | Built | Rebuild |
| Admin impersonation | Built | Custom claims |
| Creator RBAC | JWT + guards | Second token type |
| Cost at scale | Postgres + Redis | Per MAU pricing |
| SSR with Next.js | Cookie mirror pattern | Session cookie migration |

**Recommendation:** Enterprise behavior via **enhanced custom auth** + Firebase **App Check/FCM** only.
