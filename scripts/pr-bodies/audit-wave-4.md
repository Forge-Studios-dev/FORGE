## Summary

- **Wave 4:** Stripe checkout/webhooks/cancel, Mux signed playback, Redis throttler, audit migration, web membership UI
- **Wave 5:** Redis tier cache (F-505) + `checkAccess` cache with version-bump invalidation (F-1301)
- **Wave 6:** Blocking Jest coverage gate on billing/entitlements (F-1201); Flutter baseline tests (F-1202)
- **Wave 7:** Mobile gated playback UX + signed HLS passthrough (F-1102)
- **Wave 8:** `API_VERSIONING.md`, `operations/REDIS.md`, audit docs updated

## Test plan

- [x] `npm run test -w @forge/api` (146 tests)
- [x] `npm run test:cov -w @forge/api`
- [x] `flutter test` in `apps/mobile`
- [x] `npm run migration:run:ts -w @forge/api`

## Post-merge

- Fly secrets per `docs/DEPLOY.md` Phase 6 (Stripe + Mux signing)
- Staging smoke per `docs/QA.md` (gated VOD/live + Stripe checkout)
