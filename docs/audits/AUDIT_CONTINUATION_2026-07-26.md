# FORGE — Audit continuation & optimization pass (2026-07-26)

**Type:** Verification of open findings from `FORGE_MASTER_AUDIT_2026-07-22.md` / `DELTA_AUDIT_2026-07-22.md` against current code, plus fixes for confirmed-still-open items. Not a from-scratch re-audit — those two documents plus `COST_AUDIT_2026-07-26.md` already cover the full 8-domain scope in depth; re-deriving them would restate what's on disk.
**Method:** Direct source read + grep of every Critical/High finding, local unit-test validation (`apps/api` Jest, no live DB/Redis/AWS touched), no staging/production access used.

---

## What was verified already fixed (no action needed)

| Finding (master audit ref) | Verified state |
|---|---|
| Critical §5.2#1 — DM Socket.IO room join had no membership check (cross-tenant message leak) | **Fixed.** `events.gateway.ts` `handleJoinConversation` now calls `assertConversationAccess` before `client.join`. |
| Critical §5.7#1 — web/admin unit tests wired but never run in CI | **Fixed.** `ci.yml` runs `npm run test --workspace=@forge/web` (L182) and `--workspace=@forge/admin` (L255). |

## Findings fixed this session

### 1. Destructive wipe script — Redis/S3 blast-radius gap (was: High, DevOps §5.6#1)

- **Why:** `scripts/wipe-platform-data.sh` independently checked only `DATABASE_URL` against production markers. It then hardcoded `FORGE_FLUSH_CONFIRM=yes` when invoking `flush-redis.sh`, unconditionally bypassing that script's own `isLocal` safety check — and the S3 section had no production check at all. A stale prod `REDIS_URL`/`S3_BUCKET_NAME` in the same `.env` as a local `DATABASE_URL` (a realistic misconfiguration, e.g. testing against local Postgres with the real shared media bucket still configured) would pass the one existing guard and then `FLUSHALL` production Redis and recursively delete the entire production media bucket.
- **Evidence:** `scripts/wipe-platform-data.sh:32-43` (old), `scripts/flush-redis.sh:29-33` (the bypassed check).
- **Fix:** `scripts/wipe-platform-data.sh` — `S3_BUCKET_NAME` is now checked independently against the real prod/staging naming convention (`forge-media-prod`/`forge-media-staging`, from `.env.production.example`/`.env.staging.example`). The Redis flush no longer force-sets `FORGE_FLUSH_CONFIRM=yes`; it now passes through `FORGE_WIPE_ALLOW_PRODUCTION` so `flush-redis.sh`'s own `isLocal` check is honored — a non-local Redis without explicit override now correctly aborts the whole wipe (`set -euo pipefail` propagates the failure).
- **Files:** `scripts/wipe-platform-data.sh`.
- **Cost impact:** None (script logic only).
- **User impact:** None directly — prevents an operator-facing incident (accidental prod data loss).
- **Reliability/security impact:** Closes the single largest blast-radius gap the master audit found. No behavior change for the correct/intended local-wipe path.
- **Scaling impact:** None.
- **Local validation:** Extracted the guard function in isolation (no live services touched) and ran 5 cases — local DB passes, prod DB (`neon.tech`) blocks without override and passes with `FORGE_WIPE_ALLOW_PRODUCTION=yes`, prod bucket name (`forge-media-prod`) blocks even with a local-looking DB URL, dev bucket name passes. `bash -n` syntax-checked both scripts.
- **Risks:** A genuinely non-local *but non-production* Redis (e.g. a shared remote dev instance) will now also require `FORGE_WIPE_ALLOW_PRODUCTION=yes` to flush — a deliberate fail-closed tradeoff, not a regression against documented usage (script's only documented target is local dev).
- **Rollback:** Revert the two edits in `scripts/wipe-platform-data.sh`; no data/migration risk, script-only.

### 2. Guard execution order — Throttler after RBAC checks (was: High, Backend §5.2#3)

- **Why:** `ThrottlerGuard` ran after `RolesGuard`/`ConsumerOnlyGuard`/`PermissionsGuard` in the global `APP_GUARD` chain, so a request that's about to be rate-limited still paid the cost of every RBAC check first. Under scripted/credential-stuffing abuse this wastes CPU on doomed requests — direct conflict with `forge-performance.md`'s mandate.
- **Evidence:** `apps/api/src/app.module.ts:301-306` (old order).
- **Fix:** Reordered to `JwtAuthGuard → ThrottlerGuard → RolesGuard → ConsumerOnlyGuard → PermissionsGuard → EmailVerifiedGuard`.
- **Files:** `apps/api/src/app.module.ts`.
- **Cost impact:** Marginal CPU savings under abuse traffic; not measurable at current low traffic.
- **User impact:** None for legitimate traffic — auth still runs first, so per-user throttling behavior is unchanged.
- **Reliability/security impact:** Reduces attack-surface cost of scripted abuse; no functional change to what gets throttled or how.
- **Scaling impact:** Matters more as traffic/abuse volume grows — a scale-readiness fix, not urgent today.
- **Local validation:** `apps/api` auth test suite (11 suites / 56 tests) and the throttler unit test both pass unchanged; `tsc --noEmit` clean. No full-`AppModule` e2e test exists in this repo (by design — e2e tests use slim modules per `forge-testing.md`), so guard order isn't exercised by CI beyond these unit tests.
- **Risks:** None identified — pure reorder of existing providers, no new guard logic.
- **Rollback:** Revert the provider array order in `app.module.ts`.

### 3. `ipHash` used a plain, unkeyed hash (was: Medium, Security §5.5#3)

- **Why:** `AuthService.hashToken()` (plain `SHA-256`) was reused for both refresh-token hashing (fine — 64 random bytes, high entropy) and IP-address hashing (not fine — IPv4 space is ~4 billion values, trivially brute-forced/rainbow-tabled if `ipHash` values were ever exposed, e.g. via a DB leak), defeating the purpose of hashing it at all.
- **Evidence:** `apps/api/src/modules/auth/auth.service.ts:502,544,567-569` (old).
- **Fix:** Added a dedicated `hashIp()` using `HMAC-SHA256` keyed with the existing `jwt.secret` (already a required, strong, server-only secret validated by `env-production.schema.ts` — no new env var needed). `hashToken()` is untouched and still used only for high-entropy tokens.
- **Files:** `apps/api/src/modules/auth/auth.service.ts`.
- **Cost impact:** None.
- **User impact:** None — `ipHash` is only used internally for new-device detection; format/length (`.slice(0,128)`) unchanged, so existing stored hashes just stop matching newly-computed ones after deploy (see risk below).
- **Reliability/security impact:** Closes a real defense-in-depth gap; IP hashes are no longer reversible via precomputation even if leaked.
- **Scaling impact:** None.
- **Local validation:** Full auth unit suite (56 tests) passes; `tsc --noEmit` clean.
- **Risks:** Existing `refresh_tokens.ipHash` rows computed with the old plain SHA-256 will no longer match new HMAC output — `recordNewDeviceIfNeeded`'s "known IP" set effectively resets once this deploys (every active session's next login looks like a "new device" until its session is re-issued). This is a soft/UX-only side effect (fires an analytics event, not a security control), not a functional break, and self-heals as sessions rotate. No migration needed.
- **Rollback:** Revert `hashIp()` and the two call sites back to `hashToken()`; no data migration either direction.

### 4. S3 bucket versioning missing (was: High, DevOps §5.6#2)

- **Why:** IAM already grants unscoped `DeleteObject` on the media bucket, and there was no versioning or noncurrent-version lifecycle rule — combined with finding #1 above, a leaked key, buggy delete path, or (pre-fix) the wipe-script gap had no recovery path for deleted creator videos.
- **Evidence:** `scripts/setup-aws-forge.sh` had no `put-bucket-versioning` call (confirmed via grep — zero matches for "versioning").
- **Fix:** Added `aws s3api put-bucket-versioning --versioning-configuration Status=Enabled`, plus a second lifecycle rule (`expire-noncurrent-versions`, 30 days) alongside the existing incomplete-multipart-upload rule, so versioning doesn't grow storage cost unbounded.
- **Files:** `scripts/setup-aws-forge.sh`.
- **Cost impact:** Small — noncurrent versions retained for 30 days before expiring; bounded by the lifecycle rule, not open-ended. Exact $ impact depends on actual overwrite/delete rate, unknown without AWS console access (same limitation noted in `COST_AUDIT_2026-07-26.md`).
- **User impact:** None directly.
- **Reliability/security impact:** Closes the "unrecoverable delete" gap identified in the master audit — a real safety net for the highest-value data (creator videos) that didn't exist before.
- **Scaling impact:** None; standard S3 feature, no operational overhead.
- **Local validation:** `bash -n` syntax check; extracted and validated the lifecycle JSON with `python3 -m json.tool` (parses correctly, both rules present). **Script-only change — like the prior multipart-lifecycle fix (PR #159), this has no effect until `setup-aws-forge.sh` is next run against the real bucket.** Cannot be validated against live AWS in this environment (no credentials, and per the testing rules this must not be exercised against production regardless).
- **Risks:** None to existing data (additive-only, doesn't touch existing objects' current versions). Needs an explicit run against the real bucket by someone with AWS credentials to take effect — flagging, not doing, since that touches live infra.
- **Rollback:** `aws s3api put-bucket-versioning --bucket <bucket> --versioning-configuration Status=Suspended` (versioning can be suspended, not fully removed, which is standard S3 behavior) or drop the step from the script before the next run.

### 5. Repo cleanup

- Removed `COST_AUDIT_by_chat_gpt.md` and `COST_AUDIT_PROMPT_by_claude.md` from repo root — both were byte-identical duplicates of `docs/audits/COST_AUDIT_PROMPT.md` (verified via `diff`, zero output). No content lost.

---

## Explicitly not fixed this session (flagged, needs a decision or bigger scope)

- **CSRF gate literal `nodeEnv === 'production'` check** (Medium, Security §5.5#5) — real finding, but editing it blind risks breaking staging/preview environments that may not set `NODE_ENV=production`; needs verification against actual deploy env config (`docs/operations/STAGING.md`) before touching, not a same-session fix.
- **Admin step-up re-auth for role-escalation/delete/impersonate** (Medium §5.5#4, delta MED-13) — real gap, but is new auth-flow feature work (a re-auth prompt + backend verification step), not a "smallest safe change."
- **God-object services, `EventsGateway` split, 65 `forwardRef`s, SEO (sitemap/robots/JSON-LD), analytics event firing, mobile deep links/cert-pinning wiring, bluegreen deploy strategy, search sidecar, load testing** — all real, all already tracked in `docs/audits/DEFERRED_BACKLOG.md` or the master audit itself; each is multi-day architecture/product work requiring explicit go-ahead per `forge-production-stability.md`'s pre-deployment gate and `forge-git-branching.md`'s "only merge for major/batched work" rule. Not attempted here to avoid unrequested scope creep on what should be a batched, reviewed release unit.

---

## Local test environment

`docker-compose.yml` at repo root already provisions Postgres, Redis, pgbouncer, API, worker, web, and admin — adequate for local validation per the testing rules; no changes needed to the compose setup itself for this pass. All validation above used `apps/api`'s existing Jest unit suite (no `DATABASE_URL`/`REDIS_URL` required, matching `forge-testing.md`) rather than spinning up the full compose stack, since none of the fixes touch a live-service code path that unit mocks can't cover.

---

## Deployment recommendation

Per `forge-git-branching.md`: this is a batched, reviewed set of security/safety fixes (5 files) — appropriate to land as one feature branch → one PR → one merge when the user is ready, not as separate pushes. Not committed or pushed in this session (commits happen only when explicitly requested). No migration, no new dependency, no infra provisioning — all changes are code/script-level and reversible per the rollback notes above.
