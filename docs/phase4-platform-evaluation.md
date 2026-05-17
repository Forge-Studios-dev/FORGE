# Phase 4 — Platform evaluation (scale & vendor decisions)

**Audience:** Engineering leads, architects, and stakeholders planning growth beyond MVP.  
**Prerequisite:** Baseline metrics exist — API p95 latency, feed/search latency, queue depth, error rate, database CPU.  
**Related:** [FORGE_PROJECT_MASTER.md §26](./FORGE_PROJECT_MASTER.md#26-growth-and-scale-roadmap) · [Recommended_Things.md](./Recommended_Things.md)

---

## Decision principle

**Promote a new vendor or service only when optimizations on the current stack (PostgreSQL, Redis, BullMQ, S3, FFmpeg) no longer meet service-level objectives (SLOs).**

Before adopting external systems:

1. Measure the bottleneck with production-like load.  
2. Tune indexes, caching, pool sizes, and worker concurrency.  
3. Document before/after metrics in a runbook.  
4. Compare operational cost (hosting, licensing, on-call complexity).

---

## 1. Dedicated search

### When to consider

- Full-text ranking or autocomplete p95 exceeds target (e.g. **> 200 ms**) at expected query volume.  
- Product requires typo tolerance, faceted filters, or relevance tuning beyond Postgres FTS.  
- Search traffic competes with transactional writes on the primary database.

### Candidates

| Option | Strengths | Trade-offs |
|--------|-----------|------------|
| **Meilisearch** | Simple ops, fast typo-tolerant search | Another service to run and sync |
| **OpenSearch / Elasticsearch** | Scale, analytics, complex queries | Higher ops burden |
| **Algolia** | Managed, excellent DX | Cost at scale; vendor lock-in |

### Exit criteria (before committing)

- [ ] Index lag acceptable for product (how stale can results be?)  
- [ ] Cost per 1M queries modeled for 12-month growth  
- [ ] High availability and backup story documented  
- [ ] PII handling in index reviewed (usernames, emails excluded as needed)

### Current FORGE approach

Postgres `search_vector` + ILIKE fallback in `SearchModule`. Sufficient for MVP and early growth.

---

## 2. Vector recommendations

### When to consider

- Rule-based `forYou` feed and watch/follow signals plateau on engagement KPIs.  
- Sufficient event volume for training or two-tower cold start (views, completion, dwell).  
- Product requires semantic similarity (“more like this skill”) beyond tags and categories.

### Candidates

| Option | Strengths | Trade-offs |
|--------|-----------|------------|
| **Qdrant** | Self-hosted vectors, good performance | Ops + embedding pipeline |
| **Redis Stack** | Vectors alongside existing Redis | Feature limits vs dedicated DB |
| **Pinecone** | Managed, fast to prototype | Cost; external dependency |

### Prerequisites

- Stable event schema: `watch`, `complete`, `dwell`, `like`, `follow`.  
- Batch or streaming feature pipeline (not ad-hoc SQL).  
- Offline evaluation framework (precision@k, engagement lift).

### Current FORGE approach

`FeedService` — `latest`, `popular`, rule-based `forYou` with Redis cache. No vector store.

---

## 3. Analytics warehouse

### When to consider

- `analytics_events` table growth slows OLTP queries or backups.  
- Product and ops need complex aggregations (funnels, cohorts, retention) across months of data.  
- Admin dashboard queries exceed acceptable latency on Postgres.

### Candidates

| Option | Strengths | Trade-offs |
|--------|-----------|------------|
| **ClickHouse** (self-host) | Fast aggregates, cost-effective at volume | New stack to operate |
| **BigQuery / Snowflake** | Managed warehouse, SQL familiarity | Egress and query cost |
| **PostHog / Mixpanel** | Product analytics UX out of the box | SaaS cost; data residency |

### Recommended pattern

- **Postgres** remains source of truth for transactions.  
- **Append-only export** from API or CDC into warehouse.  
- Do not run heavy BI queries against production OLTP.

### Current FORGE approach

`analytics_events` table + `GET /admin/analytics/summary` (7-day aggregates).

---

## 4. Transcoding scale-out

### When to consider

- BullMQ `video-processing` queue latency dominates user-visible upload time.  
- Worker CPU is saturated; horizontal scaling of FFmpeg workers is insufficient.  
- Need GPU encoding, broadcast-grade outputs, or SLA-backed processing.

### Candidates

| Option | Strengths | Trade-offs |
|--------|-----------|------------|
| **AWS MediaConvert** | Managed, scales with demand | Per-minute cost; AWS coupling |
| **Distributed FFmpeg workers** | Control, same pipeline | Fleet management |
| **GPU nodes** | Faster encode for high volume | CapEx / complexity |
| **Mux advanced processing** | Unified with live stack | Vendor consolidation vs cost |

### Current FORGE approach

BullMQ worker with FFmpeg → HLS (240p–1080p) + DLQ `video-processing-dlq`.

---

## 5. CDN and object storage

### When to consider

- S3 egress or CloudFront cost is a top-line budget item.  
- Need geographic expansion beyond current CDN footprint.  
- Cold archive policy required for old masters or failed uploads.

### Candidates

| Option | Use case |
|--------|----------|
| **S3 Intelligent-Tiering** | Automatic cost optimization for infrequent access |
| **Cloudflare R2 / Backblaze B2** | Lower egress if origin pattern fits |
| **Additional CDN** (Cloudflare, Fastly) | In front of or beside CloudFront for specific regions |

### Current FORGE approach

S3 presigned upload + CloudFront for HLS and thumbnails.

---

## 6. Event bus (optional Phase 4+)

### When to consider

- Extracting modules into separate services (auth, content, notifications).  
- Need durable event replay and multiple consumers per domain event.  
- BullMQ job volume or coupling becomes a maintenance risk.

### Candidates

Kafka, Redpanda, AWS EventBridge — only after modular boundaries are clear.

### Current FORGE approach

In-process `@nestjs/event-emitter` + BullMQ for video jobs.

---

## Decision log template

When adopting any Phase 4 capability, record:

| Field | Example |
|-------|---------|
| **Date** | 2026-Q3 |
| **Capability** | Dedicated search |
| **Trigger metric** | Search p95 = 340 ms at 50 QPS |
| **Options evaluated** | Meilisearch vs OpenSearch |
| **Chosen** | Meilisearch |
| **Before / after** | p95 340 ms → 45 ms |
| **Monthly cost** | $X infra + $Y engineering |
| **Owner** | Platform team |

---

*Parent document: [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md) · Index: [README.md](./README.md)*
