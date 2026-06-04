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
| Live | Mux |
| Engagement | Likes, comments, follows, playlists |
| Monetization (phase 1) | Mock memberships — no live payments |
| Operations | Admin moderation & analytics summary |

## Roles

Guest → user → creator (approved) · admin on separate admin app.

## Status (MVP)

| Area | API | Web | Mobile | Admin |
|------|:---:|:---:|:------:|:-----:|
| Auth | ✅ | ✅ | ✅ | ✅ |
| Feed / search | ✅ | ✅ | ✅ | — |
| VOD / live | ✅ | ⚠️ | ⚠️ | — |
| Memberships | ✅ | ✅ | — | — |

Detail: [FORGE_PROJECT_MASTER.md §13](./FORGE_PROJECT_MASTER.md#13-status-matrix)

## Stack

NestJS · Neon · Redis · Fly · Vercel · S3 · Mux

## Demo

Local: [GETTING_STARTED.md](./GETTING_STARTED.md) · Production: [DEPLOY.md](./DEPLOY.md)

---

*Sync §4 when [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) changes.*
