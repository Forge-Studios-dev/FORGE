# Post-reaudit cutover (2026-09-03)

In-repo engineering for the zero-trust reaudit is complete once **PR #262** (merged) and **PR #263** (web Copilot + FCM uploader routing) are on `main`.

This runbook is the **ops path** only. Do not treat noop scan ack as CSAM protection (ADR-009 / ADR-012).

## 1. Merge gate

- [ ] PR #263 approved by a reviewer with **write** access (branch protection requires 1 approving review)
- [ ] Squash-merge #263 → `main` (triggers Vercel web/admin + Fly release if configured)

## 2. Secrets before / with first boot after #262

```bash
export CONTENT_SCAN_ALLOW_NOOP=true   # until vendor webhook is live
npm run set:fly:content-scan-secrets
npm run sync:fly:worker-secrets
```

Or from GitHub Actions (uses `FLY_API_TOKEN`): **Actions → Set content-scan secrets (Fly) → Run workflow** with mode `none`.

Confirm `ADMIN_URL` / `WEB_URL` are set on Fly (platform config exposes them for deep links).

Optional Copilot:

```bash
# fly secrets set on API (and worker if workers call insights)
AI_CLAUDE_ENABLED=true
ANTHROPIC_API_KEY=sk-ant-...
```

## 3. Migrations

Apply pending TypeORM migrations including:

- `230…` — `content_scan_held` notification enum
- `231…` — `watch_history(watched_at)` index

## 4. Smoke after deploy

```bash
FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 FORGE_SMOKE_MODE=public bash scripts/smoke-api.sh
```

Expect:

- `platform/config` includes `adminUrl`
- health `checks.contentScan` is `noop_ack` or `webhook` (not silent `noop`)

Manual:

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
