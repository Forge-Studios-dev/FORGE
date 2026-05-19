# FORGE – Live Creator Platform

A skill-first live creator platform where users share learning journeys, upload tutorial videos, go live to teach skills, and build an audience based on expertise.

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Flutter + Riverpod + go_router |
| Web | Next.js 14 (App Router, SSR) |
| Admin | Next.js 14 + Tailwind CSS |
| Backend | NestJS (modular monolith) |
| Database | PostgreSQL 16 + TypeORM |
| Cache / Queue | Redis 7 + BullMQ |
| Storage | AWS S3 + CloudFront |
| Live Streaming | Mux |
| Video Processing | FFmpeg (HLS 240p–1080p) |
| Real-time | Socket.IO |
| Containers | Docker + Docker Compose |
| CI/CD | GitHub Actions |

## Repository Layout

```
FORGE/
├── apps/
│   ├── api/          # NestJS backend (port 3001)
│   ├── web/          # Next.js user app (port 3000)
│   ├── admin/        # Next.js admin panel (port 3002)
│   └── mobile/       # Flutter mobile app
├── packages/
│   └── shared-types/ # Shared TypeScript types
├── infra/
│   └── nginx/        # Production nginx config
├── .github/
│   └── workflows/    # CI/CD pipelines
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

## Prerequisites

- **Node.js** ≥ 20 and **npm** ≥ 10
- **Docker** + **Docker Compose**
- **Flutter** ≥ 3.19 (for mobile development)
- **FFmpeg** (automatically included in Docker image)
- AWS account with S3 bucket and IAM credentials
- Mux account (https://mux.com)

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/forge.git
cd forge
```

### 2. Set up environment files

```bash
# API
cp apps/api/.env.example apps/api/.env

# Web
cp apps/web/.env.example apps/web/.env.local

# Admin
cp apps/admin/.env.example apps/admin/.env.local
```

Edit `apps/api/.env` with your AWS and Mux credentials. For local development without AWS/Mux, the app still runs (upload features will fail gracefully).

### 3. Start infrastructure (Postgres + Redis)

```bash
docker compose up postgres redis -d
```

Wait for services to be healthy:
```bash
docker compose ps
```

### 4. Install dependencies

```bash
npm install
```

### 5. Run database migrations + seed

```bash
# The API is configured with `synchronize: false` and `migrationsRun: true`,
# so schema migrations are applied automatically on API startup.
# Run seed to populate initial data (e.g. categories).
npm run seed --workspace=apps/api
```

### 6. Start all services in development mode

**Option A – Run individually (recommended for active development):**

```bash
# Terminal 1: API
npm run dev:api

# Terminal 2: Web
npm run dev:web

# Terminal 3: Admin
npm run dev:admin
```

**Option B – Run everything with Docker Compose:**

```bash
docker compose up --build
```

### 7. Access the apps

| Service | URL |
|---|---|
| API | http://localhost:3001/api/v1 |
| Swagger Docs | http://localhost:3001/api/docs |
| Web App | http://localhost:3000 |
| Admin Panel | http://localhost:3002 |

### 8. Flutter mobile app

```bash
cd apps/mobile
flutter pub get
flutter run
```

## API Overview

### Authentication

```http
POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

### Videos

```http
POST /api/v1/videos/presigned-url   # Get S3 upload URL
POST /api/v1/videos                 # Register video after upload
GET  /api/v1/videos/feed            # Paginated feed (cursor-based)
GET  /api/v1/videos/:id
DELETE /api/v1/videos/:id
```

### Engagement

```http
POST   /api/v1/videos/:id/like
DELETE /api/v1/videos/:id/like
POST   /api/v1/videos/:id/comments
GET    /api/v1/videos/:id/comments
POST   /api/v1/follow/:userId
DELETE /api/v1/follow/:userId
```

### Streaming

```http
POST /api/v1/streams/start
GET  /api/v1/streams/live
GET  /api/v1/streams/:id
POST /api/v1/streams/:id/end
POST /api/v1/streams/webhooks/mux
```

### Admin (requires admin role)

```http
GET   /api/v1/admin/stats
GET   /api/v1/admin/users
PATCH /api/v1/admin/users/:id
GET   /api/v1/admin/videos
PATCH /api/v1/admin/videos/:id
```

## Video Upload Flow

```
1. Client → POST /videos/presigned-url  → gets S3 signed URL
2. Client → PUT {signed-url}            → uploads raw video directly to S3
3. Client → POST /videos { s3Key, title, ... }
4. API    → adds job to BullMQ queue
5. Worker → downloads from S3
6. Worker → FFmpeg transcodes to HLS (240p/480p/720p/1080p)
7. Worker → generates thumbnail at 5% mark
8. Worker → uploads HLS segments + thumbnail to S3
9. Worker → updates video.status = 'ready', hlsUrl, thumbnailUrl
10. Worker → emits 'video.ready' event → WebSocket notifies client
```

## WebSocket Events (Socket.IO)

Connect to: `ws://localhost:3001/events`

| Event | Direction | Description |
|---|---|---|
| `join-stream` | Client → Server | Join a stream room |
| `leave-stream` | Client → Server | Leave a stream room |
| `video:ready` | Server → Client | Video processing complete |
| `stream:started` | Server → Broadcast | New live stream started |
| `comment:new` | Server → Room | New comment on video |

## Production Deployment

### Docker Compose (production file)

`docker-compose.prod.yml` expects a **root** `.env` file for Postgres and Redis credentials (variable substitution). Copy the template and edit values:

```bash
cp compose.prod.env.example .env
```

Create `apps/api/.env.production`, `apps/web/.env.production`, and `apps/admin/.env.production` from each app’s `.env.production.example` (these paths match `env_file` in the compose file).

### Environment Variables

Set production secrets in GitHub → Settings → Secrets:

- `EC2_HOST` – EC2 instance IP
- `EC2_USER` – SSH user (usually `ec2-user` or `ubuntu`)
- `EC2_SSH_KEY` – Private SSH key
- `NEXT_PUBLIC_API_URL` – Production API URL

### Deploy

Push to `main` branch triggers:
1. Lint + test
2. Docker build + push to GHCR
3. SSH deploy to EC2

For manual deploy:
```bash
docker compose -f docker-compose.prod.yml up -d
```

## Project documentation

| Document | Audience |
|----------|----------|
| **[docs/DEPLOYMENT_DEMO.md](docs/DEPLOYMENT_DEMO.md)** | Local + VPS + remote client demo setup |
| **[docs/DEPLOYMENT_VERCEL_FLY.md](docs/DEPLOYMENT_VERCEL_FLY.md)** | Vercel (web/admin) + Fly.io (API) + Neon + Upstash |
| **[docs/CLIENT_OVERVIEW.md](docs/CLIENT_OVERVIEW.md)** | Clients and stakeholders (executive summary) |
| **[docs/FORGE_PROJECT_MASTER.md](docs/FORGE_PROJECT_MASTER.md)** | Full product + technical specification |
| **[docs/README.md](docs/README.md)** | Documentation index |

Setup and API examples stay in this README. UI screen specs: [docs/ui-ux-ai-design-prompt.md](docs/ui-ux-ai-design-prompt.md).

## Scalability Roadmap

The codebase is designed to evolve to:

1. **Microservices** – Each NestJS module becomes its own service (extract by moving to separate repos/packages)
2. **Kafka** – Replace BullMQ with Kafka for event streaming at scale
3. **Kubernetes (EKS)** – Containerized services orchestrated with Helm charts
4. **Elasticsearch** – Add full-text search for videos, users, and skill tags
5. **AI Recommendations** – Feed personalization using watch history + skill tag embeddings

## Development Notes

- TypeORM **`synchronize` is always `false`** — schema changes go through migrations in `apps/api/src/database/migrations/` (applied on API startup via `migrationsRun: true`)
- Run `npm run seed --workspace=apps/api` after first migrate for sample categories
- The BullMQ worker runs in the same process as the API in development (via `WorkersModule`). In production, run it separately using the `worker` Docker service
- Mux webhook endpoint: configure in your Mux dashboard → `POST https://yourdomain.com/api/v1/streams/webhooks/mux`
