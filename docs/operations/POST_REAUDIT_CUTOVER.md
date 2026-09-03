# Post-reaudit cutover (2026-09-03)

In-repo engineering for the zero-trust reaudit is on `main` (**#262**, **#263**, ADR-012 gate **#265**, flyctl secret workflows **#266**).

This runbook is the **ops path** only. Do not treat noop scan ack as CSAM protection (ADR-009 / ADR-012).

## 1. Merge gate

- [x] PR #263 squash-merged → `main`
- [x] ADR-012 Release secret audit + `Set content-scan secrets` workflow on `main` (#265 / #266)

## 2. Secrets before / with first boot after #262

Done (2026-09-03): Actions → **Set content-scan secrets (Fly)** (`mode=none`) set `CONTENT_SCAN_PROVIDER=none` + `CONTENT_SCAN_ALLOW_NOOP=true` on API + worker.

Re-run if needed:

```bash
gh workflow run 'Set content-scan secrets (Fly)' --ref main -f mode=none
# or locally after fly auth:
export CONTENT_SCAN_ALLOW_NOOP=true
npm run set:fly:content-scan-secrets
```

Confirm `ADMIN_URL` / `WEB_URL` are set on Fly (platform config exposes them for deep links).

Optional Copilot (ungates `ai.creatorInsights` when both are set):

```bash
# flyctl secrets set on API (and worker if workers call insights)
AI_CLAUDE_ENABLED=true
ANTHROPIC_API_KEY=sk-ant-...
```

## 3. Migrations

Applied via Fly `release_command` on successful Release (2026-09-03). Includes:

- `230…` — `content_scan_held` notification enum
- `231…` — `watch_history(watched_at)` index

## 4. Smoke after deploy

```bash
FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 FORGE_SMOKE_MODE=public bash scripts/smoke-api.sh
```

Prod verified 2026-09-03:

- `platform/config` includes `adminUrl` + `ai`
- health `checks.contentScan` is `noop_ack`

Manual (still recommended once):

1. Hold a scan → admin bell + `/content?moderationStatus=held`
2. Same event → uploader in-app / FCM → `/studio/videos/:id`
3. With Claude flag: Studio → Copilot (web + mobile)

## 5. Still open (legal / ops — not git)

| Item | Owner | Ref |
|------|-------|-----|
| CSAM vendor webhook | Legal + eng | ADR-009, `CONTENT_SCANNING.md` |
| Stripe live keys / Connect | Ops | `STRIPE_PRODUCTION_ENABLEMENT.md` |
| Neon PITR drill | Ops | next **2026-10-22** — `DISASTER_RECOVERY.md` |
| USPTO DMCA agent | Legal | `LEGAL.md` |
| Staging load evidence | Perf | `LOAD_TEST_RUNBOOK.md` |

Full launch checklist: [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md).
