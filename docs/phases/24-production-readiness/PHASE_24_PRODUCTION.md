# Phase 24 — Production Readiness

**Status:** Checklist shipped — execute before launch

See [PRODUCTION_CHECKLIST.md](../../operations/PRODUCTION_CHECKLIST.md).

## Gate criteria

1. Migrations applied (incl. caption_url)
2. Mux + Stripe env verified in staging
3. `npm run ci:local` (or equivalent) green
4. No secrets in git; CSRF enabled in prod
5. Rollback plan for Fly + Vercel + Neon
