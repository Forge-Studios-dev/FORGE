# Local demo alternatives (ngrok & VPS)

> **Default local setup:** [GETTING_STARTED.md](./GETTING_STARTED.md)  
> **MVP on the internet:** [MVP_GO_LIVE.md](./MVP_GO_LIVE.md)

Use this doc only when you need a **remote URL without full cloud deploy**, or a **single VPS**.

---

## Path A — ngrok (remote client call, API on your laptop)

1. Complete [GETTING_STARTED.md](./GETTING_STARTED.md) and run `dev:api`, `dev:web`, `dev:admin`.
2. Install [ngrok](https://ngrok.com) and expose ports:

```bash
ngrok http 3000   # web — share this URL
ngrok http 3001   # API (second tunnel or paid plan)
ngrok http 3002   # admin
```

3. Update env and **restart** all three apps:

**`apps/web/.env.local`**

```env
NEXT_PUBLIC_API_URL=https://YOUR-API-NGROK-URL/api/v1
NEXT_PUBLIC_APP_URL=https://YOUR-WEB-NGROK-URL
```

**`apps/admin/.env.local`**

```env
NEXT_PUBLIC_API_URL=https://YOUR-API-NGROK-URL/api/v1
```

**`apps/api/.env`**

```env
WEB_URL=https://YOUR-WEB-NGROK-URL
ADMIN_URL=https://YOUR-ADMIN-NGROK-URL
```

---

## Path B — Single VPS (Docker Compose)

For a dedicated server (e.g. Oracle Cloud free VM, AWS EC2):

```bash
cp compose.prod.env.example .env
cp apps/api/.env.production.example apps/api/.env.production
cp apps/web/.env.production.example apps/web/.env.production
cp apps/admin/.env.production.example apps/admin/.env.production
# Edit secrets, TLS under infra/nginx/ssl/
docker compose -f docker-compose.prod.yml up -d
```

Production deploy uses GitHub Actions → Fly + Vercel — see [CI_CD.md](./CI_CD.md). This VPS path is manual `docker compose` only.

---

## 15-minute demo script

1. Guest — browse home, explore, watch  
2. Viewer — `viewer@forge.local` / `ForgeDemo123!`  
3. Admin — `admin@forge.local` / `ForgeAdmin123!` on admin URL  

Details: [mvp-test-matrix.md](./mvp-test-matrix.md)
