# FORGE Firebase Integration Docs

Firebase is used **selectively** — not as the platform core.

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE_REPORT.md](./ARCHITECTURE_REPORT.md) | Audit summary and adopted/rejected services |
| [AUTH_DESIGN.md](./AUTH_DESIGN.md) | Passport Google OAuth (no Firebase Auth) |
| [FCM_NOTIFICATIONS.md](./FCM_NOTIFICATIONS.md) | Push dispatch architecture |
| [MONITORING.md](./MONITORING.md) | Sentry + existing API observability |
| [ANALYTICS.md](./ANALYTICS.md) | First-party event catalog |
| [SECURITY.md](./SECURITY.md) | Findings and App Check |
| [COST_ANALYSIS.md](./COST_ANALYSIS.md) | Firebase cost tiers |
| [CLI_SETUP.md](./CLI_SETUP.md) | Firebase CLI and secrets |
| [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) | Phased rollout |
| [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) | Pre-ship checklist |
| [SESSION_HARDENING.md](./SESSION_HARDENING.md) | HttpOnly `forge_session` ADR |

Repo config: [`firebase/`](../../firebase/) (project aliases only — no Hosting/Firestore deploy).

Shipping: [SHIPPING_FIREBASE.md](../audits/SHIPPING_FIREBASE.md) — branch `feat/firebase-integration`, CI verified.
