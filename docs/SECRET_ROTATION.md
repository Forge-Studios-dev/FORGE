# Secret rotation — FORGE production

Rotate any credential that was pasted in chat, logged in CI, or shared outside a secrets manager.

## Priority (if exposed in support chat)

| Secret | Where | Rotate via |
|--------|-------|------------|
| `METRICS_SCRAPE_TOKEN` | Fly API | `npm run setup:fly:metrics-token` then update Grafana scrape job Bearer |
| Grafana service account (`glsa_…`) | Local / import script | Grafana → Administration → Service accounts → revoke → new token → `GRAFANA_SA_TOKEN` |
| Grafana Cloud access policy (`glc_…`) | Terraform / API scrape | Grafana Cloud → Access policies → revoke → new policy with required scopes |
| `FLY_API_TOKEN` | GitHub Actions | `fly tokens create deploy` → GitHub secret `FLY_API_TOKEN` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Fly API + worker | New values → `fly secrets set` on API and worker (sync script) — **invalidates all sessions** |
| `MUX_WEBHOOK_SECRET` | Fly API | Mux dashboard → regenerate → Fly secret |

## After rotating `METRICS_SCRAPE_TOKEN`

1. `npm run setup:fly:metrics-token` (or set manually on `forge-studios-api`)
2. `SHOW_SCRAPE_TOKEN=1 npm run configure:grafana-scrape` → copy token
3. Grafana → Connections → Metrics Endpoint → edit job `forge-api` → Bearer → Save
4. `npm run verify:metrics-scrape && npm run verify:grafana-metrics`

## Verify (no secrets printed)

```bash
npm run check:production          # smoke + API metrics + Grafana (if GRAFANA_SA_TOKEN set)
npm run verify:metrics-scrape
GRAFANA_SA_TOKEN=... npm run verify:grafana-metrics
```

## GitHub / Vercel

- **GitHub:** Settings → Secrets and variables → Actions — update `FLY_API_TOKEN`, `VERCEL_*`, optional `E2E_TEST_*`
- **Vercel:** Project env for `NEXT_PUBLIC_*` only; API secrets stay on Fly

See also [GRAFANA_SETUP.md](./GRAFANA_SETUP.md), [CI_CD.md](./CI_CD.md).
