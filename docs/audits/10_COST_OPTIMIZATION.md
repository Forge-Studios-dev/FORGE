# Phase 10 — Cost Optimization Plan

**Audit date:** 2026-06-04 · **Reconciled:** 2026-06-05 (Wave 5 closure)  
**Primary audit lens**  
**Note:** Estimates are qualitative ranges — validate against Mux, Fly, Neon, Redis Cloud, AWS, Vercel invoices.

---

## Cost stack (typical production)

```mermaid
flowchart LR
  subgraph variable [Variable COGS]
    Mux[Mux minutes]
    S3[S3 egress]
  end
  subgraph fixed [Baseline infra]
    Fly[Fly API + Worker]
    Neon[Neon compute+storage]
    Redis[Redis memory tier]
    Vercel[Vercel builds+bandwidth]
  end
  subgraph ops [Ops tooling]
    Sentry[Sentry events]
    Grafana[Grafana Cloud]
  end
  Users[MAU] --> Mux
  Users --> Fly
  Users --> Neon
```

**Largest variable cost at scale:** Mux (transcode + delivery) → then Neon storage (analytics) → Redis tier → Fly compute.

---

## Optimization table

| Service | Current driver | Optimization | Est. savings | Risk |
|---------|----------------|--------------|--------------|------|
| **Mux** | VOD minutes stored, delivered; live hours | Idempotent webhooks; delete errored assets; tier archival policy; avoid duplicate ingest | **High (20–40% media)** if waste exists | Broken playback if assets deleted early |
| **Fly API** | 2GB × hours | `min_machines_running=1` shipped (F-1002) — see [FLY_SLO.md](../operations/FLY_SLO.md) | Baseline cost accepted for SLO | — |
| **Fly Worker** | Always-on 2GB for queues | Right-size VM; scale count on queue depth only | **Medium** if over-provisioned | Transcode backlog |
| **Neon** | Storage + compute; connection churn | JWT cache (F-501) + analytics retention worker (F-504) shipped; right-size pool | **Medium** at 100K+ | Stale cache if wrong |
| **Redis** | Memory for cache + BullMQ + sockets | TTL audit; connection limits; avoid duplicate large payloads in cache | **Medium** | Cache miss latency |
| **S3** | Storage + egress | Lifecycle for abandoned multipart; CDN only if egress high | **Low–medium** | — |
| **Vercel** | 2 projects, builds, bandwidth | Merge admin into web app (long-term) | **Low** unless high build churn | Admin isolation |
| **Firebase FCM** | Push volume | Batch notifications; disable for inactive devices | **Low** until high MAU | — |
| **Sentry** | Event volume | Sample rate 10–20%; disable default PII | **Low–medium** | Miss rare bugs |
| **OTel** | Trace storage | Sampling 1–5% or off until collector ready | **Low** | — |
| **FFmpeg in prod** | CPU if misconfigured | Enforced `VIDEO_TRANSCODE_PROVIDER=mux` | **Critical avoid** | Duplicate Mux + compute |

---

## Cost leaks to eliminate

| Leak | Severity | Action |
|------|----------|--------|
| FFmpeg worker in production | Critical | CI assert prod config; Fly secret audit |
| Duplicate Mux ingest on webhook retry | High | **Resolved** — `muxVodIngestJobId()` stable BullMQ job IDs |
| Analytics table unbounded | Medium | **Resolved** F-504 — `analytics-retention` worker |
| Fly cold start retries | Medium | **Resolved** F-1002 — `min_machines_running = 1` |
| Unused `express-rate-limit` dep | Low | **Resolved** F-301 — removed |

---

## Scenario modeling (qualitative)

| MAU | Dominant cost | First action |
|-----|---------------|--------------|
| &lt;10K | Fly + Neon baseline | `min_machines_running=1`; monitor Mux trial usage |
| 10K–100K | Mux delivery + Neon reads | F-501 JWT cache; F-502 batch entitlements |
| 100K–1M | Mux + Redis memory tier | CDN review; analytics archive; worker autoscale |
| 1M+ | Mux + multi-service ops | Dedicated search; read replicas; signed URL edge |

---

## Findings

### F-1001: Mux cost controls undocumented — **Resolved (Wave 1 + 5)**

| Field | Value |
|-------|-------|
| **Resolution** | [MUX_COST_OPS.md](../operations/MUX_COST_OPS.md) — monthly checklist, webhook idempotency via `muxVodIngestJobId()` |
| **Expected impact** | Primary COGS control |

### F-1002: Fly scale-to-zero vs SLO — **Resolved (Wave 2)**

| Field | Value |
|-------|-------|
| **Resolution** | `fly.toml` `min_machines_running = 1` — [FLY_SLO.md](../operations/FLY_SLO.md) |
| **Expected impact** | Predictable UX; modest baseline Fly cost |

### F-1003: Neon storage from analytics — **Resolved (Wave 3)**

| Field | Value |
|-------|-------|
| **Resolution** | `analytics-retention` BullMQ worker + daily scheduler (F-504) |
| **Expected impact** | Storage growth linear → sublinear |

---

## Estimated savings summary (if recommendations implemented)

| Category | Potential |
|----------|-----------|
| Media (Mux hygiene) | High |
| Database (JWT cache + analytics retention) | Medium |
| Compute (Fly right-sizing) | Low–medium |
| SaaS (Sentry sample) | Low |
| **Total** | **Medium overall** at MVP scale; **High** at 100K+ without JWT/analytics fixes |
