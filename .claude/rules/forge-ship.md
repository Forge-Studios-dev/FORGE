# FORGE — Ship

> Scope: **Always apply**. Mirrors `.cursor/rules/forge-ship.mdc`.

`main` is the production gate. Every merge can run CI and release (Fly API + Vercel web/admin), restarting servers and costing deploys.

## Git

- Never push or commit directly to `main`. Work on a feature branch from latest `main`.
- Push / open PR / merge only for complete, meaningful work — or when the user explicitly asks to ship.
- Prefer one consolidated merge over many small “fix forward” deploys. Batch on the branch first.
- Do not run `fly deploy`, release workflows, or live production smoke while still iterating, unless the user explicitly requests an emergency hotfix.

## When the user asks to merge or release

Before merging to `main`, ensure:

1. Change is complete and scoped; blast radius understood.
2. Critical paths covered by targeted tests (see `forge-testing.md`).
3. Auth/data/migration risk reviewed when applicable; rollback path exists for risky changes.
4. No secrets or unverified migrations sneaking into the deploy.
5. Prefer unit + slim HTTP tests over full-stack; run `npm run ci:local` (or equivalent) once when the release unit is ready — not after every WIP edit.

If production misbehaves after release: prioritize rollback and restore service over fixing forward in prod.

## Validation intensity

- **Minor** (UI/copy/docs/small refactor): local or targeted module tests only.
- **Major** (API contract, auth, schema, infra, critical prod bugs): fuller validation once before merge — not repeatedly mid-branch.

Do not treat every coding turn as a production deploy. Ship gates apply at ship time.
