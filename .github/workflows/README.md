# GitHub Actions

Production: **Fly.io** (API) + **Vercel** (web/admin) + **Neon** + **Redis Cloud**.

**Pipeline:** push/merge to `main` → **CI** → **Release (production)** deploys all apps.

Full workflow list, secrets setup, branch protection, and local CI parity:

**→ [docs/CI_CD.md](../../docs/CI_CD.md)**

Quick helper for GitHub secrets:

```bash
npm run gh:secrets
```
