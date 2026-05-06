# FORGE — Project overview

This document describes what the FORGE platform is, how the repository is organized, which technologies we use, and how the main pieces fit together. For step-by-step local setup, environment files, and HTTP API examples, see the root [README.md](../README.md).

---

## What is FORGE?

**FORGE** is a skill-first **live creator platform**. Creators share learning journeys, upload tutorial-style videos, go live to teach, and grow an audience around their expertise. The product spans **web**, **admin**, **mobile**, and a shared **backend** so the same capabilities can reach learners and operators wherever they are.

At a high level, the repository contains code for:

- **Accounts and auth** — Email/password signup + login, JWT access + refresh, and role-aware access (including admin-only operations).
- **Creator access control (MVP)** — Creator requests and an approval workflow (pending/approved/rejected), enforced on creator-only operations like uploads and live streaming.
- **Permissions** — A code-defined permission model enforced by API guards and surfaced to clients so UIs can show “no access” states instead of hiding routes.
- **Video on demand** — Upload registration via **presigned S3 URLs**, feed APIs, likes/comments/follow, and a background processing pipeline (BullMQ + FFmpeg → HLS).
- **Playlists** — Basic playlist CRUD and the ability to add/remove videos.
- **Live streaming** — Create/end streams, list live streams, and a Mux webhook handler for streaming lifecycle.
- **Notifications (basic)** — DB-backed notifications for key events (creator approval, video ready, stream started).
- **Real-time events** — Socket.IO gateway and **web client integration** for events like `video:ready`, `comment:new`, and `stream:started` (see “Real-time” below).

---

## Repository and monorepo

The codebase is an **npm workspaces** monorepo (`forge-platform` at the root).

- The **Node/TypeScript** surfaces (API, web, admin, shared packages) are managed via npm workspaces.
- The **Flutter** mobile app lives under `apps/mobile`, but is **not** an npm workspace (it’s managed by Flutter tooling).

| Path | Name | Role |
|------|------|------|
| `apps/api` | `@forge/api` | NestJS HTTP API, queues, workers, WebSockets |
| `apps/web` | `@forge/web` | Next.js end-user web app |
| `apps/admin` | `@forge/admin` | Next.js internal admin UI |
| `apps/mobile` | `forge_mobile` | Flutter mobile client (separate toolchain) |
| `packages/shared-types` | `@forge/shared-types` | Shared TypeScript types across apps (`npm run build --workspace=@forge/shared-types`) |
| `infra/nginx` | — | Production-oriented reverse proxy configuration |
| `.github/workflows` | — | CI/CD (lint, test, build, deploy patterns as configured) |

Root scripts (from `package.json`) include `dev:api`, `dev:web`, `dev:admin`, plus workspace-wide `lint` and `test`. The repository also includes a dedicated **worker** container/process for BullMQ consumers (see “Jobs flow” below).

---

## Technology stack

### Platforms and languages

| Area | Technology |
|------|----------------|
| **Backend runtime** | Node.js 20+ |
| **Backend framework** | NestJS 10 (modular monolith) |
| **Web & admin** | Next.js 14 (App Router), React 18, TypeScript |
| **Mobile** | Flutter 3.19+, Dart SDK 3.3+ |

### Data, cache, and async work

| Concern | Technology |
|---------|------------|
| **Primary database** | PostgreSQL 16 |
| **ORM** | TypeORM |
| **Cache / coordination** | Redis 7 (via ioredis) |
| **Background jobs** | BullMQ |

### Media, storage, and live video

| Concern | Technology |
|---------|------------|
| **Object storage & CDN** | AWS S3, CloudFront |
| **Live streaming** | Mux (API + webhooks) |
| **Transcoding** | FFmpeg → HLS (multiple renditions), thumbnails |

### Real-time and API surface

| Concern | Technology |
|---------|------------|
| **Real-time channel** | Socket.IO (server in API; client in web) |
| **REST documentation** | Swagger (`/api/docs` on the API in dev) |

### Web and admin — notable libraries

| App | Notable dependencies |
|-----|----------------------|
| **Web** | TanStack React Query, Axios, Zustand, HLS.js, Tailwind CSS, Socket.IO client (and `next-auth` is present as a dependency, but not yet wired in the app code) |
| **Admin** | TanStack React Query & React Table, Recharts, Axios, Tailwind CSS |

### Mobile — notable libraries

Riverpod (with code generation tooling), `go_router`, Dio, secure storage, video playback (e.g. `video_player`, Chewie), cached images, Freezed/JSON serialization in the toolchain.

### API — notable libraries

JWT + Passport, Swagger, Throttler, Helmet, rate limiting, bcrypt, AWS SDK (S3 + presigning), Mux Node SDK, class-validator / class-transformer, BullMQ integration.

### Infrastructure and delivery

| Concern | Technology |
|---------|------------|
| **Local & prod containers** | Docker, Docker Compose (`docker-compose.yml`, `docker-compose.prod.yml`) |
| **CI/CD** | GitHub Actions |

---

## How requests and jobs flow (conceptual)

1. **Clients** (web, admin, mobile) talk to the **NestJS API** over HTTPS (REST).
2. **Video uploads** use **presigned S3 URLs** so large files go straight to object storage; the API then registers metadata and enqueues processing jobs.
3. **Workers** (BullMQ) process jobs: download from S3, **FFmpeg** transcode to HLS, upload renditions and thumbnails, then update the database.
   - In local/dev or containerized deployments, the worker is started as a **separate process** by setting `WORKER_ONLY=true` (see `apps/api/src/main.ts`) and running the `worker` service in `docker-compose.yml`.
4. **Live streams** integrate with **Mux**; webhooks inform the API when stream state changes.
5. **Socket.IO** pushes time-sensitive updates (e.g. `video:ready`, `comment:new`, `stream:started`) to reduce polling when clients subscribe.
6. **Notifications** are persisted in PostgreSQL for key events and can be retrieved via the API and displayed in clients.

For deeper setup and runtime details (Docker, env files, etc.), see [README.md](../README.md).

---

## Local development URLs

| Surface | Default URL |
|---------|-------------|
| Web | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| API docs | http://localhost:3001/api/docs (enabled when `NODE_ENV !== production`) |
| Admin | http://localhost:3002 |

Mobile runs via `flutter run` from `apps/mobile` on a device or emulator.

---

## Configuration and secrets (summary)

- **API**: Database, Redis, JWT secrets, AWS credentials, Mux keys, and related URLs are configured via environment variables (see `apps/api/.env.example`). The API loads `.env.local` and `.env` by default.
- **Web / Admin**: Public API base URL (see `apps/web/.env.example` and `apps/admin/.env.example`). The web app also supports `API_INTERNAL_URL` for server-side requests when running inside Docker.
- **Docker Compose (prod file)**: Root variable substitution uses a repo-level `.env` (start from `compose.prod.env.example`).

Without AWS or Mux, much of the stack still runs locally; upload and streaming features degrade or fail in predictable ways until credentials are provided.

---

## Real-time (Socket.IO) status

The API includes a Socket.IO gateway at the **namespace** `/events`:

- **Gateway**: `apps/api/src/gateway/events.gateway.ts`
- **Events emitted (server-side)**:
  - `video:ready` (on `video.ready`)
  - `stream:started` (on `stream.started`)
  - `comment:new` (on `comment.created`, emitted to `video:{videoId}` room)
- **Rooms**:
  - `user:{userId}` — for user-scoped events like `video:ready`
  - `video:{videoId}` — for `comment:new` (clients should join per watch page)
  - `stream:{streamId}` — for stream-scoped events (future live UI)
- **Client integration (web)**:
  - Socket client wrapper: `apps/web/src/lib/socket.ts`
  - Global listeners (toast UX): `apps/web/src/components/RealtimeToasts.tsx`
  - Watch page room-join for comments: `apps/web/src/components/Comments/CommentsPanel.tsx`

---

## MVP access control (creator approvals + permissions)

### Creator approvals

Creators are **not** automatically allowed to upload/go live. A user requests creator access, an admin reviews, and only then creator-only operations are permitted.

- **User fields** (TypeORM entity): `apps/api/src/modules/users/entities/user.entity.ts`
  - `role`: `user | creator | admin`
  - `creatorStatus`: `pending | approved | rejected`
  - `creatorRequestedAt`, `creatorReviewedAt`, `creatorReviewNote`
- **Request creator access**: `POST /users/me/request-creator`
- **Admin review APIs**:
  - `GET /admin/creators/pending`
  - `POST /admin/creators/:id/approve`
  - `POST /admin/creators/:id/reject`
- **Enforcement**:
  - Upload endpoints (`/videos/presigned-url`, `/videos`) and stream start/end (`/streams/start`, `/streams/:id/end`) require:
    - `user.isVerified === true` AND `user.creatorStatus === approved`

### Permissions

The API defines a small, code-defined permission set (role/status → permissions), enforced by a guard and also returned to clients in the auth response to support UI “no access” states.

- **Permission model**: `apps/api/src/common/auth/permissions.ts`
- **Decorator + guard**: `apps/api/src/common/decorators/permissions.decorator.ts`, `apps/api/src/common/guards/permissions.guard.ts`
- **Web helper + UX**: `apps/web/src/lib/permissions.ts`, plus pages like `apps/web/src/app/upload/page.tsx`

---

## Playlists (MVP)

- **API module**: `apps/api/src/modules/playlists`
- **Endpoints**:
  - `POST /playlists`
  - `GET /playlists/:id`
  - `POST /playlists/:id/videos`
  - `DELETE /playlists/:id/videos/:videoId`
  - `GET /users/:id/playlists`
- **Web pages**:
  - `apps/web/src/app/playlists/new`
  - `apps/web/src/app/playlists/[id]`

---

## Notifications (MVP)

Notifications are persisted in Postgres and created automatically for key events (approval, video processing completion, stream started).

- **API module**: `apps/api/src/modules/notifications`
- **Endpoints**:
  - `GET /notifications`
  - `POST /notifications/:id/read`
- **Web page**: `apps/web/src/app/notifications/page.tsx`

---

## Database migrations

The API is configured to run TypeORM migrations from `apps/api/src/database/migrations` (see `apps/api/src/database/data-source.ts`). Recent MVP migrations include creator approvals, playlists, and notifications.

---

## Evolution and scale (directional)

The README outlines a **scalability roadmap**: optional split toward microservices, Kafka-style event buses, Kubernetes, search (e.g. Elasticsearch), and richer recommendations. The current codebase is intentionally a **modular monolith** so teams can ship features first and extract boundaries later.

---

## Document map

| Document | Purpose |
|----------|---------|
| [README.md](../README.md) | Prerequisites, Docker, migrations/seeds, scripts, API cheat sheet, WebSocket events, deployment notes |
| **This file** | Product intent, architecture summary, tech inventory |

If this overview drifts from the repo (new apps, renames, or stack changes), update this file when you change the architecture or default ports.
