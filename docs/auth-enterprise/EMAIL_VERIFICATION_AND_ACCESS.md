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
- Requires Fly `RESEND_API_KEY` / `SMTP_PASS` (`re_...`) and `MAIL_FROM` (e.g. `noreply@forgestudios.net`).
- **Resend:** add and verify **forgestudios.net** at [resend.com/domains](https://resend.com/domains) (DNS records). Until verified, sends from `@forgestudios.net` return 403; `onboarding@resend.dev` only delivers to the Resend account email.
- Deploy key: `RESEND_API_KEY=re_xxx bash scripts/set-resend-api-key-fly.sh`
- If send fails, API returns `503` with `MAIL_NOT_CONFIGURED`, `MAIL_AUTH_FAILED`, or `MAIL_DELIVERY_FAILED` (not silent skip in production).

## Firebase Console

- **Authentication → Users** stays empty by design.
- **Authorized domains** apply only if you later adopt Firebase Auth; current web verify links use `WEB_URL` / `forgestudios.net`.
