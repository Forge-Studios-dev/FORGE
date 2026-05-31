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
| [NEXTJS_INTEGRATION.md](./NEXTJS_INTEGRATION.md) | Phase 10 Next.js App Router guide |
| [UX_AUDIT.md](./UX_AUDIT.md) | Phase 11 pages & states |
| [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) | Phase 13 checklist |
| [DELIVERABLES.md](./DELIVERABLES.md) | All Phase 13 diagrams + reports (single doc) |
| [POST_DEPLOY.md](./POST_DEPLOY.md) | Migrations, secrets, smoke tests after merge |
| [ENABLEMENT_GUIDE.md](./ENABLEMENT_GUIDE.md) | **Enable Google, SMTP, Firebase on production** |
| [FIREBASE_CONNECTION_BLOCKER.md](./FIREBASE_CONNECTION_BLOCKER.md) | **Firebase not connected — owner fix steps** |
| [IMPLEMENTATION_STATUS_AUDIT.md](./IMPLEMENTATION_STATUS_AUDIT.md) | **Are we on Firebase Auth? Feature checklist** |

Related: [docs/firebase/AUTH_DESIGN.md](../firebase/AUTH_DESIGN.md), [docs/AUTH_SESSION.md](../AUTH_SESSION.md).
