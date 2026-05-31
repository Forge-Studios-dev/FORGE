# UX Audit (Phase 11)

## Pages

| Page | Path | Loading | Error | Success | Notes |
|------|------|---------|-------|---------|-------|
| Login | `/login` | Button disabled | Inline + codes | Redirect | Google CTA when enabled |
| Signup | `/signup` | Same | Same | Redirect | Verification notice |
| Forgot password | `/forgot-password` | Same | Same | Neutral copy | No enumeration |
| Reset password | `/reset-password` | Same | Token invalid state | → login | |
| Verify email | `/verify-email` | Spinner | Invalid link | Auto-login refresh | |
| Session expired | `/session-expired` | — | — | Login CTA | Preserves `next` |
| OAuth callback | `/auth/oauth/callback` | Message | Error link | → home | |
| Active sessions | Profile settings | Query loading | API error | List + revoke | |

## Missing / backlog

- Dedicated OTP page (not planned — links only)
- Login history timeline (API has session metadata only)
- “Add password” for Google-only accounts
- Mobile `/session-expired` route

## Unauthorized states

- Middleware → login with `next`
- API 403 → toast or error boundary per feature
- Creator unverified → `/verify-email` or upload step gate
