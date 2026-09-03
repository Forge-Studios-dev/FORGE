# FORGE — Client Overview

**Audience:** Stakeholders · **Spec:** [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)

## Product

**Skill-first creator platform** powered by YouTube-style video mechanics: channels, upload/watch, subscriptions, playlists, comments, live streaming, Community tab. Selective skill extensions (courses, mentorship, channel points) ship **flag-gated** per [FORGE_PRODUCT_STRATEGY.md](./FORGE_PRODUCT_STRATEGY.md) — enable via `FEATURES_*` in `apps/api/.env` (see [FORGE_IMPLEMENTATION_ROADMAP.md](./FORGE_IMPLEMENTATION_ROADMAP.md)). Surfaces: web, mobile, admin, one API.

## Goals

| Goal | Delivery |
|------|----------|
| Discovery | Categories, tags, search, feeds, recommendations, Shorts feed |
| Trusted creators | Admin approval before publish/live |
| Video | S3 upload → Mux HLS; Shorts (≤60s auto-classified) |
| Live | Mux + stream chat, polls, clips, AI summaries |
| Engagement | Likes, comments, follows, playlists, platform XP/gamification, streaks, first-run onboarding + splash (mobile) |
| Community | Creator channels (tier-gated), RBAC, room messages, polls, events |
| Monetization | Stripe memberships + paid events + super chat + program pricing |
| AI | LLM moderation, discussion summaries, stream summaries, copilot, multi-provider routing |
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
| Memberships / billing | ✅ | ✅ | ⚠️ | — |
| Community / RBAC / rooms | ✅ | ✅ | ⚠️ | ✅ |
| Reports / moderation | ✅ | ✅ | ✅ | ✅ |
| AI (moderation, summaries, copilot) | ⚠️ | ⚠️ | ⏳ | — |
| Creator analytics / KPI dashboard | ✅ | ⚠️ | ⚠️ | ✅ |
| Courses / programs | ✅ | ✅ | ✅ | ✅ |

✅ MVP-ready · ⚠️ partial or config-dependent · ⏳ not started

### Playback parity (VOD / live)

| Capability | Web | Mobile |
|------------|:---:|:------:|
| Mux HLS URL playback | ✅ | ✅ |
| `accessDenied` / `accessReason` UI | ✅ | ✅ |
| Live chat (Socket.IO) | ✅ | ✅ |
| Membership purchase (Stripe) | partial | — |

Modules & routes: [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) · Status: [§16](./FORGE_PROJECT_MASTER.md#16-feature-status-matrix)

## Stack

NestJS · Neon · Redis · Fly · Vercel · S3 · Mux

## Demo

Local: [GETTING_STARTED.md](./GETTING_STARTED.md) · Production: [DEPLOY.md](./DEPLOY.md)

---

*Sync §4 when [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) changes.*
