# Feed / search / watch load-test runbook

Approximate **50K MAU** hot-path soak for staging.

```bash
npm run load-test:feed          # scripts/load-test-feed.sh — p50/p95 + optional evidence file
npm run load-test:community     # communities search/discover + live
npm run load-test:entitlements  # tiers / membership/me / live / feed (set FORGE_LOAD_CREATOR_ID)
```

## When to run

- Before a production release that touches feed, search ranking, or video detail.
- After Redis/Postgres capacity changes.
- Weekly soak on staging if traffic is climbing toward the 50K-MAU band.

## Prerequisites

1. Staging API healthy (`/health` or equivalent).
2. Env:
   - `FORGE_API_URL` — e.g. `https://api.staging.example/api/v1`
   - `FORGE_LOAD_VIDEO_ID` — optional published video UUID (watch path); omit to hit feed only
   - `FORGE_LOAD_CREATOR_ID` — optional creator UUID (tiers / membership / bundles)
   - `FORGE_LOAD_TOKEN` — optional JWT for authenticated entitlement paths
   - `FORGE_LOAD_EVIDENCE_FILE` — optional path to write attachable R1 evidence
3. Do **not** point at production.

## Default profile (~peak for 50K MAU)

```bash
export FORGE_API_URL=https://YOUR_STAGING/api/v1
export FORGE_LOAD_VIDEO_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export ITERATIONS=2000
export CONCURRENCY=40
# Optional: write attachable evidence for R1 gate
export FORGE_LOAD_EVIDENCE_FILE=docs/operations/evidence/load-test-feed-$(date -u +%Y%m%d).txt
./scripts/load-test-feed.sh
```

The script prints **HTTP status counts** and **latency avg / p50 / p95 / p99 / max** (curl `time_total`). No external `hey`/`k6` wrap required for feed soak evidence.

Rough math: 50K MAU ≈ a few hundred concurrent at peak; 40 concurrent mixed feed/search/watch is a light soak. Scale up:

| Goal | ITERATIONS | CONCURRENCY |
| --- | --- | --- |
| Smoke | 200 | 10 |
| Standard soak | 2000 | 40 |
| Hard soak | 10000 | 80 |

## Pass criteria

- HTTP status histogram dominated by `200` (allow a few `429` if rate limits are intentional).
- No sustained `5xx`.
- Script-reported **p95** `time_total` stays within your staging SLO; API and Neon CPU/connections stay under ~70% during the run.
- Redis connection count does not climb without bound (`docs/operations` Redis notes if present).

## After the run

1. Attach script stdout or `FORGE_LOAD_EVIDENCE_FILE` to the R1 / release ticket ([R1_LAUNCH_GATES.md](./R1_LAUNCH_GATES.md) §5).
2. Check Fly/Neon dashboards for error spikes and connection saturation.
3. If `5xx` > ~0.5%, stop ship until root-caused (N+1, pool exhaustion, bad index).

## Related

- Accessibility smoke: `apps/web/e2e/a11y-smoke.spec.ts`
- Production gate: `docs/operations/PRODUCTION_CHECKLIST.md`
