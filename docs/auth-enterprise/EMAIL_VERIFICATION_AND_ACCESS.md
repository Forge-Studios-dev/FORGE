# Email verification and unverified-user access

FORGE uses **custom auth + SMTP** (Resend, etc.) for verification emails — **not** Firebase Authentication email templates.

## Unverified users (signed in)

| Allowed | Blocked (API returns `EMAIL_NOT_VERIFIED`) |
|---------|---------------------------------------------|
| Watch videos | Like / unlike |
| Search & browse | Comment |
| View public profiles | Follow (subscribe) |
| | Playlists / library mutations |
| | Report content |
| | Upload / go live (also requires creator approval) |

Web shows **Verify your email** modal when a signed-in unverified user tries engagement actions.

## Verification email

- Sent on signup and via `POST /auth/verify-email/resend` (JWT).
- Admin: `POST /admin/users/:id/resend-verification`.
- Requires Fly `SMTP_*` + `MAIL_FROM` (see `secrets/auth-deploy.env.example`).
- If send fails, API returns `503` with `MAIL_NOT_CONFIGURED` or `MAIL_DELIVERY_FAILED` (not silent skip in production).

## Firebase Console

- **Authentication → Users** stays empty by design.
- **Authorized domains** apply only if you later adopt Firebase Auth; current web verify links use `WEB_URL` / `forgestudios.net`.
