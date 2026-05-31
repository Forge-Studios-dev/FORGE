# Password Reset Flow

```mermaid
sequenceDiagram
  participant U as User
  participant W as Web
  participant API as API
  participant DB as Postgres
  participant Mail as SMTP

  U->>W: POST forgot-password
  W->>API: POST /auth/forgot-password
  API->>DB: Store hashed token 1h
  API->>Mail: Reset link (if user exists)
  API-->>W: 204 always
  U->>W: Open /reset-password?token=
  W->>API: POST /auth/reset-password
  API->>DB: Validate token, update password
  API->>DB: Revoke ALL refresh tokens
  API-->>W: 204
```

## Requirements met

| Requirement | Status |
|-------------|--------|
| Expiring links | 1 hour |
| One-time use | `usedAt` set on consume |
| Abuse protection | 5 requests / hour per IP |
| Enumeration safe | Always 204 on forgot |
| Session revoke | All refresh rows revoked |

## Edge cases

- Unknown email: same 204 response
- Expired/used token: 400 generic message
- User resets while logged in elsewhere: other devices lose refresh on next 401
