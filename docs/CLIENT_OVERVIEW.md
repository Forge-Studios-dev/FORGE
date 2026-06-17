# FORGE — Client Overview

**Audience:** Stakeholders · **Spec:** [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)

## Product

Skill-first platform: tutorial video, live teaching, expertise-based audiences. Surfaces: web, mobile, admin, one API.

## Goals

| Goal | Delivery |
|------|----------|
| Discovery | Categories, tags, search, feeds |
| Trusted creators | Admin approval before publish/live |
| Video | S3 upload → Mux HLS (default) |
| Live | Mux + stream chat |
| Engagement | Likes, comments, follows, playlists |
| Community | Creator channels (tier-gated) |
| Monetization (phase 1) | Mock memberships + partial Stripe (paid events, super chat) |
| Design | `@forge/design-system` + optional Stitch blueprints (`/blueprints`) |
| Operations | Admin moderation & analytics summary |

## Roles

Guest → user → creator (approved) · admin on separate admin app.

## Status (MVP)

| Area | API | Web | Mobile | Admin |
|------|:---:|:---:|:------:|:-----:|
| Auth | ✅ | ✅ | ✅ | ✅ |
| Feed / search | ✅ | ✅ | ✅ | — |
| VOD / live | ✅ | ✅ | ✅ | — |
| Memberships | ✅ | ✅ | — | — |

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
