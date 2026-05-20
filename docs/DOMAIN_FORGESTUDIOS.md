# Domain setup — forgestudios.net

Connect your domain to **Vercel** (web + admin) and **Fly.io** (API).

**Domain on Squarespace DNS?** Use the copy-paste guide: **[SQUARESPACE_DNS_FORGESTUDIOS.md](./SQUARESPACE_DNS_FORGESTUDIOS.md)**

**Live API today:** `https://forge-studios-api.fly.dev/api/v1`  
**Target layout:**

| URL | Service |
|-----|---------|
| `https://forgestudios.net` | Web app (Vercel) |
| `https://www.forgestudios.net` | Redirect → apex (optional) |
| `https://admin.forgestudios.net` | Admin panel (Vercel) |
| `https://api.forgestudios.net` | API (Fly.io) |

---

## Part 1 — Vercel (web + admin)

### 1.1 Install CLI & login

```bash
npm i -g vercel@39
vercel login
cd /path/to/FORGE
```

### 1.2 Automated deploy (recommended)

```bash
cd /path/to/FORGE
bash scripts/vercel-setup.sh
```

Or: `npm run deploy:vercel`

**Important (monorepo):** In each Vercel project → **Settings → General** → enable  
**“Include source files outside of the Root Directory in the Build Step”**.  
Without this, `npm ci` fails because the repo root `package-lock.json` is missing.

### 1.3 Manual — two projects

**Web**

1. [vercel.com/new](https://vercel.com/new) → Import `Forge-Studios-dev/FORGE`
2. **Root Directory:** `apps/web`
3. **Production env:**

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://api.forgestudios.net/api/v1` |
| `API_INTERNAL_URL` | `https://api.forgestudios.net/api/v1` |
| `NEXT_PUBLIC_APP_URL` | `https://forgestudios.net` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://admin.forgestudios.net` |

4. Deploy.

**Admin**

1. New project → same repo → **Root Directory:** `apps/admin`
2. **Production env:**

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://api.forgestudios.net/api/v1` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://admin.forgestudios.net` |
| `NEXT_PUBLIC_WEB_URL` | `https://forgestudios.net` |

3. Deploy.

---

## Part 2 — Custom domains on Vercel

### Web project → Domains

1. Vercel → **forge-web** (or your web project) → **Settings → Domains**
2. Add: `forgestudios.net` and `www.forgestudios.net`
3. Vercel shows DNS records (usually **A** `76.76.21.21` and **CNAME** `www` → `cname.vercel-dns.com`)

### Admin project → Domains

1. Admin project → **Settings → Domains**
2. Add: `admin.forgestudios.net`
3. Note the **CNAME** target (e.g. `cname.vercel-dns.com` or project-specific)

---

## Part 3 — Google domain DNS

Where you bought the domain (Google Workspace / Squarespace / Google Domains):

1. Open **DNS management** for `forgestudios.net`  
   - [Google Domains](https://domains.google.com) (may redirect to Squarespace)  
   - Or **Google Admin** → Account → Domains → Manage domains → DNS  
   - Or **Squarespace** → Domains → forgestudios.net → DNS Settings

2. Add records Vercel shows (example — **use values from your Vercel dashboard**):

| Type | Host / Name | Value | TTL |
|------|-------------|--------|-----|
| A | `@` | `76.76.21.21` | 3600 |
| CNAME | `www` | `cname.vercel-dns.com` | 3600 |
| CNAME | `admin` | `cname.vercel-dns.com` (or Vercel’s admin target) | 3600 |

3. Save. DNS can take **5 minutes – 48 hours** (often &lt; 1 hour).

4. In Vercel, wait until each domain shows **Valid Configuration**.

---

## Part 4 — API on Fly.io (`api.forgestudios.net`)

### 4.1 Add certificate on Fly

```bash
fly certs add api.forgestudios.net --app forge-studios-api
fly certs show api.forgestudios.net --app forge-studios-api
```

Fly prints a **CNAME** like `_flydns.api` → `api.forgestudios.net.flydns.net` (use **your** output).

### 4.2 DNS record (Google)

| Type | Host / Name | Value |
|------|-------------|--------|
| CNAME | `api` | `forge-studios-api.fly.dev` |

Or use the exact target from `fly certs show` if Fly asks for `_flydns` style records.

### 4.3 Update Fly CORS + app URLs

```bash
fly secrets set \
  WEB_URL='https://forgestudios.net' \
  ADMIN_URL='https://admin.forgestudios.net' \
  --app forge-studios-api
```

### 4.4 Verify API

```bash
curl -s https://api.forgestudios.net/api/v1/health
```

---

## Part 5 — Remove “Coming Soon” on apex

Your apex [forgestudios.net](http://forgestudios.net/) may show a parking page until:

1. Vercel web project owns `forgestudios.net` (Part 2)
2. DNS **A** / **CNAME** point to Vercel (Part 3)
3. Old Google/Squarespace site forwarding is disabled

---

## Part 6 — Checklist

- [ ] Vercel web deployed with env vars (Part 1)
- [ ] Vercel admin deployed with env vars (Part 1)
- [ ] `forgestudios.net` + `admin.forgestudios.net` on Vercel (Part 2)
- [ ] Google DNS records added (Part 3)
- [ ] `api.forgestudios.net` on Fly + DNS (Part 4)
- [ ] `fly secrets set WEB_URL` + `ADMIN_URL` (Part 4.3)
- [ ] Login test: `viewer@forge.local` on web, `admin@forge.local` on admin
- [ ] Seed DB if needed: `npm run db:neon:setup`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Site still “Coming Soon” | DNS not pointing to Vercel yet; remove old A records at registrar |
| CORS errors | `WEB_URL` / `ADMIN_URL` on Fly must match `https://forgestudios.net` and `https://admin.forgestudios.net` exactly |
| SSL pending on Vercel | Wait for DNS propagation; click Refresh in Domains |
| API SSL pending on Fly | `fly certs show api.forgestudios.net` — add CNAME Fly shows |
| Admin on wrong domain | Admin is a **separate** Vercel project with `admin.forgestudios.net` only |

---

*API fallback until custom domain works:* `https://forge-studios-api.fly.dev/api/v1`
