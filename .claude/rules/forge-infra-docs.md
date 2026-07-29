# FORGE — Infra & Docs

> Scope: **Apply when touching** `docs/**`, `scripts/**`, `.github/**`, `docker-compose*.yml`, `Dockerfile*`. Mirrors `.cursor/rules/forge-infra-docs.mdc`.

## Ops

- Prefer zero-downtime deploys and an explicit rollback for infra changes.
- Prefer queues/CDN/object storage/workers over blindly scaling API replicas.
- Keep CI fast; never commit secrets or log them.

## Observability

- Structured logs; correlate API ↔ worker ↔ socket when touching those paths.
- Extend existing health checks (`health.controller.ts` pattern) for DB/Redis/critical deps.
- Use observability tools already wired in the repo; do not add new APM stacks casually.

## Docs (`docs/`)

- Major features: update `FORGE_PROJECT_MASTER.md` or a focused doc (architecture, env, rollback).
- Align deploy notes with `GETTING_STARTED.md` / `DEPLOY.md`. Never document real credentials.
- Note breaking API changes and migration steps.

## Scripts

- Destructive scripts need warnings + env guards; idempotent where possible; exit non-zero on failure.
- Environment isolation; only `.env*.example` in git; least privilege on S3/Redis/AWS changes.
