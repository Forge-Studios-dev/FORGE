# Recommended external tools, packages, repos & services for FORGE

This file is a **catalog of options**. Use the **FORGE status** table below to see what the repo already uses versus what is deferred or optional.

- Phased platform bets (search, vectors, warehouse): [phase4-platform-evaluation.md](./phase4-platform-evaluation.md)
- Production go-live checks: [FORGE_PROJECT_MASTER.md §25](./FORGE_PROJECT_MASTER.md#25-production-readiness)
- Documentation index: [README.md](./README.md)

## FORGE status (living)

| Item / area | Status in repo | Notes |
|-------------|----------------|-------|
| **nestjs-bullmq**, **nestjs-throttler** | In use | [apps/api/package.json](../apps/api/package.json), [app.module.ts](../apps/api/src/app.module.ts) |
| **nestjs-pino** | In use | Structured HTTP logging via `nestjs-pino` ([app.module.ts](../apps/api/src/app.module.ts)); Nest `Logger` from `nestjs-pino` in [main.ts](../apps/api/src/main.ts) |
| **nestjs-cls** | In use | Request CLS + `correlationId` / optional `userId` ([forge-cls.setup.ts](../apps/api/src/common/cls/forge-cls.setup.ts), [cls-user.interceptor.ts](../apps/api/src/common/interceptors/cls-user.interceptor.ts), [app.module.ts](../apps/api/src/app.module.ts)) |
| **nestjs-query** | Not adopted | CRUD helpers; add only if generic list APIs multiply |
| **Fastify** | Deferred | Express is the platform; switching is a large migration |
| **Zod / ts-rest** | Partial / optional | DTOs use `class-validator`; Zod can be introduced per-module for new surfaces |
| **PgBouncer** | Optional (Docker) | [docker-compose.yml](../docker-compose.yml) `pgbouncer` service; point `DATABASE_URL` at port 6432 when enabled |
| **TypeORM + Postgres FTS** | In use | Search + migrations under [apps/api/src/database/migrations](../apps/api/src/database/migrations) |
| **Prisma / Drizzle / Kysely** | Deferred | Revisit only with strong ORM migration drivers |
| **ClickHouse / Druid** | Deferred | See [phase4-platform-evaluation.md](./phase4-platform-evaluation.md) |
| **Vectors / ML stack** | Deferred | Same as phase4 |
| **Meilisearch / ES / Algolia** | Deferred | Postgres FTS first; see phase4 |
| **Mux, FFmpeg** | In use | Upload pipeline, workers |
| **Socket.IO Redis adapter** | In use | [events.gateway.ts](../apps/api/src/gateway/events.gateway.ts) |
| **NATS / Ably / Pusher** | Not planned | Unless multi-region realtime exceeds Redis adapter |
| **Redis (ioredis)** | In use | Cache, BullMQ, Socket adapter |
| **RedisJSON / Redis Search / Upstash** | Optional | Add when product needs justify |
| **TanStack Query, Zustand (web)** | In use | [apps/web/package.json](../apps/web/package.json) |
| **Riverpod (mobile)** | In use | [apps/mobile/pubspec.yaml](../apps/mobile/pubspec.yaml) |
| **BullMQ** | In use | Video processing + DLQ pattern |
| **Kafka / Temporal / RabbitMQ** | Deferred | See phase4 |
| **Prometheus `/metrics`** | Optional | Env `METRICS_ENABLED=true`; excluded from `/api/v1` prefix in [main.ts](../apps/api/src/main.ts) |
| **Sentry** | Optional | Env `SENTRY_DSN`; init in [main.ts](../apps/api/src/main.ts) |
| **Grafana / Datadog / New Relic** | Ops choice | Wire outside the repo or add agents later |
| **OpenTelemetry** | Optional | Add when tracing SLOs require it; checklist mentions APM |
| **Docker, GitHub Actions** | In use | [docker-compose.yml](../docker-compose.yml), [.github/workflows](../.github/workflows) |
| **Kubernetes / Helm / Argo / Terraform** | Deferred | Scale when deployment model requires it |
| **PostHog / Mixpanel / warehouse** | Deferred | See phase4 |

---

## Original catalog (reference)

1. Backend & API Architecture
NestJS Enhancements
NestJS Official
nestjs-cls (request context handling)
nestjs-pino (high-performance logging)
nestjs-bullmq
nestjs-throttler
nestjs-query
API Performance
Fastify
Zod Validation
ts-rest
2. Database & ORM Optimization
PostgreSQL Tools
PgBouncer
TimescaleDB
PostgreSQL Official
ORM/Query Optimization
Prisma
Prisma Accelerate
Prisma Optimize
Drizzle ORM
Kysely Query Builder
Analytics DB
ClickHouse
Apache Druid
3. Recommendation & AI Systems
Vector Databases
Qdrant
Weaviate
Pinecone
ML & Recommendation
TensorFlow
PyTorch
Apache Mahout
LightFM Recommendation Engine
AI APIs
OpenAI API
Anthropic API
Cohere Embeddings
4. Search Systems
Search Engines
Elasticsearch
OpenSearch
Meilisearch
Typesense
Algolia
5. Streaming & Video Infrastructure
Streaming Platforms
Mux
AWS IVS
Cloudflare Stream
Agora
LiveKit
Video Servers
SRS Media Server
NGINX RTMP Module
OvenMediaEngine
Video Processing
FFmpeg
Bento4
Shaka Packager
6. Realtime Infrastructure
WebSocket Scaling
Socket.IO Redis Adapter
NATS
Ably
Pusher
Supabase Realtime
7. Redis & Caching
Redis Stack
Redis Official
RedisJSON
Redis Search
Upstash Redis
CDN & Edge
Cloudflare CDN
Fastly
Bunny CDN
8. Queue & Event Processing
Queue Systems
BullMQ
Apache Kafka
Redpanda
RabbitMQ
Temporal.io
9. Observability & Monitoring
Monitoring
Grafana
Prometheus
Datadog
New Relic
Error Tracking
Sentry
OpenTelemetry
Logging
Pino Logger
Winston Logger
10. Security & Abuse Prevention
Security Platforms
Cloudflare WAF
AWS WAF
Arcjet
Bot & Spam Prevention
hCaptcha
reCAPTCHA Enterprise
Authentication
Clerk
Auth.js
Keycloak
11. Frontend & Mobile Optimization
Web
TanStack Query
Zustand
SWR
React Virtualized
Flutter
Riverpod
Bloc
Hive DB
Isar Database
12. DevOps & Infrastructure
Container & Orchestration
Docker
Kubernetes
Helm Charts
CI/CD
GitHub Actions
ArgoCD
Terraform
Reverse Proxy
Traefik
Envoy Proxy
NGINX
13. Analytics & Product Intelligence
Product Analytics
PostHog
Mixpanel
Amplitude
Data Warehouse
BigQuery
Snowflake
14. Highly Valuable Open Source Repositories to Study
Creator Platform References
Owncast
PeerTube
Supabase
Streaming Examples
LiveKit Examples
Mux Examples
Scalable Architecture References
Netflix Dispatch
MedusaJS Architecture
Cal.com
