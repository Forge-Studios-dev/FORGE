# Deferred backlog status — Phase 5 of INFRA_AUDIT_2026-07-29 remediation

## F-1101 Stripe Connect payouts + signed Mux URLs

**Status:** Scaffolded, not fully productized this pass.
- `users.stripe_connect_account_id` column already exists on `User`.
- Recurring memberships (F-1101a) already shipped.
- Remaining work: Connect onboarding OAuth, payout dashboard, signed Mux playback for DRM-grade content.
- **Trigger:** Before creator payouts or DRM playback go live.
- **Owner:** Product + backend. See `docs/audits/DEFERRED_BACKLOG.md`.

## F-1302 Search sidecar

**Status:** Documented; Postgres FTS remains the production path.
- No Meilisearch/Typesense deploy until FTS p95 degrades or catalog >500K videos.
- Re-evaluate with live `pg_stat_statements` when Neon credentials available.

## 100K entitlement load test

**Status:** Harness stub added at `scripts/load/entitlements-k6.js` (k6).
- Run against staging only: `k6 run -e BASE_URL=... -e TOKEN=... scripts/load/entitlements-k6.js`
- **Trigger:** 50K MAU or pre-major marketing push.

## Ops cadence

| Item | Next due | Notes |
|------|----------|-------|
| Neon restore drill | ~2026-10-22 | `docs/operations/DISASTER_RECOVERY.md` |
| Mux monthly cost review | First week each month | Needs Mux dashboard access |
| npm audit fix-all | Ongoing | Critical gate in CI; high non-blocking |
