# Platform Research — Infrastructure, Scalability & Reliability

> **Partially superseded, 2026-08-13.** Three items this doc lists as gaps are fixed as of
> 2026-08-11 and confirmed live by independent re-audit: cache-stampede protection
> (`common/redis/cache-stampede.util.ts`), synthetic monitoring
> (`.github/workflows/synthetic-monitoring.yml`), and distributed tracing (code was already
> complete, just not activated — see `OBSERVABILITY.md`). Branch protection and GitHub Action
> pinning, listed elsewhere as open, are also confirmed live-enabled. Everything else here —
> compute right-sizing, AWS static-key rotation, multi-region/messaging-scale correctly deferred —
> was independently re-confirmed current.
>
> Companion research doc, not a spec of record. Existing docs (`docs/DEPLOY.md`, `docs/CI_CD.md`, `docs/OBSERVABILITY.md`, `docs/operations/*`, `docs/phases/18-infrastructure/`, `docs/phases/19-performance/`, `docs/audits/*`) remain the operational reference; this file is the gap analysis behind a future revision of them.

## 1. Overview & scope

This domain covers the platform-wide, cross-feature infrastructure that every other domain (upload/media, discovery, engagement, monetization, moderation) runs on top of:

1. **High-traffic / high-concurrency architecture** — how the API tier, real-time (Socket.IO) tier, and background-job tier scale horizontally.
2. **Storage architecture** — object storage (S3), CDN (CloudFront/Mux CDN), Redis caching layers, database replication/pooling, and (lack of) geo distribution.
3. **Database architecture** — Postgres (Neon) schema/pooling/indexing posture, connection-limit risk, migration strategy.
4. **Backup / disaster recovery** — RPO/RTO targets, PITR, restore drills, rollback mechanics for app + schema.
5. **Observability / monitoring** — logging, metrics, tracing, alerting, health checks.
6. **Cost optimization** — idle-load cost drivers, FinOps posture, known unknowns.
7. **Deployment / CI-CD strategy** — branch → PR → CI → release pipeline, rollback automation, environment/secret management.
8. **Failure and recovery scenarios** — what breaks when a dependency (DB, Redis, worker, third-party vendor) goes down, and what the documented/undocumented recovery path is.

Out of scope here (covered by other domain docs): upload/transcode pipeline internals (`upload-media-pipeline.md`), recommendation/search ranking (`discovery-search-recommendations.md`), moderation queues (`moderation-safety-admin.md`), monetization/billing internals (`creator-monetization-analytics.md`). This doc treats those as *tenants* of the infrastructure it describes.

## 2. YouTube reference model

YouTube's own infrastructure is Google-internal and not publicly documented as an implementable spec; the description below synthesizes publicly known architecture patterns (Google engineering blog posts, conference talks, and widely-corroborated system-design writeups) at a level of detail useful for a much smaller platform to imitate the *shape* of, not the literal scale.

### 2.1 Storage & CDN
- **Object storage**: raw uploads and transcoded renditions live in a distributed, erasure-coded blob store (Google's Colossus) — not simple triple-replication; parity chunks allow reconstruction after multiple node failures without 2x storage overhead. For FORGE's scale, the practical analog is S3 with versioning + cross-region replication + lifecycle rules, not erasure coding.
- **CDN**: a global edge network (thousands of PoPs) with a tiered cache hierarchy — hot/viral content pinned on edge SSDs (sub-50ms, ~80% of traffic served from edge), long-tail content pulled from regional shield caches, coldest content from origin. Cache invalidation on unpublish/delete/visibility-change is a first-class flow, not an afterthought.
- **Geo distribution**: every critical service runs in 3+ regions; failover is via Anycast DNS within seconds of a full datacenter failure. Media is replicated close to viewers; metadata/control-plane writes are still funneled to a small number of authoritative regions with async replication to read replicas elsewhere.

### 2.2 Database & caching
- Relational data (accounts, subscriptions, billing) lives on horizontally-sharded MySQL (via Vitess) — sharded by user_id/video_id hash, with live resharding without downtime as a hard requirement at their scale.
- High-volume, loosely-structured data (view events, watch history, video metadata at index scale) lives in wide-column stores (Bigtable) rather than the relational tier.
- Caching is multi-layer: CDN edge (content bytes) → application-tier cache (feed/recommendation results, hot metadata) → DB read replicas. Cache stampede protection (request coalescing, jittered TTLs) is standard at this scale.
- Read replicas are geographically distributed; writes go to a primary (or a sharded set of primaries) with bounded replication lag surfaced to the application so it can decide read-your-writes consistency per feature (e.g., a comment you just posted must show up for you immediately; a view count does not need to be exact in real time).

### 2.3 High concurrency / real-time
- Stateless request-serving tier behind a global load balancer; sessions are never sticky to a single backend.
- Real-time fan-out (live chat, live view counts, notifications) uses pub/sub infrastructure that scales independently of the request tier, with backpressure and sampling under extreme load (e.g., view counters on mega-popular livestreams are approximate/rate-limited, not exact-per-event).
- Background/async work (transcoding, notification dispatch, analytics rollups, recommendation index updates) is fully decoupled from user-facing request latency via durable queues; queue consumers scale independently and are designed for at-least-once delivery with idempotent processing.

### 2.4 Backup / disaster recovery
- Continuous, automated backups with point-in-time recovery measured in minutes of RPO for critical data stores.
- Documented, drilled runbooks for regional failover — not just backup existence but proven restore-and-serve-traffic procedures, tested on a schedule (not only after an incident).
- Blast-radius isolation: a failure in one region, one service, or one data store degrades a bounded slice of functionality (e.g., uploads pause but playback of existing content continues) rather than a full outage.

### 2.5 Observability
- Centralized structured logging, distributed tracing across every service hop (upload → transcode → CDN → playback), and SLO-based alerting (error budgets, not just static thresholds).
- Synthetic monitoring / canary traffic continuously exercises critical user journeys (watch, upload, search) from multiple geographies, independent of real user traffic, to catch regressions before they show up in user-facing metrics.

### 2.6 Deployment / release engineering
- Progressive rollout (canary → percentage ramp → full) for both the serving tier and the recommendation/ranking models, with automatic rollback on regression signals (error rate, latency, engagement metrics).
- Feature flags decouple deploy from release; most changes ship dark and are ramped independently of the deploy event.

### 2.7 Failure/edge cases handled explicitly
- Full-region outage: traffic fails over to another region within seconds; in-flight uploads/transcodes resume rather than restart from zero.
- Storage node failure: erasure coding reconstructs data without operator intervention; no user-visible impact.
- Cache layer failure: origin absorbs the miss traffic behind rate limiting/circuit breakers rather than falling over from a thundering herd.
- Vendor/third-party dependency degradation (payment processor, ad server) degrades gracefully — content still plays even if a non-critical subsystem is down.
- Hot/viral content ("thundering herd" on a single video): edge caching + request coalescing prevent origin overload; view-count and live-chat systems degrade to approximate/sampled rather than falling over.

### 2.8 Scalability considerations
- Every tier (serving, storage, transcode, real-time fan-out, background jobs) scales independently — no single choke point ties, e.g., upload volume to playback capacity.
- Sharding and replica topology are designed for online resharding/rebalancing as traffic grows, not a fixed-capacity assumption baked in at launch.
- Cost and capacity planning distinguish "always-on baseline" from "elastic peak" — most of the fleet auto-scales; a minimal warm baseline handles the always-on portion (auth, low-latency reads).

## 3. Secondary-platform notes

- **Twitch**: real-time-first infra — the hardest scaling problem is concurrent live viewers on a single stream (chat fan-out, viewer count, low-latency HLS), not upload throughput. Twitch's chat infrastructure (IRC-derived, heavily sharded pub/sub, explicit slow-mode/backpressure under raid/hype-train load) is a better reference than YouTube's for FORGE's Socket.IO gateway once live-stream concurrency becomes a real load pattern — FORGE's current single-worker, single-region, `--ha=false` posture (see §4) is closer to a hobby project than either platform's live infra.
- **Vimeo**: much smaller scale, but publishes clearer operational guarantees (explicit SLA tiers, documented storage regions per plan) — a useful pattern for FORGE to make its *actual* current guarantees (single-region Fly `bom`, no multi-region failover, RPO ≤24h without PITR) explicit to stakeholders rather than implied.
- **Cloudflare Stream / Mux** (FORGE's own vendor): since FORGE already delegates VOD transcode + CDN delivery to Mux for the default path, FORGE's "storage architecture" is partly outsourced already — worth explicitly documenting which reliability properties (geo-replication, CDN edge caching, erasure coding) FORGE inherits for free via Mux vs. which ones FORGE is fully responsible for on the S3/FFmpeg fallback path and the non-video data plane (Postgres/Redis).

## 4. Current FORGE state (grounded in code + existing docs)

Sources checked: `docs/DEPLOY.md`, `docs/CI_CD.md`, `docs/OBSERVABILITY.md`, `docs/operations/{FLY_SLO,REDIS_CONNECTIONS,DISASTER_RECOVERY,LOAD_TEST_RUNBOOK,MUX_COST_OPS,PRODUCTION_CHECKLIST,MIGRATION_ROLLBACK,STAGING,AWS_CREDENTIAL_ROTATION}.md`, `docs/phases/18-infrastructure/*`, `docs/phases/19-performance/*`, `docs/audits/{INFRA_AUDIT_2026-07-29,FRESH_AUDIT_2026-07-26_DEVOPS_AWS,COST_AUDIT_2026-07-26,INFRASTRUCTURE_COST_AUDIT_2026-06,NEON_COST}.md`; code in `apps/api/src/health.controller.ts`, `apps/api/src/config/bull-redis.util.ts`, `apps/api/src/database/parse-database-config.ts`, `apps/api/src/common/redis/{redis-safe,redis-tls}.util.ts`, `apps/api/src/gateway/events.gateway.ts`, `apps/api/src/modules/communities/community-storage.service.ts`, `fly.toml`, `fly.worker.toml`, `.github/workflows/{ci,release}.yml`.

**Deployment topology**: Vercel (web/admin, stateless, Vercel-managed HA) · Fly.io API (`forge-studios-api`, 2 machines, `bom` region, `min_machines_running=2`, `auto_stop_machines=false` for zero-downtime rolling deploys) · Fly.io worker (`forge-studios-worker`, **1 machine**, `--ha=false`, accepted SPOF per `FLY_SLO.md`) · Neon Postgres (pooled connection, pool max 5 for Neon vs 20 for local/direct, idle timeout tuned to 120s to reduce `CREATE EXTENSION` reconnect churn) · Redis Cloud (dual-client: ioredis for BullMQ/cache, node-redis for Socket.IO adapter — `~12-20` connections per API machine, `20+` on the worker).

**Horizontal scaling model** (`DEPLOY.md`): API is stateless (JWT + Redis refresh store, no sticky sessions), Socket.IO uses `@socket.io/redis-adapter` for cross-replica fan-out, BullMQ queues are Redis-backed so worker replicas can scale independently, DB access goes through Neon's pooled URL. `fly scale count N` is the documented lever for both API and worker.

**Single-region only**: everything runs in Fly `bom` (Mumbai) with no secondary region and no documented failover procedure if `bom` itself has an outage — `FLY_SLO.md` explicitly warns against a mismatched `--primary-region` because `min_machines_running` only protects the primary region. There is no CDN/geo-distribution story for anything other than Mux-hosted video bytes (which get Mux's global CDN "for free") — API responses, Redis, and Postgres are all single-region with no edge caching layer for API responses.

**Database**: single Neon Postgres project, pooled connection required in production (enforced by `validateNeonPoolerUrlForProduction` throwing if a direct/unpooled URL reaches production), pool max hardcoded to 5 for Neon (`parseDatabaseConfig`). DB is small (~40MB per the 2026-07-29 infra audit) — no sharding, no read replicas, no documented plan for what happens when Neon's connection or CU-hour ceiling is approached under real growth. `docs/operations/NEON_COST.md` / `INFRASTRUCTURE_COST_AUDIT_2026-06.md` track cost but the domain has no capacity-planning doc translating MAU targets → expected connection/CU usage.

**Caching**: Redis is used for feed cache, video-detail cache (`search:v2`), entitlement/subscription/access caches (60-300s TTLs per `REDIS_CONNECTIONS.md`), JWT user cache, and pending view-count counters. No documented cache-stampede protection (jittered TTL, request coalescing/single-flight) for hot keys — a viral video's cache expiry could cause a thundering-herd re-read against Neon, and nothing in the reviewed code guards against it explicitly.

**Backup / DR** (`DISASTER_RECOVERY.md`): documented and — unusually for a project this size — actually *drilled*: a quarterly Neon PITR branch-restore drill was executed 2026-07-22 with real row-count verification, RTO <1 min vs a ≤4h target. RPO target is ≤24h without PITR / minutes with PITR enabled; Neon's PITR retention is 24h. Rollback mechanics: app-level rollback is `fly releases rollback` / Vercel promote-previous, but the **automatic** rollback added to `release.yml` bypasses `fly releases rollback` and instead redeploys the previous image directly via `flyctl deploy --image <prev>` — this reverts the app image only, never a completed migration. There is no automated schema-rollback path; `npm run migration:revert` is manual and operator-triggered. S3 media has no documented restore-from-version runbook beyond "enable versioning" (per `MEDIA.md`/`DISASTER_RECOVERY.md` — restore is a bullet point, not a drilled procedure like the Neon one).

**Observability** (`OBSERVABILITY.md`): nestjs-pino structured logging with correlation IDs, Prometheus `/metrics` (fails closed in production without a bearer token), BullMQ queue-depth gauges + 2 documented alert rules (Mux VOD backlog, analytics-ingest backlog), Sentry (API + web/admin) with PII off by default, optional OpenTelemetry (only if `OTEL_EXPORTER_OTLP_ENDPOINT` set — appears unconfigured in production per the infra audit, meaning **no distributed tracing across the upload → transcode → webhook → publish flow today**), health endpoints split into cheap liveness (`/health/live`, process-only) and deep readiness (`/health/ready`, DB+Redis+queue depth, throttled). No synthetic/canary monitoring of critical user journeys (watch, upload, search) independent of real traffic — smoke tests run only at deploy time, not continuously.

**CI/CD** (`CI_CD.md`, confirmed by `FRESH_AUDIT_2026-07-26_DEVOPS_AWS.md`): GitHub Actions `ci.yml` (lint/build/test, path-filtered) → `release.yml` (deploy API → worker → web/admin, each with automatic previous-image rollback on failure). Genuinely above-average for the team size: fail-closed required-secret audit, post-deploy smoke + metrics-scrape verification, worker force-start to reset Fly's exhausted-retry counter. **But**: as of the 2026-07-26 audit, `main` had **zero branch protection** in GitHub despite `forge-ship.md` and `CI_CD.md` itself describing PR-gated merges as the safety model — i.e., the documented governance model was not technically enforced (Critical finding C-1, status at time of that audit). Third-party GitHub Actions include at least one `@master`-pinned (not even tag-pinned) dependency (`superfly/flyctl-actions/setup-flyctl@master`) holding `FLY_API_TOKEN`/`VERCEL_TOKEN` in privileged deploy jobs. Static, unrotated AWS IAM keys for S3 access with no rotation automation, despite an existing OIDC pattern proven for GCP in the same `scripts/` directory. **This audit did not re-verify whether C-1/H-1/H-2 have since been closed — flag as open questions below.**

**Cost posture** (`INFRA_AUDIT_2026-07-29.md`): fixed compute floor of ~6GB RAM / 6 shared vCPUs always-on (2 API + 1 worker, all `shared-cpu-2x:2048MB`) regardless of traffic — an explicit HA-over-cost tradeoff. Prior FinOps root causes (Mux live-sync polling interval, Neon reconnect/`CREATE EXTENSION` churn) were identified and fixed in a prior wave. Dollar-denominated cost visibility (Neon CU-hours, Redis `INFO`, Mux minutes, AWS Cost Explorer, Vercel build minutes) was explicitly blocked on missing credentials at the time of that audit — FinOps has a design (docs exist) but no live confirmed numbers as of the last read.

**Product-framing tension** (see forge-youtube-replica.md mandate): none of the infra docs in this domain reference courses/cohorts/mentorship/channel-points at all — the infra layer (Fly/Vercel/Neon/Redis/S3/Mux, CI/CD, observability) is generic web-app infrastructure that is equally valid whether FORGE is a "skill-first creator platform" (per `FORGE_PROJECT_MASTER.md` executive summary) or a strict YouTube replica (per `forge-youtube-replica.md`). This domain has **no direct conflict** with the product-framing tension — infra doesn't encode product semantics — but two adjacent points are worth flagging: (1) a strict YouTube-replica trajectory would put far more relative weight on video-serving scale (CDN geo-distribution, view-count fan-out at viral scale, live-stream concurrency) than on the current "MVP single-region, single-worker" posture, since YouTube-parity implies YouTube-scale failure modes are in-scope to plan for even if not yet built; (2) the "communities"/"channel points" surfaces do add their own storage/queue load (see `CommunityStorageService`, community moderation queue) that a leaner YouTube-parity cut might not need — infra capacity planning should be done against whatever the resolved product scope turns out to be, not against the current superset.

## 5. Gap analysis

| Gap | Severity | Current state | Target state | Recommendation |
|---|---|---|---|---|
| Single region, no failover | High | Everything in Fly `bom`; no secondary region; `FLY_SLO.md` warns a mismatched primary-region setting breaks HA guarantees | Documented failover plan; at minimum, a cold-standby region runbook | Write a region-failure runbook (even if manual/cold-standby at current scale); do not silently accept "single region" as permanent without a documented decision |
| Worker SPOF (`--ha=false`) | Medium (accepted, documented) | 1 worker machine; BullMQ jobs durable in Redis but processing halts if the machine is down beyond retry budget | 2 worker machines once idempotency is re-verified, per the escalation trigger already defined in `FLY_SLO.md` | Track the documented escalation trigger (sustained queue-depth alert >30min, or a worker path becoming user-facing) as a real monitored condition, not just prose |
| No cache-stampede protection | Medium | Feed/video-detail/search caches have TTLs but no evidence of request coalescing or jittered expiry | Single-flight re-fetch or jittered TTL on hot keys (video detail, feed pages) | Add a small single-flight wrapper around the Redis-miss path for `search:v2` and video-detail cache; cheap, high-leverage for viral-content thundering herd |
| No distributed tracing in production | Medium | OpenTelemetry is opt-in and appears unconfigured in prod (`OTEL_EXPORTER_OTLP_ENDPOINT` unset) | End-to-end trace across upload → transcode webhook → publish, and API → DB/Redis | Turn on OTel against a low-cost backend (Grafana Tempo is already mentioned as compatible) for at least the upload/webhook critical path |
| No synthetic/canary monitoring | Medium | Smoke tests run only at deploy time; no continuous synthetic checks of watch/upload/search from outside the deploy pipeline | Scheduled synthetic checks (e.g. every 5-15 min) hitting critical journeys independent of real traffic | Add a lightweight scheduled GitHub Action or external uptime-monitor hitting `/health/ready` + a real watch/search flow, alerting independent of deploy events |
| DB capacity planning undocumented | Medium | Neon pool max hardcoded to 5; no doc translating a MAU/QPS target into expected connection/CU usage | A documented capacity model (e.g., "at N MAU we expect X req/s, Y DB connections, plan to raise pool/upgrade Neon tier at Z") | Add a capacity-planning section to `LOAD_TEST_RUNBOOK.md` or a new doc, tied to the existing 50K-MAU soak target |
| S3 media restore is undocumented as a drill | Medium | Versioning enabled per script; no drilled restore-from-version runbook (unlike the Neon PITR drill, which *was* executed) | A drilled S3 restore procedure with the same rigor as the Neon drill | Run and log one S3 object-restore drill; add a row to `DISASTER_RECOVERY.md` mirroring the Neon restore-drill-log table |
| Branch protection / CI-CD governance gap (as of last audit) | Critical (if still open) | 2026-07-26 audit found `main` had no branch protection despite docs describing PR-gated merges as the safety model | Enforced branch protection matching documented policy | Re-verify current GitHub branch-protection state; this is a 15-minute fix per the original audit if still open — should not still be open |
| Unpinned/`@master` GitHub Action + static unrotated AWS keys | High (if still open) | `superfly/flyctl-actions/setup-flyctl@master` in privileged deploy jobs; long-lived AWS IAM keys with no rotation automation despite an existing GCP OIDC pattern | SHA-pinned actions; AWS credentials rotated on a schedule or migrated to OIDC | Re-verify current state; if still open, pin the action and either schedule rotation or port the existing `fly-gcp-oidc-token.sh` pattern to AWS STS AssumeRoleWithWebIdentity |
| No capacity/failure story for community/chat storage & queue load | Low-Medium | `CommunityStorageService` + community moderation queue add S3 + Redis + queue load with no distinct capacity note | Fold community storage/queue load into the same capacity-planning doc as video | Include community post-media and moderation-queue volume in the capacity model once product-scope tension (§ product-framing) is resolved |
| No geo-distributed CDN story beyond Mux-hosted video | Low (MVP-appropriate today) | API responses, thumbnails not proxied through Mux, and any FFmpeg-path media have no CDN/edge-cache layer documented outside optional CloudFront | Explicit decision: either extend CloudFront in front of all public asset delivery, or explicitly scope CDN to "video bytes only, via Mux" | Document the boundary explicitly rather than leaving it implicit; cheap to write down now, expensive to rediscover during an incident |

## 6. Recommended detailed flows / data model / API additions

These are additive operational/observability capabilities, scoped to be implementable without touching product business logic.

### 6.1 Cache stampede guard (single-flight re-fetch)

Add a small wrapper used by the video-detail and `search:v2` cache read paths:

```
async function getOrSingleFlight<T>(
  redis: Redis,
  key: string,
  ttlSec: number,
  lockTtlSec: number,
  fetch: () => Promise<T>,
): Promise<T> {
  const cached = await safeRedisGet(redis, key);
  if (cached) return JSON.parse(cached);

  const lockKey = `lock:${key}`;
  const acquired = await safeRedisSetNx(redis, lockKey, '1', lockTtlSec);
  if (!acquired) {
    // Someone else is refilling; brief wait + one retry read, then fall through to fetch()
    await sleep(150);
    const retry = await safeRedisGet(redis, key);
    if (retry) return JSON.parse(retry);
  }
  const fresh = await fetch();
  await safeRedisSetex(redis, key, ttlSec + jitter(ttlSec), JSON.stringify(fresh));
  return fresh;
}
```

Apply to: video-detail cache, `search:v2`, feed page cache. Jitter TTL by ±10-20% to avoid synchronized mass-expiry.

### 6.2 Continuous synthetic monitoring

New scheduled workflow (`.github/workflows/synthetic-check.yml`, cron every 5-15 min) that:
1. Hits `GET /api/v1/health/ready`.
2. Executes a real read-only user journey: fetch home feed → fetch a known-good public video detail → run a search query.
3. Posts pass/fail + latency to the existing metrics/alerting path (Grafana annotation or a dedicated Prometheus pushgateway metric `forge_synthetic_check_status`).
4. Alerts independent of deploy events — this catches slow-burn regressions (cache degradation, DB slow-query creep) that only show up between deploys.

### 6.3 Capacity-planning doc addition

Extend `docs/operations/LOAD_TEST_RUNBOOK.md` (or a new `docs/operations/CAPACITY_PLANNING.md`) with a table mapping target MAU → expected concurrent connections, DB pool usage, Redis connection count, and the specific Neon/Fly/Redis tier upgrade trigger for each band (10K / 50K / 100K+ MAU), tying into the existing 50K-MAU soak profile already defined in the load-test runbook.

### 6.4 DR: S3 restore drill

Mirror the Neon restore-drill-log table in `DISASTER_RECOVERY.md` with an S3 equivalent:

| Date | Object(s) restored | Method | Verified | Next due |
|---|---|---|---|---|

Drill: intentionally corrupt/overwrite a non-production test object, restore from a prior S3 version via `aws s3api list-object-versions` + `copy-object` with the version ID, verify byte-identical restore, log the result.

### 6.5 Region-failure runbook (documentation-only, no code)

Add a `docs/operations/REGION_FAILOVER.md` covering: what "Fly `bom` is down" looks like from monitoring, the manual steps to stand up API/worker in a second Fly region against the same Neon/Redis (cross-region latency tradeoff acknowledged), DNS cutover steps, and the explicit decision of whether this is a documented-but-manual process (acceptable at current scale) or something to automate later. This closes the gap between "we say single-region is a known tradeoff" and "there is no written procedure for the day it matters."

## 7. Assumptions and open questions

**Assumptions made in this doc:**
- The 2026-07-26 DevOps/AWS audit's Critical/High findings (branch protection, `@master`-pinned Action, static AWS keys) were treated as the last-known state; this research did not re-verify GitHub's live branch-protection API or the current pin state of `.github/workflows/*.yml`, since that is a live-config check outside static code/doc reading. **Flag for whoever implements from this doc: re-run that specific check before treating those rows as still-open.**
- "High-traffic" in this domain is scoped to FORGE's own stated target (50K MAU soak, per `LOAD_TEST_RUNBOOK.md`) — not YouTube's literal scale. The YouTube reference model in §2 is presented as a *pattern* to imitate proportionally, not a literal target.
- Mux's CDN/geo-distribution properties are assumed to be inherited "for free" for the default VOD path based on `docs/MEDIA.md`'s description of Mux as the default transcode+delivery provider; this was not independently verified against Mux's own SLA docs.

**Open questions requiring a product/eng decision, not assumed here:**
- Does the forge-youtube-replica.md mandate mean infra capacity planning should target YouTube-shaped load patterns (viral single-video spikes, live-stream concurrency spikes) as a design constraint now, even before those product surfaces are built out — or is capacity planning strictly reactive to FORGE's actual current traffic? This changes whether §6.3's capacity table should include a "viral spike" scenario.
- Should the community/chat storage and moderation-queue load (`CommunityStorageService`, `CommunityModerationQueueService`) be scoped into the same infra capacity plan as video, or is that surface itself in question per the courses/cohorts/mentorship vs. YouTube-parity tension flagged in the task brief? Infra planning is cheaper once product scope is settled — recommend resolving the product-framing tension before writing the capacity-planning doc in §6.3, not after.
- Is single-region (`bom`) a permanent, cost-driven decision, or a temporary MVP state? This determines whether §6.5's region-failover runbook should be written as a "cold, manual, rarely-exercised" procedure or something worth eventually automating/testing.
- What is FORGE's actual current GitHub branch-protection and Actions-pinning state today (post the 2026-07-26 findings)? This doc cannot resolve that without a live `gh api` check, which is outside static-analysis scope for this research pass.
- Is there a target SLA/uptime number anywhere (client-facing or internal) that the RPO/RTO targets in `DISASTER_RECOVERY.md` and the Fly SLO doc are meant to satisfy? Neither doc cites an upstream business requirement — they read as engineering-chosen defaults.

---

## Re-audit 2026-09-02

**Product framing:** Skill-first creator platform + YouTube mechanics (supersedes Aug 2026 YouTube-only framing).

**Key updates:** Keep skills/crafts taxonomy; keep creator approval gate; granular feature flags (`FEATURES_COURSES`, `_MENTORSHIP`, `_CHANNEL_POINTS`); courses/mentorship/points UI restore on roadmap P2–P3.

**See:** [skill-first-positioning.md](./skill-first-positioning.md), [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md), [FRESH_AUDIT_2026-09_MASTER.md](../audits/FRESH_AUDIT_2026-09_MASTER.md).
