# FORGE — Git Branching & Production Deploy Guard

> Scope: **Always apply** (every change). Mirrors `.cursor/rules/forge-git-branching.mdc`.

`main` is protected by CI/CD. **Every merge to `main` runs CI and can trigger production release** (Fly API + Vercel web/admin), causing server restarts and deploy cost.

## When to push, PR, and merge (production gate)

**Only push the branch, open a PR, and merge to `main` for bigger or major changes** — work that is ready to ship and worth a full CI/CD + production deploy cycle.

Examples of **merge-worthy** work:
- New features or substantial enhancements
- Significant bug fixes, refactors, or security/performance work
- Batched related changes that form a coherent, tested release unit
- User explicitly asks to ship, merge, release, or deploy

**Do not** push/PR/merge for:
- Small tweaks, WIP, or mid-iteration fixes
- Single-line or cosmetic changes unless the user explicitly wants them in production now
- “Fix forward” after a partial merge — finish and batch on the branch first

Keep incremental work **local or on a feature branch** until it adds up to a meaningful release. Prefer **one consolidated merge** over many small production deploys.

## Never do this

- `git push origin main` (or any direct commit/push to `main`)
- `fly deploy`, `gh workflow run release.yml`, or production smoke against live infra **while still iterating** on the same change
- Multiple small pushes/merges to `main` to “fix forward” — batch fixes on a branch first
- Opening a PR or suggesting merge before the change set is complete and worth a deploy

## Required workflow

1. **Branch first** — create a descriptive branch from latest `main`:
   ```bash
   git fetch origin main
   git checkout -b fix/short-description origin/main
   ```
2. **Commit on the branch** — only when the user asks to commit.
3. **Push the branch** — when work is substantial enough to share or back up remotely; not required for every tiny local edit:
   ```bash
   git push -u origin HEAD
   ```
4. **Verify on the branch** — run tests/CI locally (`npm run ci:local` or targeted tests) before merge.
5. **Merge to `main` only for major/batched work** — when the change is complete, meaningful, and the user explicitly says merge/ship/release **and** checks pass:
   - Prefer **one PR** → merge (squash or merge commit per repo convention)
   - Use `gh pr create` when the user asks for a PR
   - **One merge to `main`** = one production deploy cycle (not many)

## Deploy / production

- Treat **merge to `main`** as the single production gate (Release workflow runs after CI on `main`).
- Do **not** run `fly deploy` locally for routine fixes unless the user explicitly requests an emergency hotfix **and** understands it bypasses the normal PR path.
- If the user asks to “deploy” mid-task, finish on a branch, open PR, merge once — then confirm release completed.

## When already on `main` with unpushed work

- Create a branch from current state and move commits there before pushing:
  ```bash
  git checkout -b fix/short-description
  git push -u origin HEAD
  ```

## Exceptions (user must say so explicitly)

- User explicitly requests: “push to main”, “hotfix main”, “deploy now on main”
- Even then: prefer a single consolidated push/merge, not a stream of commits
