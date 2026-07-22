# FORGE — Client Overview

**Audience:** Stakeholders · **Spec:** [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)

## Product

Skill-first platform: tutorial video, live teaching, expertise-based audiences. Surfaces: web, mobile, admin, one API.

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

## Status (task-level tracker: 96.6% — see [FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md](./FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md); this table is a simplified per-surface snapshot, see [FORGE_PROJECT_MASTER.md §16](./FORGE_PROJECT_MASTER.md#16-feature-status-matrix) for the authoritative version)

| Area | API | Web | Mobile | Admin |
|------|:---:|:---:|:------:|:-----:|
| Auth | ✅ | ✅ | ✅ | ✅ |
| Feed / search / recommendations | ✅ | ✅ | ⚠️ | — |
| VOD / live / Shorts | ✅ | ✅ | ⚠️ | — |
| Memberships / billing | ✅ | ✅ | ⚠️ | — |
| Community / RBAC / rooms | ✅ | ✅ | ⚠️ | ✅ |
| Gamification / XP / achievements | ✅ | ✅ | ⚠️ | — |
| AI (moderation, summaries, copilot) | ⚠️ | ⚠️ | ⏳ | — |
| Creator analytics / KPI dashboard | ✅ | ⚠️ | ⚠️ | ✅ |
| Courses / programs | ⚠️ | ⚠️ | ⚠️ | — |

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
