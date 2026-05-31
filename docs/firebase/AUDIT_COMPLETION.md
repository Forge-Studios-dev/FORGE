# Firebase Architecture Audit — Completion

**Status:** Complete and shipped on `main` (2026-05-31).

| Plan todo | Deliverable | Status |
|-----------|-------------|--------|
| docs-firebase-pack | 10+ docs under `docs/firebase/` | Done |
| analytics-client-wire | Web/mobile → `POST /analytics/events` | Done |
| sentry-web-admin | `@sentry/nextjs` web + admin | Done |
| oauth-passport | Google OAuth + `oauth_accounts` | Done |
| fcm-backend | `device_tokens`, push-dispatch worker, Admin SDK | Done |
| fcm-clients | Web SW + Flutter `forge_push.dart` | Done |
| app-check | Guard + web/mobile attestation | Done |
| session-hardening | `forge_session` cookie + ADR | Done |

## PRs merged

| PR | Scope |
|----|--------|
| [#26](https://github.com/Forge-Studios-dev/FORGE/pull/26) | Firebase complement + enterprise auth |
| [#27](https://github.com/Forge-Studios-dev/FORGE/pull/27) | EmailVerifiedGuard Fly boot fix |
| [#28](https://github.com/Forge-Studios-dev/FORGE/pull/28) | Release smoke curl retries |
| [#29](https://github.com/Forge-Studios-dev/FORGE/pull/29) | Post-deploy verification docs |
| [#30](https://github.com/Forge-Studios-dev/FORGE/pull/30)–[#32](https://github.com/Forge-Studios-dev/FORGE/pull/32) | Audit closure + platform `auth`/`firebase` config |
| [#33](https://github.com/Forge-Studios-dev/FORGE/pull/33) | Web Google OAuth from platform config |

## Production verified

- Release workflow green
- API health + public smoke passing
- `GET /platform/config` exposes `auth.provider=custom`, `firebase.usesFirebaseAuth=false`
- Neon migrations applied (`oauth_accounts`, `device_tokens`, `users.is_active`)

## Rejected by design (per plan)

Firebase Auth (primary), Firestore, RTDB, Hosting, Storage, Firebase Analytics as primary.

## Optional enablement (ops)

See [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) and [../auth-enterprise/POST_DEPLOY.md](../auth-enterprise/POST_DEPLOY.md):

- Fly `FIREBASE_*` + `FCM_ENABLED`
- Vercel `NEXT_PUBLIC_FIREBASE_*`
- `flutterfire configure` for mobile
- `APP_CHECK_ENABLED` after clients attest

## Related audits

- Enterprise email auth: [../auth-enterprise/README.md](../auth-enterprise/README.md)
- Shipping: [../audits/SHIPPING_FIREBASE.md](../audits/SHIPPING_FIREBASE.md)
