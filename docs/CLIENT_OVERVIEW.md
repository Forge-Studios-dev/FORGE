# FORGE — Client Overview

**Audience:** Stakeholders · **Spec:** [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)  
**Product:** [FORGE_PRODUCT_STRATEGY.md](./FORGE_PRODUCT_STRATEGY.md) · **Audit:** [audits/FRESH_AUDIT_2026-09-03_MASTER.md](./audits/FRESH_AUDIT_2026-09-03_MASTER.md)

## Product

**Skill-first creator platform** powered by YouTube-style video mechanics: channels, upload/watch, subscriptions, playlists, comments, live streaming, Community tab. Selective skill extensions (courses, mentorship, channel points) ship **flag-gated** — enable via `FEATURES_*` (see [FORGE_IMPLEMENTATION_ROADMAP.md](./FORGE_IMPLEMENTATION_ROADMAP.md)). Surfaces: web, mobile, admin, one API. **No ad network** (ADR-005).

## Goals

| Goal | Delivery |
|------|----------|
| Discovery | Categories, tags, search, feeds, recommendations, Shorts feed |
| Trusted creators | Admin approval before publish/live |
| Video | S3 upload → Mux HLS; Shorts (≤60s auto-classified) |
| Live | Mux + stream chat, polls, clips, AI summaries (flag/key gated) |
| Engagement | Likes, comments, follows, playlists, first-run onboarding (mobile); platform XP API exists — **consumer gamification UI out of default scope** (ADR-007) |
| Community | Creator channels (tier-gated), RBAC, room messages, polls, events |
| Monetization | Stripe memberships + paid events + Super Chat/Thanks + program pricing |
| AI | LLM moderation, summaries, copilot — **config-dependent** (`AI_CLAUDE_ENABLED` + key) |
| Design | `@forge/design-system` + optional Stitch blueprints (`/blueprints`) |
| Operations | Admin moderation, audit log, analytics, community health KPI dashboard |

## Roles

Guest → user → creator (approved) · admin on separate admin app.

## Status (feature snapshot: [FORGE_PROJECT_MASTER.md §16](./FORGE_PROJECT_MASTER.md#16-feature-status-matrix) — do not use CEOS tracker %)

| Area | API | Web | Mobile | Admin |
|------|:---:|:---:|:------:|:-----:|
| Auth | ✅ | ✅ | ✅ | ✅ |
| Feed / search / recommendations | ✅ | ✅ | ✅ | — |
| Playlists | ✅ | ✅ | ✅ | — |
| VOD / live / Shorts | ✅ | ✅ | ⚠️ | — |
| Memberships / billing | ✅ | ✅ | ⚠️ | ⚠️ |
| Community / RBAC / rooms | ✅ | ✅ | ⚠️ | ✅ |
| Reports / moderation | ✅ | ✅ | ✅ | ✅ |
| AI (moderation, summaries, copilot) | ⚠️ | ⚠️ | ⚠️ | — |
| Creator analytics / KPI dashboard | ✅ | ⚠️ | ⚠️ | ✅ |
| Courses / programs | ✅ | ✅ | ✅ | ✅ |
| Content scan (CSAM vendor) | ⚠️ | — | — | ⚠️ |

✅ MVP-ready · ⚠️ partial or config-dependent · ⏳ not started

**Launch blockers (ops/legal, not %):** CSAM vendor, Stripe live keys, Neon PITR drill (2026-10-22), USPTO DMCA agent, staging load evidence — [roadmap R1](./FORGE_IMPLEMENTATION_ROADMAP.md).

### Playback parity (VOD / live)

| Capability | Web | Mobile |
|------------|:---:|:------:|
| Mux HLS URL playback | ✅ | ✅ |
| `accessDenied` / `accessReason` UI | ✅ | ✅ |
| Live chat (Socket.IO) | ✅ | ✅ |
| Membership purchase (Stripe) | ✅ | ⚠️ |

Modules & routes: [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) · Status: [§16](./FORGE_PROJECT_MASTER.md#16-feature-status-matrix)

## Stack

NestJS · Neon · Redis · Fly · Vercel · S3 · Mux

## Demo

Local: [GETTING_STARTED.md](./GETTING_STARTED.md) · Production: [DEPLOY.md](./DEPLOY.md)

---

*Sync this snapshot when [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) §16 changes. Last synced: 2026-09-03 evening.*
