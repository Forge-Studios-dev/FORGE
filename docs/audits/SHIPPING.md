# Shipping the Auth & Navigation Audit

The audit implementation touches API, web, admin, mobile, shared-types, CI, and docs. **Do not push directly to `main`** (see repo branching rules).

## Recommended PR path

1. From latest `main`, create a focused branch:

```bash
git fetch origin main
git checkout -b feat/auth-nav-hardening origin/main
```

2. Cherry-pick or copy only audit-related changes if your working tree mixes other work (e.g. Redis migration).

3. Verify locally:

```bash
npm run test --workspace=@forge/shared-types
npm run test --workspace=apps/api
npm run build --workspace=apps/web
cd apps/web && npm run test:e2e -- e2e/auth-nav.spec.ts e2e/smoke.spec.ts
```

4. Production Fly secret (after merge):

```bash
fly secrets set AUTH_REFRESH_COOKIE_DOMAIN='.forgestudios.net' --app forge-studios-api
```

5. Single PR → merge → one production deploy cycle.

## File areas (audit scope)

| Area | Key paths |
|------|-----------|
| API auth | `apps/api/src/modules/auth/*`, `main.ts`, `configuration.ts` |
| Web | `apps/web/src/middleware.ts`, `src/lib/auth*.ts`, `src/lib/api.ts`, `e2e/auth-nav.spec.ts` |
| Admin | `apps/admin/src/lib/api.ts`, `AdminShell.tsx` |
| Mobile | `apps/mobile/lib/core/access/forge_access.dart`, `auth_repository.dart` |
| Shared | `packages/shared-types/src/consumer-session.ts`, `safe-return-path.ts` |
| Docs | `docs/audits/*`, `docs/AUTH_SESSION.md` |
| CI | `.github/workflows/ci.yml`, `scripts/ci-local.sh` |

## Post-merge smoke

- Guest: browse home, watch, explore without login
- Login with `?next=/library` lands on library
- Settings → Active sessions lists devices
- Logout on one browser does not revoke other devices until “Sign out on all devices”
- Admin impersonation link uses `#token=` fragment
