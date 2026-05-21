# Domain setup — forgestudios.net

Connect **forgestudios.net** to Vercel (web + admin) and Fly.io (API).

**Registrar / DNS:** Squarespace (`squarespacedns.com`) — use **Part 3** for copy-paste records.  
Other registrars: same record types; use values from your Vercel/Fly dashboards.

| URL | Service |
|-----|---------|
| `https://forgestudios.net` | Web (Vercel) |
| `https://www.forgestudios.net` | Redirect → apex (optional) |
| `https://admin.forgestudios.net` | Admin (Vercel) |
| `https://api.forgestudios.net` | API (Fly.io) |

**API fallback:** `https://forge-studios-api.fly.dev/api/v1`

---

## Part 1 — Deploy apps (Vercel + Fly)

### Vercel (web + admin)

```bash
npm i -g vercel@latest
vercel login
cd /path/to/FORGE
npm run deploy:vercel
# or: bash scripts/vercel-setup.sh
```

**Monorepo:** In each Vercel project → **Settings → General** → enable **“Include source files outside of the Root Directory in the Build Step”**.

**Production env (both projects):**

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://api.forgestudios.net/api/v1` |
| `API_INTERNAL_URL` | `https://api.forgestudios.net/api/v1` (web only) |
| `NEXT_PUBLIC_APP_URL` | `https://forgestudios.net` (web only) |
| `NEXT_PUBLIC_WEB_URL` | `https://forgestudios.net` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://admin.forgestudios.net` |

Manual import: [vercel.com/new](https://vercel.com/new) → repo `Forge-Studios-dev/FORGE` → root `apps/web` and `apps/admin` as separate projects.

### Fly (API)

```bash
fly certs add api.forgestudios.net --app forge-studios-api
fly certs show api.forgestudios.net --app forge-studios-api
fly secrets set \
  WEB_URL='https://forgestudios.net' \
  ADMIN_URL='https://admin.forgestudios.net' \
  --app forge-studios-api
```

---

## Part 2 — Attach domains in Vercel

| Project | Domains to add |
|---------|----------------|
| **web** | `forgestudios.net`, `www.forgestudios.net` |
| **admin** | `admin.forgestudios.net` |

**Settings → Domains** → wait for **Valid Configuration**.  
If apex is on another project, remove it there first.

Vercel usually shows:

| Type | Host | Value |
|------|------|--------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |
| CNAME | `admin` | `cname.vercel-dns.com` (or project-specific target) |

**Always prefer values from your Vercel dashboard** over this table.

---

## Part 3 — Squarespace DNS (forgestudios.net)

**Where:** [account.squarespace.com](https://account.squarespace.com) → **Domains** → **forgestudios.net** → **DNS Settings** → **Custom records**

1. **Delete** old apex **A** records pointing to Squarespace parking (`198.185.159.x`).
2. **Delete** old `www` CNAME → `ext-sq.squarespace.com` (if present).
3. **Add** records below. Save. Propagation: 15 min – 48 h (often &lt; 1 h).
4. Do **not** remove **MX** / email **TXT** records (Google Workspace).

### Records to add

**Web (Vercel)**

| Type | Host | Data / Points to | TTL |
|------|------|------------------|-----|
| A | `@` | `76.76.21.21` | 3600 |
| CNAME | `www` | `cname.vercel-dns.com` | 3600 |

**Admin (Vercel)**

| Type | Host | Data / Points to | TTL |
|------|------|------------------|-----|
| CNAME | `admin` | `cname.vercel-dns.com` | 3600 |

Use Vercel’s admin-specific CNAME if the dashboard shows one (e.g. `xxxxx.vercel-dns-017.com`).

**API (Fly.io)**

| Type | Host | Data / Points to | TTL |
|------|------|------------------|-----|
| CNAME | `api` | `ked1nor.forge-studios-api.fly.dev` | 3600 |

Or **A** `api` → `66.241.125.64` if you prefer A records. Verify:

```bash
fly certs check api.forgestudios.net --app forge-studios-api
```

---

## Part 4 — Other registrars (Google / generic)

If DNS is not on Squarespace, add the same logical records at your provider:

| Type | Host | Value |
|------|------|--------|
| A | `@` | Vercel apex IP (usually `76.76.21.21`) |
| CNAME | `www` | Vercel `www` target |
| CNAME | `admin` | Vercel admin target |
| CNAME | `api` | `ked1nor.forge-studios-api.fly.dev` or output from `fly certs show` |

---

## Part 5 — After DNS propagates

| URL | Expected |
|-----|----------|
| https://forgestudios.net | FORGE web app |
| https://admin.forgestudios.net | Admin login |
| https://api.forgestudios.net/api/v1/health | `{"success":true,...}` |

Redeploy frontends if you changed API URL:

```bash
npm run deploy:vercel
```

Seed production DB if demo logins fail: `npm run db:neon:setup`

### Quick verify (terminal)

```bash
dig forgestudios.net A +short
dig www.forgestudios.net CNAME +short
dig admin.forgestudios.net CNAME +short
dig api.forgestudios.net CNAME +short
curl -s https://api.forgestudios.net/api/v1/health
```

---

## Part 6 — Remove “Coming Soon” on apex

The apex may show a parking page until:

1. Vercel **web** project owns `forgestudios.net`
2. DNS **A** for `@` points to Vercel (`76.76.21.21`), not Squarespace parking
3. Old site forwarding at the registrar is disabled

---

## Checklist

- [ ] Vercel web + admin deployed with env vars (Part 1)
- [ ] Domains attached in Vercel (Part 2)
- [ ] Squarespace (or registrar) DNS records (Part 3–4)
- [ ] Fly cert + `api` DNS + `WEB_URL` / `ADMIN_URL` secrets (Part 1)
- [ ] Health + login tests (viewer / admin demo users)
- [ ] Neon seed if needed: `npm run db:neon:setup`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| “Coming Soon” / Squarespace page | Apex A still `198.185.159.x` → set `@` → `76.76.21.21` |
| **www** wrong host | Remove `www` → `ext-sq.squarespace.com`; use Vercel CNAME only |
| Vercel Invalid Configuration | Wait for DNS; match host names exactly (`@` = root) |
| API SSL pending | CNAME `api` → `ked1nor.forge-studios-api.fly.dev`; `fly certs check` |
| CORS errors | `fly secrets set WEB_URL` / `ADMIN_URL` must match live URLs exactly (no trailing slash) |
| SSL pending on Vercel | Refresh Domains after DNS propagates |

---

*Last updated: 2026-05-21*
