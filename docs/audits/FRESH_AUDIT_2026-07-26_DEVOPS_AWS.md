# FORGE — Fresh DevOps & AWS Cloud Architecture Audit

**Date:** 2026-07-26
**Auditor role:** Senior DevOps Engineer + Senior AWS Cloud Architect (independent production-readiness review)
**Scope:** `.github/workflows/`, `infra/`, `scripts/`, `docker-compose*.yml`, `Dockerfile*`, `fly.toml` / `fly.worker.toml`, `docs/DEPLOY.md`, `docs/CI_CD.md`, `docs/OBSERVABILITY.md`, `docs/operations/*`

## Method

This is a **from-scratch, independently-verified** audit. `docs/audits/` already contains a cost audit and prior security/master audits (most recently `FORGE_MASTER_AUDIT_2026-07-22.md`, `COST_AUDIT_2026-07-26.md`) — those were used only as a pointer to areas worth re-checking, never trusted as still-accurate. Every finding below was verified directly against current repository state and, where possible, live GitHub configuration:

- Read all 7 workflow YAMLs in full (`ci.yml`, `release.yml`, `deploy-fly.yml`, `deploy-vercel.yml`, `deploy-staging.yml`, `deploy-auth-secrets.yml`, `codeql.yml`).
- Read `fly.toml`, `fly.worker.toml`, all 4 Dockerfiles, both `docker-compose*.yml`, `infra/nginx/nginx.conf`, `infra/observability/terraform/main.tf`.
- Queried live GitHub repo config via `gh api`: branch protection, rulesets, Actions permissions/allowed-actions/SHA-pinning policy, admin access confirmed for this check.
- Spot-checked 15 scripts in `scripts/` (destructive ops, secret handling, error-handling discipline: `set -euo pipefail` presence checked across all 64 scripts, not just the sample).
- `git grep`'d the full tracked tree for AWS keys, private-key headers, Slack/Stripe live-key patterns, and generic `secret/token/password = "<long literal>"` patterns — none found outside `.example` placeholder files.
- Attempted live AWS verification (`aws sts get-caller-identity`) — **no credentials available in this environment**, so S3/IAM findings below are verified against `scripts/setup-aws-forge.sh` / `scripts/fix-s3-cors.sh` (the IaC-as-script source of truth) and `docs/operations/DISASTER_RECOVERY.md`, not against the live bucket/account. This is called out explicitly wherever it matters.
- Read `docs/DEPLOY.md`, `docs/CI_CD.md`, `docs/OBSERVABILITY.md`, `docs/operations/DISASTER_RECOVERY.md`, `docs/operations/MIGRATION_ROLLBACK.md`.

---

## Findings — Critical

### C-1. `main` has zero branch protection / rulesets despite being the sole production-deploy gate

- **Category:** Git branching / CI-CD governance
- **File(s):** GitHub repo config (`Forge-Studios-dev/FORGE`), `.github/workflows/release.yml`, `docs/CI_CD.md:141-148`, `.claude/rules/forge-git-branching.md`
- **Severity:** Critical
- **Current implementation:** `gh api repos/Forge-Studios-dev/FORGE/branches/main/protection` returns `404 Branch not protected`. `gh api .../rulesets` returns `[]`. The authenticated token has `admin: true` on the repo, so this is not a permissions artifact — there is genuinely no required-status-check rule, no required-PR-review rule, and no force-push/deletion restriction on `main`. `docs/CI_CD.md` itself lists this under a section literally titled **"Branch protection (recommended)"** — i.e., it was written down as a TODO and never applied.
- **Problem:** `release.yml` auto-deploys production (Fly API + worker + Vercel web/admin) on `workflow_run` completion of CI on `main`. The entire "push feature branch → PR → merge once → CI → Release" model that `CLAUDE.md`/`forge-git-branching.md` describe as the production safety gate is a **social convention only** — nothing in GitHub actually prevents a direct `git push origin main`, a force-push that rewrites history, or a merge without review. A single compromised contributor credential, misconfigured local `git` alias, or well-intentioned "quick fix" bypasses PR review entirely and can still reach production the moment CI happens to pass.
- **Why it matters:** This is the single most consequential gap in the whole audit — every other CI/CD control (required checks, security-audit gate, e2e smoke) is downstream of "a human went through a PR," and that assumption is currently unenforced. It directly contradicts the project's own stated core rule ("never push directly to `main`") with no technical backstop.
- **Recommended solution:** Add a branch protection rule (or ruleset) on `main`: require PR before merge, require the `ci-ok` status check (and CodeQL) to pass, dismiss stale approvals on new commits, restrict force-pushes and branch deletion. Optionally require 1 review via a `CODEOWNERS` file for `infra/`, `.github/workflows/`, `scripts/wipe-platform-data.sh`, `apps/api/src/database/migrations/`.
- **Best-practice reference:** GitHub branch protection / rulesets docs; 12-factor "Config" + "Build, release, run" separation implies a gated release step; SOC2/production-stability norms.
- **Estimated effort:** 15 minutes (GitHub UI or `gh api ... PUT branches/main/protection`).
- **Expected impact:** Closes the actual production-deploy gate to match documented intent; prevents accidental or malicious direct pushes from auto-releasing.

---

## Findings — High

### H-1. GitHub Actions supply-chain: unpinned/mutable action refs, org allows any action, SHA pinning not required

- **Category:** CI/CD security
- **File(s):** all `.github/workflows/*.yml` (e.g. `release.yml:46,145`, `deploy-fly.yml:32`, `deploy-vercel.yml` uses `npx vercel@54.2.0` — pinned, good); repo-level Actions settings
- **Severity:** High
- **Current implementation:** `gh api repos/.../actions/permissions` → `allowed_actions: "all"`, and `gh api repos/.../actions/permissions/workflow` confirms `sha_pinning_required` is not enforced. Every workflow references third-party actions by mutable tag or, worse, by branch: `superfly/flyctl-actions/setup-flyctl@master` (literally the `master` branch, not even a version tag) appears in `release.yml`, `deploy-fly.yml`, `deploy-staging.yml`, `deploy-auth-secrets.yml`. `actions/checkout@v7`, `actions/setup-node@v7`, `github/codeql-action/*@v4` are tag-pinned but not SHA-pinned.
- **Problem:** These workflows hold `FLY_API_TOKEN`, `VERCEL_TOKEN`, and (transitively via secret-sync scripts) AWS/Stripe/Sentry credentials. `@master` is the worst case: the maintainer of `superfly/flyctl-actions` can push anything to `master` and it runs in this repo's privileged deploy jobs on the next run, with zero review on FORGE's side. Tag-pinned actions (`@v7`, `@v4`) are safer but tags are still mutable by the upstream maintainer (can be moved/re-pushed) — SHA pinning is the only tamper-evident option. This is the exact class of attack behind real-world Actions supply-chain incidents (e.g. compromised third-party actions exfiltrating repo secrets).
- **Why it matters:** A single compromised upstream action here can exfiltrate `FLY_API_TOKEN`/`VERCEL_TOKEN`/AWS keys or push a malicious deploy directly to production — worse than most application-level vulnerabilities because it has direct production write access.
- **Recommended solution:** Pin `superfly/flyctl-actions/setup-flyctl` to a released tag (not `@master`), then SHA-pin all third-party actions (Dependabot can auto-update SHA-pinned actions safely). Enable "Require actions to be pinned to a full-length commit SHA" at the org/repo level if available on the current GitHub plan.
- **Best-practice reference:** GitHub "Security hardening for GitHub Actions"; OpenSSF Scorecard "Pinned-Dependencies" check.
- **Estimated effort:** 1-2 hours (find current SHAs, update all workflow files, verify deploys still pass).
- **Expected impact:** Removes a live supply-chain attack surface on the production deploy path.

### H-2. Long-lived static AWS IAM access keys, no rotation automation, despite OIDC pattern already proven elsewhere in the repo

- **Category:** AWS / secrets management
- **File(s):** `scripts/setup-aws-forge.sh:166-170`, `scripts/fly-gcp-oidc-token.sh`
- **Severity:** High
- **Current implementation:** `setup-aws-forge.sh` creates a long-lived IAM access key (`aws iam create-access-key`) for `forge-api-media`, writes it to Fly secrets (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`), and there is no script or CI job anywhere in `scripts/` that rotates it. The script does correctly self-delete its local plaintext output file (a genuinely good control, evidently added from a prior audit — see `CRIT-03` comment in the script). Notably, the repo *already* has a working OIDC federation pattern for GCP (`scripts/fly-gcp-oidc-token.sh` — Fly Machines OIDC → GCP Workload Identity Federation, no static creds) that was never extended to AWS, even though AWS IAM Roles Anywhere / Fly-to-AWS OIDC (via a custom STS AssumeRoleWithWebIdentity flow using the same Fly OIDC token) is achievable with the identical pattern.
- **Problem:** A leaked/stale static AWS key has an unbounded blast-radius window (whatever `ForgeMediaS3Policy` grants — `PutObject/GetObject/DeleteObject/HeadObject/ListBucket` scoped to the media bucket) until someone notices and manually rotates it in the IAM console.
- **Why it matters:** Static long-lived cloud credentials are consistently the top root cause in cloud breach postmortems; the repo already proved it knows how to avoid this for GCP.
- **Recommended solution:** Either (a) add a documented/scripted quarterly rotation runbook (`aws iam create-access-key` + Fly secret update + `aws iam delete-access-key` on the old one, similar cadence to the DR drill already run quarterly), or (b) migrate to short-lived credentials via STS AssumeRoleWithWebIdentity using the existing Fly OIDC token, mirroring `fly-gcp-oidc-token.sh`.
- **Best-practice reference:** AWS Well-Architected Security Pillar (SEC02 — least-privilege, temporary credentials over long-term ones); AWS IAM credential rotation guidance.
- **Estimated effort:** Rotation runbook: 1 hour. Full OIDC migration: 1-2 days.
- **Expected impact:** Bounds credential-leak blast radius; removes a manual, easy-to-forget operational step.

### H-3. `docker-compose.prod.yml` + `infra/nginx/*` describe a self-hosted topology that does not match — and cannot run as — actual production

- **Category:** Infra / config drift, documentation accuracy
- **File(s):** `docker-compose.prod.yml`, `infra/nginx/nginx.conf`
- **Severity:** High (drops to Medium in practice since the file appears unused, but flagged High because it directly contradicts the platform's real architecture and was already identified as broken on 2026-07-22 and is **still unfixed** today)
- **Current implementation:** `docker-compose.prod.yml` runs its own `postgres`/`redis`/`nginx` containers and mounts `./infra/nginx/ssl:/etc/nginx/ssl:ro`. That `ssl/` directory does not exist anywhere in the repo (confirmed: only `infra/nginx/nginx.conf` exists on disk, no `ssl/` subfolder — it's `.gitignore`'d and never generated). Actual production, per `docs/DEPLOY.md`, is Fly.io (API/worker) + Vercel (web/admin) + **Neon** Postgres + **Redis Cloud** — none of which are self-hosted Postgres/Redis/nginx containers.
- **Problem:** This compose file cannot actually start in its documented role ("prod") — it fails immediately on the missing SSL mount, and even if patched, it describes an entirely different (and unused) deployment architecture. `docker-compose.prod.yml`'s `deploy.replicas`/resource `limits` blocks are also silently no-ops under plain `docker compose up` (only honored under Swarm) — acknowledged in an inline comment but still misleading to a reader who doesn't catch it.
- **Why it matters:** Dead IaC that impersonates a real deployment path is worse than no IaC — if anyone ever reaches for it as a DR fallback ("just run the prod compose file") during an actual Fly/Vercel outage, it fails immediately and burns incident time. It also actively confuses new engineers about what production actually is.
- **Recommended solution:** Either delete `docker-compose.prod.yml` and `infra/nginx/` (keep as reference in `docs/` if there's a future self-hosting reason to retain the pattern), or clearly relabel the file as "reference-only, not used for actual FORGE production" at the top and fix/remove the broken SSL mount.
- **Best-practice reference:** 12-factor "Dev/prod parity" — the artifact that claims to be "prod" should not diverge from what prod actually is.
- **Estimated effort:** 30 minutes (delete or relabel).
- **Expected impact:** Removes a stale, broken "DR fallback" trap; reduces onboarding confusion.

---

## Findings — Medium

### M-1. No `CODEOWNERS` file

- **Category:** Git governance
- **File(s):** repo root / `.github/`
- **Severity:** Medium
- **Current implementation:** No `CODEOWNERS` file anywhere in the repo.
- **Problem:** Even once branch protection (C-1) is enabled, there's no way to require review from a specific owner for sensitive paths (`infra/`, `.github/workflows/`, `scripts/wipe-platform-data.sh`, `scripts/flush-redis.sh`, `apps/api/src/database/migrations/`).
- **Why it matters:** Least-privilege review — a single reviewer approving an infra/workflow change today can be anyone with write access.
- **Recommended solution:** Add `.github/CODEOWNERS` scoping infra/CI/destructive-script paths to specific maintainers; combine with C-1's required-review rule.
- **Best-practice reference:** GitHub CODEOWNERS docs.
- **Estimated effort:** 20 minutes.
- **Expected impact:** Enforces review by the right people on the highest-blast-radius paths.

### M-2. `apps/api/Dockerfile.worker` has no `HEALTHCHECK`

- **Category:** Docker
- **File(s):** `apps/api/Dockerfile.worker` (contrast `apps/api/Dockerfile:51-52`, which has one)
- **Severity:** Medium
- **Current implementation:** The API Dockerfile has a `HEALTHCHECK` hitting `/api/v1/health/live`; the worker Dockerfile has none. Production health is instead covered by `fly.worker.toml`'s `[checks.worker_health]` block, and this is explicitly a deliberate, documented design (`MED-08` comment referencing the internal `/health` listener added to `bootstrapWorker`).
- **Problem:** The Fly-level check covers production, but plain `docker run`/`docker-compose` (local dev, and any future non-Fly deployment target) has no container-level liveness signal for the worker — `docker ps` won't show `(unhealthy)` if the worker process hangs locally.
- **Why it matters:** Local dev debugging (stuck worker, e.g. after touching BullMQ processors) is harder without a container-level signal; also an inconsistency for anyone auditing Docker configuration parity between API and worker.
- **Recommended solution:** Add a `HEALTHCHECK` to `Dockerfile.worker` hitting the same `/health` endpoint Fly already checks (`curl -f http://localhost:3001/health || exit 1`).
- **Best-practice reference:** Docker `HEALTHCHECK` best practices.
- **Estimated effort:** 10 minutes.
- **Expected impact:** Local/dev container observability parity with the API image.

### M-3. No `.dockerignore` anywhere in the repo

- **Category:** Docker build performance
- **File(s):** repo root, `apps/api/`, `apps/web/`, `apps/admin/`
- **Severity:** Medium
- **Current implementation:** No `.dockerignore` file at the root or in any app directory. All four Dockerfiles mitigate most of the risk by using explicit, scoped `COPY` lists (e.g. `COPY apps/api/ ./apps/api/` rather than `COPY . .`), so secrets/`.env` files aren't accidentally baked into images via a broad copy.
- **Problem:** Every `docker build` still sends the **entire build context** (whole monorepo — `.git`, `docs/`, all `apps/*` regardless of which one is building, `node_modules` if present locally) to the Docker daemon before the `COPY` filtering even applies, since context transfer happens ahead of Dockerfile evaluation. This slows local and CI builds and bloats the build cache unnecessarily, especially for the `apps/web`/`apps/admin` images which don't need `apps/api` or `apps/mobile` in context at all.
- **Why it matters:** Direct build-time cost/latency; also removes a defense-in-depth layer (a future careless `COPY . .` change would have nothing stopping it from leaking `.env`/`.git` into an image layer).
- **Recommended solution:** Add root `.dockerignore` (exclude `.git`, `node_modules`, `**/*.env*` except `*.example`, `docs/`, `apps/mobile/`, coverage/build artifacts) plus per-app ones as needed for BuildKit context-narrowing.
- **Best-practice reference:** Docker build context best practices.
- **Estimated effort:** 30 minutes.
- **Expected impact:** Faster builds (lower CI minutes/cost), defense-in-depth against future accidental broad `COPY`.

### M-4. CI's critical-severity `npm audit` gate silently no-ops on registry outages, with no tracked flakiness signal

- **Category:** CI/CD security
- **File(s):** `.github/workflows/ci.yml:52-102`
- **Severity:** Medium
- **Current implementation:** The `security-audit` job distinguishes "npm registry audit API is down" (shape check on `.metadata`) from "a real critical vuln was found," and only blocks on the latter — a deliberate, well-reasoned, well-commented design to avoid blocking unrelated PRs on npm's flaky audit endpoint. High-severity findings are explicitly accepted-risk and non-blocking (documented: multer, nodemailer, next — pending major-version bump PRs).
- **Problem:** The fallback path is a silent `::warning::` + `exit 0` — if npm's registry endpoint were down (or a network/proxy issue made it "down") for an extended period, or always erroring in this environment, **critical vulnerabilities would never block a single merge** during that window, and the only visible signal is a workflow annotation that nobody is proactively watching. There's no accumulating counter/alert for "audit gate has been in fallback mode for N consecutive runs."
- **Why it matters:** A gate that can silently degrade to a no-op is worse than an explicit manual step, because it looks green in the PR UI either way.
- **Recommended solution:** Track consecutive fallback occurrences (e.g. write to a small state file / GitHub issue comment / Slack ping) and escalate if the gate has been bypassed N times in a row; consider a secondary offline vulnerability scanner (e.g. `osv-scanner` against `package-lock.json`) as a redundant check that doesn't depend on npm's registry audit API at all.
- **Best-practice reference:** Defense-in-depth for supply-chain scanning; "silent degrade" anti-pattern in CI gate design.
- **Estimated effort:** 2-4 hours for a redundant offline scanner; 1 hour for a simple escalation counter.
- **Expected impact:** Removes a blind spot where the security gate can be down without anyone noticing.

### M-5. Fly worker deploy uses `--ha=false` (single machine, no high availability) with no documented compensating control beyond restart policy

- **Category:** Deployment / availability
- **File(s):** `.github/workflows/release.yml:153`, `fly.worker.toml`
- **Severity:** Medium
- **Current implementation:** Worker deploys with `flyctl deploy -c fly.worker.toml -a forge-studios-worker --remote-only --ha=false`. `fly.worker.toml` sets `[[restart]] policy = 'always', max_retries = 10` and a functional health check, but there is exactly one worker machine.
- **Problem:** BullMQ job processing (video transcoding, analytics ingest, notifications) has a single point of failure — a Fly host issue or a stuck machine (beyond the 10-retry budget) stalls all queues until manually intervened, even though the release workflow does have automated "force-start" recovery logic for the common crash-loop case.
- **Why it matters:** Queue backlog directly affects creator-facing features (upload processing, notifications) — `forge-performance.md`/`forge-production-stability.md` both call for scalability and no single points of failure on platform-critical paths.
- **Recommended solution:** Either run 2 worker machines (accepting BullMQ's at-least-once idempotent job design, which the backend rules already require) or explicitly document why single-worker is an accepted tradeoff for current scale/cost and what the manual recovery runbook is if the retry-exhaustion recovery in `release.yml` doesn't apply mid-operation (not just at deploy time).
- **Best-practice reference:** AWS Well-Architected Reliability Pillar (REL — avoid single points of failure); 12-factor "Concurrency."
- **Estimated effort:** Low if just scaling machine count (`fly scale count 2 -a forge-studios-worker`); needs BullMQ idempotency re-verification.
- **Expected impact:** Removes a queue-processing SPOF.

### M-6. Terraform state has no configured remote backend

- **Category:** Infra-as-code / Terraform
- **File(s):** `infra/observability/terraform/main.tf`, `infra/observability/terraform/.gitignore`
- **Severity:** Medium (low blast radius today — this Terraform only manages one Grafana Cloud scrape-job resource — but a bad pattern to leave unaddressed before this module grows)
- **Current implementation:** `terraform { required_version, required_providers }` block has no `backend` configuration; state defaults to local `terraform.tfstate`, correctly `.gitignore`'d so it isn't committed, but that also means it isn't shared — whoever's laptop last ran `apply` holds the only copy, with no locking against concurrent applies.
- **Problem:** No team-shared state, no state locking, no state backup — a lost laptop or `rm -rf` loses the only record of what Terraform manages, forcing manual reconciliation or resource re-import.
- **Why it matters:** Small today, but this is exactly the kind of gap that's cheap to fix now and expensive once the Terraform footprint grows to cover more infra.
- **Recommended solution:** Add a remote backend (S3 + DynamoDB lock table, or Terraform Cloud free tier) before adding more resources to this module.
- **Best-practice reference:** Terraform remote state best practices; AWS Well-Architected Operational Excellence.
- **Estimated effort:** 1-2 hours.
- **Expected impact:** Removes single-laptop dependency for the one piece of Terraform-managed infra.

### M-7. `fly.toml`'s declared `primary_region` diverges silently from the routine production deploy path

- **Category:** Deployment configuration consistency
- **File(s):** `fly.toml:2` (`primary_region = 'bom'`), `.github/workflows/release.yml:90` (`--primary-region sin --regions bom`), `.github/workflows/deploy-fly.yml:35` (`flyctl deploy --remote-only`, **no region override**)
- **Severity:** Medium
- **Current implementation:** `docs/DEPLOY.md:87` and `docs/CI_CD.md:27` both explicitly document that the routine `release.yml` path overrides `fly.toml`'s primary region (`sin` instead of `bom`) — so this is a *known*, documented divergence, not an accidental bug.
- **Problem:** The "emergency" `deploy-fly.yml` workflow (manual `workflow_dispatch`, meant for fast single-target redeploys) does **not** apply the same `--primary-region sin --regions bom` override — it runs a bare `flyctl deploy --remote-only`, which will deploy using `fly.toml`'s literal `primary_region = 'bom'`. An operator reaching for the "emergency" workflow during an incident (precisely when `bom` capacity issues are most likely, per the inline comment on `release_command_vm` explaining *why* `sin` was chosen) would get a different, non-tested region topology than the one production normally runs.
- **Why it matters:** Emergency paths are exercised least often and need to be *most* predictable, not divergent from the primary path — this is the opposite.
- **Recommended solution:** Either add the same `--primary-region sin --regions bom` flags to `deploy-fly.yml`, or update `fly.toml`'s `primary_region` to `sin` directly so both paths agree by default without needing a flag override anywhere.
- **Best-practice reference:** Runbook/automation parity between "normal" and "break-glass" deploy paths.
- **Estimated effort:** 15 minutes.
- **Expected impact:** Emergency deploys behave identically to routine ones.

---

## Findings — Low

### L-1. One script (`fly-gcp-oidc-token.sh`) lacks the `set -euo pipefail` discipline used everywhere else

- **Category:** Scripts / error handling
- **File(s):** `scripts/fly-gcp-oidc-token.sh`
- **Severity:** Low
- **Current implementation:** 63 of 64 scripts in `scripts/` start with `set -euo pipefail` (verified via full-directory grep, not sampling). `fly-gcp-oidc-token.sh` is `#!/bin/sh` (not bash) and has no equivalent `set -eu` — small (13-line) script, but it silently swallows a failed `curl` if the pipe/exit-code isn't checked by its caller.
- **Problem:** Minor inconsistency; low risk given the script's tiny surface (single `curl` call), but breaks the otherwise excellent, consistent discipline across `scripts/`.
- **Recommended solution:** Add `set -eu` (POSIX `sh` doesn't support `pipefail`) at the top.
- **Estimated effort:** 5 minutes.
- **Expected impact:** Consistency; marginal reliability improvement.

### L-2. `docker-compose.yml` (local dev) hardcodes a plaintext local DB password

- **Category:** Docker / local dev hygiene
- **File(s):** `docker-compose.yml:9` (`POSTGRES_PASSWORD: forge_local_password`)
- **Severity:** Low
- **Current implementation:** Hardcoded, not env-var driven, unlike `docker-compose.prod.yml` which correctly uses `${DB_PASSWORD}`.
- **Problem:** Purely local-only (bound to `localhost:5432` in dev), so not a real security exposure — flagged only as a hygiene/consistency note against the prod compose file's better pattern.
- **Recommended solution:** No action required unless standardizing all compose files to env-var-driven credentials for consistency.
- **Estimated effort:** N/A.
- **Expected impact:** Cosmetic consistency only.

---

## What's already good (verified, not assumed)

To keep this audit honest and not just a punch-list, the following were independently verified as solid, production-grade practices already in place:

- **CI pipeline** (`ci.yml`): path-filtered job skipping (`dorny/paths-filter`), concurrency groups with cancel-in-progress, a single aggregating `ci-ok` gate that correctly treats `skipped` as pass but `failure` as hard-fail, coverage artifact upload, Playwright e2e smoke for both web and admin.
- **Release pipeline** (`release.yml`): pre-deploy **required-secret audit that fails closed** (refuses to deploy if `DATABASE_URL`/`JWT_SECRET`/etc. are missing on Fly, preventing a crash-loop deploy), post-deploy health + public-route smoke + Prometheus scrape verification, **automatic rollback to the previous Fly image on failure** for both API and worker, and worker-specific handling for Fly's exhausted-retry machine-stop state. This is materially more mature than most mid-size teams' deploy pipelines.
- **Dockerfiles**: proper multi-stage builds, non-root users (`nestjs`/`nextjs`, explicit UID/GID), pinned `node:20-alpine` base, Next.js standalone output for small runtime images, API image has a `HEALTHCHECK`.
- **S3/IAM (via `scripts/setup-aws-forge.sh`)**: public access fully blocked, versioning enabled, lifecycle rules for incomplete multipart uploads (7d) and noncurrent version expiry (30d) — both added per the inline `CRIT-03` comment referencing a prior audit finding — CloudFront via **Origin Access Control** (modern OAC, not legacy OAI) with a bucket policy scoped by `AWS:SourceArn` condition, and IAM policy resource-scoped to the specific bucket ARN only (not `*`). The script also auto-deletes its own plaintext credential output file after confirming the operator copied it.
- **Destructive scripts**: `wipe-platform-data.sh` and `flush-redis.sh` both hard-require an explicit `FORGE_WIPE_CONFIRM=yes` / `FORGE_FLUSH_CONFIRM=yes` env var for any non-local target, with TLS certificate verification on by default for Redis.
- **Disaster recovery**: `docs/operations/DISASTER_RECOVERY.md` documents a **quarterly restore drill that was actually executed** (2026-07-22 entry: real Neon PITR branch created via API, row counts verified against production, branch deleted after) — genuinely uncommon rigor; most teams document DR "plans" without ever drilling them.
- **Observability**: Prometheus `/metrics` fails closed (401) in production without a bearer token, Sentry PII sending defaults to off, OTel is opt-in via env var, BullMQ queue-depth alerting is wired into Grafana, and default GitHub Actions workflow permissions are already correctly scoped to `read` at the org level.
- **Secrets hygiene**: no committed secrets, keys, or credentials found anywhere in the tracked tree; `.gitignore` correctly excludes all real `.env*` variants while allow-listing only `*.example` files.

---

## Scores

**DevOps score: 6/10** — The CI/CD pipeline mechanics (release automation, rollback, secret-audit gating, DR drills) are genuinely above-average and better-tested than most teams'. The score is pulled down primarily by C-1: the one control everything else assumes (a protected `main` requiring PR + passing CI before merge) does not actually exist in GitHub, despite being written into the project's own core rules and documented as a "recommended" TODO that was never completed. Combined with H-1 (unpinned/`@master`-pinned Actions holding production deploy credentials) and H-3 (stale, broken "prod" IaC left in the repo since at least the July 22 audit), this is a pipeline that *behaves* mature in the happy path but has an open door on the governance side.

**AWS/Cloud score: 7/10** — Where AWS is actually used (S3 media bucket + CloudFront), the configuration-as-script is genuinely well-architected: least-privilege bucket-scoped IAM, full public-access block, versioning + lifecycle rules, modern CloudFront OAC. The score isn't higher because (a) this could only be verified against the setup **script**, not the live account (no credentials available in this environment — flag this as a follow-up: run `aws s3api get-bucket-versioning`/`get-public-access-block`/`get-bucket-lifecycle-configuration` against the real `forge-media-prod` bucket to confirm the script's last-applied state matches what's live), and (b) H-2's static, unrotated IAM credentials are a real, currently-open gap with no compensating automation.

---

*Independently produced 2026-07-26. Supersedes nothing in `docs/audits/` — treat as an additional, current-state cross-check. Where this audit's findings overlap with older audits (e.g. the stale `docker-compose.prod.yml`/nginx reference, first noted 2026-07-22), that overlap is called out explicitly above because it means the finding is still open, not because it was rediscovered.*
