# Phase 14 — Executive Summary

**Audit date:** 2026-06-04  
**Platform:** FORGE — skill-first creator platform (NestJS, Next.js, Flutter)  
**Lens:** Cost + scale (Mux, Fly, Neon, Redis, growth breakpoints)  
**Full reports:** [docs/audits/README.md](./README.md)

---

## Executive summary

FORGE is a **production-viable modular monolith** with sensible separation of HTTP (Fly API) and async work (Fly worker), Mux-centric media, and strong auth/entitlements foundations. The architecture is appropriate for MVP through ~100K MAU **if** hot-path database load and media COGS are actively managed.

Primary risks are **economic and scaling**, not fundamental design flaws: **Mux variable cost** without full monetization (Stripe Phase 2), **per-request JWT database lookups**, **N+1 entitlement checks on live streams**, **Fly scale-to-zero latency**, and **missing DR/staging**. Security baseline is solid; gaps are CI dependency scanning and CSRF hardening for cookie refresh.

---

## What is good

- Feature-based NestJS modules with global guard pipeline and prod config validation (`validate-production-config.ts`)
- Worker isolation for video, analytics, push, subscriptions
- Redis used correctly for feed cache, view counts, socket scale-out, lockout
- CI + release pipeline with post-deploy smoke and metrics verification
- Public API contracts in `@forge/shared-types` and `API_SCHEMAS.md`
- Mux-only production transcode enforcement

---

## What is risky

| Risk | Impact |
|------|--------|
| Mux COGS without Stripe revenue | Unit economics |
| JWT → Postgres on every auth request | Neon cost + latency at scale |
| Live streams `checkAccess` per row | Endpoint degrades with concurrent lives |
| Fly `min_machines_running = 0` | Cold-start UX; retry storms |
| No Neon DR runbook | Business continuity |
| Mobile Socket.IO v2 vs API v4 | Realtime failures |
| Analytics table growth | Storage cost |

---

## What is unnecessary

- `express-rate-limit` package (unused — use Throttler only)
- FFmpeg worker in any production environment
- Second observability path without OTel collector configured
- Potential second Vercel project long-term if admin remains low-traffic

---

## What should be removed / replaced / optimized

| Action | Item |
|--------|------|
| **Remove** | `express-rate-limit` dependency |
| **Replace** | Mobile `socket_io_client` v2 → v4-compatible |
| **Optimize** | JWT user cache; batch entitlements; Mux asset lifecycle; analytics retention |
| **Consolidate** | Redis client strategy (document); Vercel apps (future) |
| **Keep** | NestJS monolith, Mux, Neon, Redis Cloud, BullMQ worker split |

---

## Top 20 highest-priority fixes

Ranked by **cost + scale** weight, then security and velocity.

| Rank | ID | Fix | Business | Cost | Security | Perf | Velocity |
|------|-----|-----|----------|------|----------|------|----------|
| 1 | F-501 | Cache JWT user validation (Redis short TTL) | ● | ●●● | ● | ●●● | ●● |
| 2 | F-502 | Batch `checkAccess` on live stream lists | ● | ●● | ● | ●●● | ●● |
| 3 | F-1001 | Mux cost runbook + webhook idempotency audit | ●● | ●●● | ● | ● | ● |
| 4 | F-1002 | Fly prod SLO: scale-to-zero vs min=1 | ● | ●● | — | ●●● | ● |
| 5 | F-1101 | Stripe Phase 2 (real billing) | ●●● | ●●● | ● | — | ●● |
| 6 | F-901 | Neon PITR + restore drill documented | ●● | ● | ●● | — | ● |
| 7 | F-302 | Upgrade mobile Socket.IO client | ● | ● | ● | ●● | ●● |
| 8 | F-504 | Analytics retention / partitioning | ● | ●● | ● | ●● | ●● |
| 9 | F-903 | Worker queue depth Grafana alerts | ● | ● | ● | ●● | ●● |
| 10 | F-801 | CI: npm audit + CodeQL | ● | — | ●●● | — | ●● |
| 11 | F-602 | Global API max pagination limit | ● | ● | ● | ●● | ● |
| 12 | F-1301 | Entitlement Redis cache `viewer:creator` | ● | ●● | ● | ●● | ●● |
| 13 | F-902 | Staging environment (Fly + Neon branch) | ●● | ● | ●● | — | ●●● |
| 14 | F-1102 | Mobile VOD/live playback parity | ●● | ●● | — | ●● | ●● |
| 15 | F-803 | Disable Sentry default PII in prod | ● | — | ●● | — | ● |
| 16 | F-301 | Remove unused express-rate-limit | — | — | — | — | ●●● |
| 17 | F-1201 | API coverage gate on critical modules | ● | — | ●● | ● | ●● |
| 18 | F-303 | Document Redis dual-client limits | — | ●● | — | ● | ● |
| 19 | F-802 | CSRF strategy for refresh cookie | ● | — | ●● | — | ●● |
| 20 | F-601 | API versioning / deprecation policy | ●● | — | — | — | ●●● |

---

## 30-day roadmap

### Week 1 — Measure & quick wins

- Baseline: Fly cold-start p95, Neon QPS on auth routes, Mux dashboard minutes
- Remove `express-rate-limit` (F-301)
- Set `SENTRY_SEND_DEFAULT_PII=false` in prod (F-803)
- Document Mux webhook idempotency review (F-1001)

### Week 2 — Hot path performance

- Implement JWT user snapshot cache (F-501)
- Batch entitlements on `getLiveStreams` (F-502)
- Add global max `limit` on list endpoints (F-602)

### Week 3 — Ops & cost

- Fly SLO decision and config change if needed (F-1002)
- Grafana BullMQ queue alerts (F-903)
- Draft Neon restore runbook (F-901)

### Week 4 — Client & CI

- Plan mobile Socket.IO upgrade (F-302)
- Add `npm audit` to CI (F-801)
- API coverage gate proposal for auth/entitlements/content (F-1201)

---

## 90-day roadmap

### Month 1

- Complete weeks 1–4 above
- Analytics retention job (F-504)
- Staging environment bootstrap (F-902)

### Month 2

- Mobile socket upgrade + playback QA (F-302, F-1102)
- Entitlement cache layer (F-1301)
- Admin security headers parity (F-805)
- CSRF design for refresh (F-802)

### Month 3

- Stripe Phase 2 kickoff (F-1101) — payment provider + webhook module
- Load test feed + live at 100K simulated entitlements
- Search sidecar evaluation if FTS p95 degrades (F-1302)
- API versioning policy doc (F-601)

---

## Scorecard summary

| Phase | Key score |
|-------|-----------|
| Architecture | 6–8/10 dimensions — see [02](./02_ARCHITECTURE_SCORECARD.md) |
| Code quality | 7/10 — see [12](./12_CODE_QUALITY_SCORECARD.md) |
| Infra maturity | 6/10 — see [09](./09_INFRASTRUCTURE_MATURITY.md) |

---

## Next steps for engineering leadership

1. Approve Fly SLO and JWT cache work as **sprint 1** infra/performance.
2. Assign **platform** owner for Mux cost runbook and analytics retention.
3. Schedule **Stripe Phase 2** product/engineering kickoff before paid marketing scale.
4. Re-audit after 90 days or at 50K MAU — whichever comes first.

## Post-audit implementation (2026-06-04)

| Rank | ID | Status |
|------|-----|--------|
| 1 | F-501 JWT Redis cache | **Shipped** — `auth-user-cache.service.ts` |
| 2 | F-502 Batch live entitlements | **Shipped** — `checkAccessMany` |
| 16 | F-301 Remove express-rate-limit | **Shipped** |
| 11 | F-602 Pagination max limit 50 | **Shipped** |
| 7 | F-801 CI npm audit job | **Shipped** (non-blocking) |
| 3 | F-1001 Mux cost runbook | **Shipped** |
| 6 | F-901 DR runbook | **Shipped** |
| 15 | F-803 Sentry PII env default | **Shipped** (`.env.example`) |
| — | F-805 Admin security headers | **Shipped** |

See [AUDIT_COMPLETION.md](./AUDIT_COMPLETION.md).

*Remaining items are documented for backlog; merge via feature branch per repo git policy.*
