# FORGE — Production Stability

> Scope: **Always apply** (every change). Mirrors `.cursor/rules/forge-production-stability.mdc`.

Production availability and system reliability **always take priority over deployment speed**. Every change — feature, optimization, refactor, migration, or bug fix — must reach production-grade quality before it ships. The objective is maximum platform stability: prevent service disruptions, avoid downtime, eliminate regressions, and protect a seamless user experience.

This rule complements `forge-core.md`, `forge-git-branching.md`, `forge-deployment-testing.md`, and `forge-testing.md`.

## Core Principle

- No code is deployed to production unless it meets production-grade quality standards.
- When in doubt between shipping faster and protecting reliability, **choose reliability**.
- Treat every production deploy as a mission-critical event for real users.

## Mandatory Pre-Deployment Gate

Before any change reaches production, it must complete **all** of the following. Do not deploy if any item is unmet:

1. **Complete review** — code reviewed for correctness, clarity, and adherence to project conventions and architecture.
2. **Testing** — unit + integration tests for affected and critical paths; never ship untested critical paths (see `forge-testing.md`).
3. **Validation** — functional validation that the change behaves as intended and existing behavior is preserved.
4. **Impact analysis** — identify affected modules, APIs, data, infra, and downstream consumers; assess side effects and blast radius before shipping.
5. **Performance validation** — confirm no regressions in query efficiency, response times, memory/CPU, or scalability (see `forge-performance.md`).
6. **Security checks** — review auth/authorization, input validation, injection/XSS/CSRF/SSRF/RCE, secrets handling, and sensitive-data exposure.
7. **Dependency verification** — verify package/library changes for compatibility, version conflicts, and supply-chain risk.
8. **Monitoring & observability** — ensure logging, metrics, error tracking, and health checks cover the change so issues are detectable in production.
9. **Rollback strategy** — a clear, tested path to revert (code rollback and/or reversible migration) must exist before deploy.

## Database & Migration Safety

- Migrations must be reviewed, reversible where possible, and verified against existing production data.
- Confirm a rollback/recovery plan and prevent data loss before applying schema changes.
- Never push unreviewed or un-applied local migrations to production accidentally — verify what a deploy will actually run.

## During & After Deployment

- Run the minimal test set that covers affected components and critical paths before merge (see `forge-deployment-testing.md`).
- After release, actively monitor health, errors, performance, and key metrics until the change is confirmed stable.
- If instability appears, prioritize **rollback and restoration of service** over fixing forward in production.

## Never Do This

- Deploy to production to "test in prod" or to move faster at the expense of reliability.
- Ship changes without tests, monitoring, or a rollback path for critical paths.
- Push unreviewed code, unverified dependencies, or un-vetted migrations to production.
- Skip impact analysis on changes that touch shared modules, APIs, data, or infrastructure.

## Final Principle

The platform must remain fully operational and reliable at all times. Stability, correctness, and recoverability are mandatory — speed is secondary.
