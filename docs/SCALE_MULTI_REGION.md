# FORGE — Multi-Region Failover Design

> **Status: PROPOSED — not yet implemented.** Section 1 describes what's actually shipped today (single-region); everything after it is a design for a future pass, not current architecture. Mirrors the same "current vs. proposed" split as [SCALE_LIVE.md](./SCALE_LIVE.md).
>
> Written 2026-08-11 in response to a gap flagged in [PLATFORM_AUDIT_2026-08-09.md §2.9](./PLATFORM_AUDIT_2026-08-09.md#29-infra--scalability--reliability): single-region deployment, no documented full-region-outage failover.

---

## 1. Current state (single region)

| Component | Region / topology today |
|---|---|
| Fly API (`forge-studios-api`) | `bom` (Mumbai) only, `primary_region` in `fly.toml` |
| Fly Worker (`forge-studios-worker`) | `bom` only, `--ha=false` (single machine — see `docs/PLATFORM_AUDIT_2026-08-09.md §2.9`, accepted SPOF) |
| PostgreSQL | Neon, single region (see `docs/operations/DISASTER_RECOVERY.md` for backup/PITR — that's data-loss protection, not region failover) |
| Redis | Single `REDIS_URL` (Upstash in production). `SCALE_LIVE.md` proposes an Upstash multi-region read-replica cluster for live pub/sub at 100K-viewer scale — not adopted platform-wide |
| S3 | `ap-south-1`, single region, no cross-region replication configured |
| CDN | Optional CloudFront — global edge, not itself a regional-failure point |

**What a full `bom` region outage does today:** API and worker both go down together (same region, no standby). Neon and S3 outages in their respective regions have no fallback either. There is no documented runbook for this scenario — `DISASTER_RECOVERY.md` covers Neon PITR restore (data loss), not a live region failing.

## 2. Proposed direction

Match effort to actual failure probability — Fly region outages are rare but not zero; a full design should be cheap to build incrementally, not a rewrite.

### 2.1 Compute (Fly) — do this first, cheapest
- Add a second Fly region for the API app (e.g. `bom` + `sin` or `bom` + `syd` — pick by where the actual user base concentrates once there's traffic data to look at).
- Fly's built-in `fly_replay`/anycast routing handles request distribution across regions automatically once a second region is added to `fly.toml` — no app-code change needed for stateless HTTP.
- Worker stays single-region initially (BullMQ jobs aren't request-latency-sensitive) but should move off `--ha=false` to at least 2 machines in the primary region before multi-region is worth doing — fix the closer SPOF first.

### 2.2 Data (Neon Postgres) — the hard part
- Neon supports read replicas in other regions. A second API region would read from a same-region read replica for read-heavy paths (feed, search, video detail — all already cached, so replica lag is masked by the cache TTL) and write to the primary region over the WAN for writes.
- Full active-active writes across regions is **not** proposed — conflict resolution complexity isn't justified at FORGE's current scale. A single write region with cross-region read replicas is the standard, much simpler pattern.
- Failover of the *primary* write region itself (not just adding read capacity) requires either Neon's own multi-region HA offering (if/when available on the current plan) or a documented manual promote-replica-to-primary runbook with an accepted RTO/RPO — this needs a product/ops decision on acceptable downtime during a failover, not just an engineering default.

### 2.3 Cache (Redis)
- Follow `SCALE_LIVE.md`'s already-proposed Upstash multi-region read-replica cluster, extended platform-wide (not just live pub/sub) once compute is multi-region.

### 2.4 Object storage (S3) + CDN
- Turn on S3 cross-region replication for the media bucket, or rely on CloudFront's edge caching to absorb most read traffic regardless of origin-region health (already largely true today via CloudFront, if `CLOUDFRONT_DOMAIN` is set).

## 3. What this doc deliberately does not decide

- **Which second region** — needs real traffic/latency data, not a guess.
- **RTO/RPO targets** — an acceptable-downtime number is a product/business decision, not an engineering default; the design above is shaped to make that number small, not to pick it.
- **Cost** — a second Fly region + Neon read replica + Redis cluster is real recurring infra spend; sizing that against actual revenue/risk is out of scope for this document.

## 4. Sequencing (cheapest → hardest)

1. Worker HA within the primary region (`--ha=false` → 2 machines) — closes the sharpest existing SPOF, zero new infra regions.
2. Second Fly region for the API (stateless, Fly handles routing) — biggest availability win per unit effort.
3. Neon cross-region read replica — unlocks reads surviving a primary-region network partition; writes still depend on the primary region.
4. Redis multi-region cluster — extend `SCALE_LIVE.md`'s existing proposal beyond just live streaming.
5. Full write-region failover runbook — only worth building once 1–4 are in place and an RTO/RPO target has been set.

Each step is independently shippable and independently valuable — this isn't an all-or-nothing migration.
