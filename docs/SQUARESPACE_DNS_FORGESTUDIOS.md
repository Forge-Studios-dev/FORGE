# Squarespace DNS for forgestudios.net

Your domain uses **Squarespace nameservers** (`squarespacedns.com`). DNS is edited in **Squarespace**, not Google Workspace directly.

**Where to go:** [account.squarespace.com](https://account.squarespace.com) → **Domains** → **forgestudios.net** → **DNS Settings** (or **DNS / Custom records**)

Remove or replace the default **Squarespace parking** records (A records pointing to `198.185.159.x`) when you go live with FORGE.

---

## Records to add (copy into Squarespace)

### 1. Web app (Vercel) — apex + www

| Type | Host | Data / Points to | TTL |
|------|------|------------------|-----|
| **A** | `@` | `76.76.21.21` | 3600 |
| **CNAME** | `www` | `cname.vercel-dns.com` | 3600 |

> If Vercel dashboard shows a **different** apex IP or CNAME for `www`, use those values instead (Project **web** → Settings → Domains).

### 2. Admin panel (Vercel)

| Type | Host | Data / Points to | TTL |
|------|------|------------------|-----|
| **CNAME** | `admin` | `cname.vercel-dns.com` | 3600 |

> After adding `admin.forgestudios.net` in Vercel **admin** project → Domains, Vercel may show a project-specific CNAME (e.g. `xxxxx.vercel-dns-017.com`). **Use that value** if shown.

### 3. API (Fly.io)

**Option A — CNAME (recommended)**

| Type | Host | Data / Points to | TTL |
|------|------|------------------|-----|
| **CNAME** | `api` | `ked1nor.forge-studios-api.fly.dev` | 3600 |

**Option A2 — A record**

| Type | Host | Data / Points to | TTL |
|------|------|------------------|-----|
| **A** | `api` | `66.241.125.64` | 3600 |

Verify certificate after DNS propagates:

```bash
fly certs check api.forgestudios.net --app forge-studios-api
```

---

## Squarespace step-by-step

1. Log in to **Squarespace** → **Domains** → select **forgestudios.net**.
2. Open **DNS Settings** / **Advanced Settings** → **Custom records**.
3. **Delete** old A records for `@` that point to Squarespace parking (`198.185.159.x`) if you are not using a Squarespace site on this domain.
4. **Add** the records in the tables above.
5. Save. Wait **15 minutes – 48 hours** (often under 1 hour).

---

## Vercel: attach domains (dashboard)

Do this in parallel with DNS:

| Project | Domains to add |
|---------|----------------|
| **web** | `forgestudios.net`, `www.forgestudios.net` |
| **admin** | `admin.forgestudios.net` |

If `forgestudios.net` is on another Vercel project, remove it there first, then add to **web**.

**Settings → Domains** → wait for **Valid Configuration** (green check).

---

## After DNS propagates

| URL | Should show |
|-----|-------------|
| https://forgestudios.net | FORGE web app |
| https://admin.forgestudios.net | Admin login |
| https://api.forgestudios.net/api/v1/health | `{"success":true,...}` |

Update Vercel env when API custom domain works:

```
NEXT_PUBLIC_API_URL=https://api.forgestudios.net/api/v1
API_INTERNAL_URL=https://api.forgestudios.net/api/v1
```

Then redeploy web + admin (`bash scripts/vercel-setup.sh`).

---

## Google Workspace email (keep working)

Do **not** remove MX records for Google email. Only change **A / CNAME** for web subdomains. If you use email on this domain, leave existing **MX** and **TXT** (SPF/DKIM) records.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Still “Coming Soon” / Squarespace page | Apex A records still point to `198.185.159.x` — switch to `76.76.21.21` |
| **www** shows Squarespace or client error | **Delete** old `www` CNAME → `ext-sq.squarespace.com` and any `www` **A** records; keep only `www` → `cname.vercel-dns.com` |
| Vercel “Invalid Configuration” | DNS not propagated; compare host names exactly (`@` = root) |
| API cert not verified | Add CNAME `api` → `ked1nor.forge-studios-api.fly.dev`; run `fly certs check` |
| CORS errors | `fly secrets set WEB_URL=https://forgestudios.net ADMIN_URL=https://admin.forgestudios.net` |

---

## Quick verify (terminal)

```bash
dig forgestudios.net A +short          # expect 76.76.21.21
dig www.forgestudios.net CNAME +short
dig admin.forgestudios.net CNAME +short
dig api.forgestudios.net CNAME +short  # expect ked1nor.forge-studios-api.fly.dev
curl -s https://forge-studios-api.fly.dev/api/v1/health
```
