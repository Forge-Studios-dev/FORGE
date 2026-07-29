# FORGE — Audit Remediation Tracker

**Source of truth:** [FRESH_AUDIT_2026-07-26_MASTER.md](./FRESH_AUDIT_2026-07-26_MASTER.md) + [INFRA_AUDIT_2026-07-29.md](./INFRA_AUDIT_2026-07-29.md).  
**Branch:** `fix/production-hardening-audit-2026-07-26`  
**Updated:** 2026-07-29 (Wave 1 hardening commit — honest status)

Legend: ⬜ not started · 🔄 in progress · ✅ done · ⚠️ partial · ⏸️ blocked/deferred · ❌ out of scope this pass

---

## Critical (6)

| # | Finding | Status | Notes |
|---|---|---|---|
| C1 | `main` branch protection | ✅ | Live via gh api |
| C2 | CommunitiesService god object | ⚠️ | Access/Analytics/ChannelLegacy extracted; facade still ~900 LOC |
| C3 | Billing⇄Entitlements cycle | ✅ | StripeTierSyncModule |
| C4 | Course SSR/sitemap | ✅ | |
| C5 | Mobile TextEditingController leak | ✅ | |
| C6 | Manual flagship QA | ⚠️ | Checklist only; live click-through operator-owned |

---

## High (23)

| # | Finding | Status | Notes |
|---|---|---|---|
| H-A1 | EntitlementsService god object | ⚠️ | analytics extract (~140 LOC); main service still ~1.4k LOC |
| H-A2 | web/admin HTTP/CSRF dup | ✅ | packages/shared-types csrf |
| H-A3 | knip tooling | ✅ | knip.json + `npm run knip` non-blocking |
| H-A4 | Legacy channels quarantine | ✅ | ChannelLegacyService |
| H-B1 | Nest API versioning | ✅ | enableVersioning + prefix api |
| H-B2 | ffmpeg/Mux default | ✅ | Mux prod; ffmpeg opt-in |
| H-B3 | reports index | ✅ | migration 1840000000000 |
| H-F1 | Button focus-visible | ✅ | |
| H-F2 | aria-label sweep | ⚠️ | critical screens only |
| H-F3 | dark theme documented | ✅ | apps/web/README |
| H-F4 | form validation | ⏸️ | Adopt incrementally; not mass-migrated |
| H-F5 | Admin skeletons | ✅ | |
| H-M1 | Repo pattern start | ⚠️ | LiveRepository template only — not 71% migration |
| H-M2 | Silent catches → Sentry | ⚠️ | captureError + live/community subset, not all ~47 |
| H-M3 | Semantics/tooltips | ⚠️ | community IconButtons subset |
| H-M4 | Deprecated Dropdowns | ⏸️ | Needs controller pattern; no crash risk found |
| H-D1 | Actions @master | ✅ | SHA-pinned flyctl v1.5 |
| H-D2 | AWS key rotation | ✅ | AWS_CREDENTIAL_ROTATION.md |
| H-D3 | docker-compose.prod | ✅ | .reference.yml |
| H-Q1 | Playwright stubs | ✅ | checkout/upload/moderation |
| H-Q2 | RecommendationsService tests | ✅ | |
| H-Q3 | Semantic search | ⏸️ | F-1302 Phase 5 |
| H-Q4 | Podcasts web UI | ✅ | /podcasts |

---

## Medium

| # | Finding | Status |
|---|---|---|
| M-S1 | JWT purpose check | ✅ |
| M-S2 | CSRF fail-safe | ✅ |
| M-S3 | Presigned upload size | ✅ |
| M-S4 | SVG upload blocked | ✅ |
| M-B1 | Pagination util hotspots | ✅ | courses/certs + cohorts cap (not ~190 endpoints) |
| M-B2 | Batch cron writes | ✅ |
| M-B3 | EventsGateway split | ✅ | EventsBroadcastListener + SocketIoHub |
| M-B4 | OpenAPI in prod | ✅ | docs-json always |
| M-D1 | CODEOWNERS | ✅ |
| M-D2 | Worker HEALTHCHECK | ✅ |
| M-D3 | .dockerignore | ✅ |
| M-D4 | npm audit flake tracking | ✅ | artifact on registry outage |
| M-D5 | Worker --ha=false | ✅ | Documented accepted SPOF |
| M-D6 | Terraform remote state | ✅ | README note |
| M-D7 | Emergency deploy bom | ✅ |
| M-Q1 | Coverage thresholds | ✅ | 38/37/36/24 |
| M-Q2 | Cold-start onboarding | ✅ | /onboarding/interests |
| M-M1 | Localization scaffolding | ✅ | flutter_localizations + arb |
| M-M3 | Router errorBuilder | ✅ |
| M-I1 | Mux/Neon/Redis WIP | ⚠️ | Code on branch (5m/15m + installExtensions:false); **not prod-deployed** |

---

## Low

| # | Finding | Status |
|---|---|---|
| L1 | SVG mime | ✅ | Already removed creator-resources |
| L2 | Script set -eu | ✅ | Key scripts |
| L3 | reports index doc | ✅ | Entity + migration |
| L4 | Knip | ✅ | Non-blocking script |

---

## Deferred Phase 5

| ID | Status | Doc |
|----|--------|-----|
| F-1101 Stripe Connect | ⏸️ scaffolded | [PHASE5_DEFERRED_STATUS.md](./PHASE5_DEFERRED_STATUS.md) |
| F-1302 Search sidecar | ⏸️ trigger-gated | same |
| Load test k6 stub | ✅ harness | `scripts/load/entitlements-k6.js` |
| Neon restore cadence | ✅ noted | same |
| Mux monthly cost | ⏸️ needs Mux creds | same |

---

## Verification

- Targeted API unit suites: streaming, communities, entitlements, gateway, recommendations, auth-cookies.
- Full `ci:local` before PR merge.
- Fly deploy of Mux-interval hardening **not** done — requires explicit user request.
- Neon/AWS/Mux live metrics filled in Wave 2 when credentials available.
