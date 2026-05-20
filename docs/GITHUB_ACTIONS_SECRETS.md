# GitHub Actions secrets — where to get each value

You **cannot look up** an old `FLY_API_TOKEN` or `VERCEL_TOKEN` later. If you do not have them saved, **create new ones** and paste into GitHub once.

**GitHub path:** [github.com/Forge-Studios-dev/FORGE/settings/secrets/actions](https://github.com/Forge-Studios-dev/FORGE/settings/secrets/actions) → **New repository secret**

Logged-in accounts on this machine:

| Service | Account |
|---------|---------|
| Fly.io | `forge-support@forgestudios.net` |
| Vercel | `forge-support-5996` (team: **forge-s-projects3**) |

---

## 1. Values you can copy now (not secret, but stored as GitHub secrets)

| Secret name | Value |
|-------------|--------|
| `VERCEL_ORG_ID` | `team_CaZHYULfOEkUneEn2CDN6CGw` |
| `VERCEL_PROJECT_ID_WEB` | `prj_XSO4gENpdrFBUmGWmxLSZSUXTbbC` |
| `VERCEL_PROJECT_ID_ADMIN` | `prj_zowMHYefTqYYQWD6ZaXxhLw2LxbC` |

Source: `apps/web/.vercel/project.json` and `apps/admin/.vercel/project.json`.

---

## 2. `FLY_API_TOKEN` — create on Fly.io

1. Open **[fly.io/user/personal_access_tokens](https://fly.io/user/personal_access_tokens)** (log in as `forge-support@forgestudios.net`).
2. Click **Create token** (or **Create Personal Access Token**).
3. Name: `github-actions-forge`
4. Copy the token **immediately** (shown only once).
5. GitHub → **New repository secret** → Name: `FLY_API_TOKEN` → paste token → **Add secret**.

**Alternative (this Mac, already logged in to Fly):**

```bash
fly auth token | pbcopy
```

Then paste into GitHub as `FLY_API_TOKEN`. (Uses your current Fly login; fine for CI deploy.)

---

## 3. `VERCEL_TOKEN` — create on Vercel

1. Open **[vercel.com/account/settings/tokens](https://vercel.com/account/settings/tokens)** (log in as `forge-support-5996`).
2. Click **Create Token**.
3. Name: `github-actions-forge`
4. Scope: **Full Account** (or at least deploy access for team **forge-s-projects3**).
5. Copy the token **immediately**.
6. GitHub → **New repository secret** → Name: `VERCEL_TOKEN` → paste → **Add secret**.

**Do not** share this token in chat or commit it to the repo.

---

## 4. Quick local helper (optional)

From repo root:

```bash
bash scripts/print-github-secrets.sh
```

Prints the three IDs and copies the Fly token to your clipboard (macOS). Vercel token must still be created in the dashboard (step 3).

---

## 5. Verify after adding all 5 secrets

1. GitHub → **Actions** → **Deploy API (Fly.io)** → **Run workflow**.
2. GitHub → **Actions** → **Deploy Web & Admin (Vercel)** → **Run workflow**.

Both should complete without “secret not found” or auth errors.

---

## Checklist

- [ ] `FLY_API_TOKEN`
- [ ] `VERCEL_TOKEN`
- [ ] `VERCEL_ORG_ID` = `team_CaZHYULfOEkUneEn2CDN6CGw`
- [ ] `VERCEL_PROJECT_ID_WEB` = `prj_XSO4gENpdrFBUmGWmxLSZSUXTbbC`
- [ ] `VERCEL_PROJECT_ID_ADMIN` = `prj_zowMHYefTqYYQWD6ZaXxhLw2LxbC`
