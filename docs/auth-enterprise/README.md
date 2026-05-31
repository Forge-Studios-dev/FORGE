# FORGE Enterprise Authentication Audit

Production-grade email auth, recovery, sessions, and security — **built on custom JWT + Postgres**, not Firebase Auth as primary identity.

| Document | Contents |
|----------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Phase 1 audit, system diagram, KEEP/REPLACE |
| [EMAIL_SIGNUP_SIGNIN.md](./EMAIL_SIGNUP_SIGNIN.md) | Phases 2–3 email flows |
| [PASSWORD_RESET.md](./PASSWORD_RESET.md) | Phase 4 forgot/reset |
| [OTP_RECOMMENDATION.md](./OTP_RECOMMENDATION.md) | Phase 5 OTP vs link |
| [GOOGLE_ACCOUNT_LINKING.md](./GOOGLE_ACCOUNT_LINKING.md) | Phase 6 Google + email |
| [SESSION_MANAGEMENT.md](./SESSION_MANAGEMENT.md) | Phase 7 sessions |
| [SECURITY.md](./SECURITY.md) | Phases 8 & 12 |
| [MIDDLEWARE_ROUTES.md](./MIDDLEWARE_ROUTES.md) | Phase 9 route matrix |
| [FIREBASE_INTEGRATION.md](./FIREBASE_INTEGRATION.md) | Phase 10 CLI + why not Firebase Auth |
| [UX_AUDIT.md](./UX_AUDIT.md) | Phase 11 pages & states |
| [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) | Phase 13 checklist |

Related: [docs/firebase/AUTH_DESIGN.md](../firebase/AUTH_DESIGN.md), [docs/AUTH_SESSION.md](../AUTH_SESSION.md).
