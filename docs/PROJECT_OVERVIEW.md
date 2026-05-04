# FORGE — Project overview

This document describes what the FORGE platform is, how the repository is organized, which technologies we use, and how the main pieces fit together. For step-by-step local setup, environment files, and HTTP API examples, see the root [README.md](../README.md).

---

## What is FORGE?

**FORGE** is a skill-first **live creator platform**. Creators share learning journeys, upload tutorial-style videos, go live to teach, and grow an audience around their expertise. The product spans **web**, **admin**, **mobile**, and a shared **backend** so the same capabilities can reach learners and operators wherever they are.

At a high level, the system supports:

- **Accounts and auth** — Sign up, sign in, sessions/tokens, and role-aware access (including admin-only operations).
- **Video on demand** — Uploads, processing (transcode to HLS), thumbnails, feeds, playback, likes, and comments.
- **Live streaming** — Start/end streams, live discovery, and Mux-oriented webhooks for streaming lifecycle.
- **Real-time updates** — WebSocket events for stream rooms, video-ready notifications, and live comment delivery.

---

## Repository and monorepo

The codebase is an **npm workspaces** monorepo (`forge-platform` at the root). Workspaces include the API, web app, admin app, and optional shared packages.

| Path | Name | Role |
|------|------|------|
| `apps/api` | `@forge/api` | NestJS HTTP API, queues, workers, WebSockets |
| `apps/web` | `@forge/web` | Next.js end-user web app |
| `apps/admin` | `@forge/admin` | Next.js internal admin UI |
| `apps/mobile` | `forge_mobile` | Flutter mobile client |
| `packages/shared-types` | `@forge/shared-types` | Shared TypeScript types across apps (`npm run build --workspace=@forge/shared-types`) |
| `infra/nginx` | — | Production-oriented reverse proxy configuration |
| `.github/workflows` | — | CI/CD (lint, test, build, deploy patterns as configured) |

Root scripts (from `package.json`) include `dev:api`, `dev:web`, `dev:admin`, plus workspace-wide `lint` and `test`.

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
| **Web** | TanStack React Query, NextAuth (beta), Axios, Zustand, HLS.js, Tailwind CSS, Socket.IO client |
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

1. **Clients** (web, admin, mobile) talk to the **NestJS API** over HTTPS (REST). The web app may use **NextAuth** for session-oriented flows where configured.
2. **Video uploads** typically use **presigned S3 URLs** so large files go straight to object storage; the API then registers metadata and enqueues processing.
3. **Workers** (BullMQ) pull jobs: download from S3, **FFmpeg** transcode to HLS, upload renditions and thumbnails, then update the database and notify clients.
4. **Live streams** integrate with **Mux**; webhooks inform the API when stream state changes.
5. **Socket.IO** pushes time-sensitive updates (e.g. video ready, stream started, comments in a room) without polling the full feed.

A detailed step-by-step of the video pipeline and event names is in [README.md](../README.md).

---

## Local development URLs

| Surface | Default URL |
|---------|-------------|
| Web | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| API docs | http://localhost:3001/api/docs |
| Admin | http://localhost:3002 |

Mobile runs via `flutter run` from `apps/mobile` on a device or emulator.

---

## Configuration and secrets (summary)

- **API**: Database, Redis, JWT secrets, AWS credentials, Mux keys, and related URLs are configured via environment variables (see `apps/api/.env.example` and `apps/api/.env.production.example`).
- **Web / Admin**: Public API base URL and auth-related variables (see each app’s `.env.example` and `.env.production.example`).
- **Docker Compose (prod file)**: Root variable substitution uses a repo-level `.env` (start from `compose.prod.env.example`); see the root README.

Without AWS or Mux, much of the stack still runs locally; upload and streaming features degrade or fail in predictable ways until credentials are provided.

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
