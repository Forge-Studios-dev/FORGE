# Mux cost operations (F-1001)

**Audience:** Platform / media ops  
**Related:** [MEDIA.md](../MEDIA.md) · [10_COST_OPTIMIZATION.md](../audits/10_COST_OPTIMIZATION.md)

---

## Cost drivers

| Driver | What increases bill |
|--------|---------------------|
| Minutes stored | VOD assets retained after publish |
| Minutes delivered | Playback (web + mobile MAU) |
| Live stream hours | `POST /streams/start` → active live time |
| Failed / duplicate ingest | Retries without idempotency |

Production enforces `VIDEO_TRANSCODE_PROVIDER=mux` only (`validate-production-config.ts`).

---

## Monthly checklist

1. **Mux dashboard** — compare minutes stored vs delivered; spike alerts.
2. **Stuck uploads** — studio `release-stuck-uploads`; errored assets in Mux console.
3. **Webhook health** — `MUX_WEBHOOK_SECRET` set; no 401 on `POST /streams/webhooks/mux`.
4. **Idempotency** — `mux-vod-ingest` jobs should not double-create assets on webhook retry (review worker logs after incidents).
5. **Orphan S3** — multipart sessions abandoned; lifecycle policy for `uploads/` temp prefixes (AWS console).

---

## Guardrails in FORGE

- Do not enable FFmpeg workers in production Fly apps.
- Do not set `ENABLE_VIDEO_WORKER` on the API machine in production.
- Entitlements hide playback URLs when access denied (reduces wasted delivery only for gated UI paths).

## Webhook idempotency (F-1001)

VOD ingest uses a **stable BullMQ `jobId`** per video via `muxVodIngestJobId(videoId)` in [mux-vod.constants.ts](../../apps/api/src/modules/content/mux-vod.constants.ts), enqueued from [videos.service.ts](../../apps/api/src/modules/content/videos.service.ts).

| Behavior | Detail |
|----------|--------|
| Job ID format | `mux-ingest-${videoId}` |
| Duplicate enqueue | BullMQ rejects a second job with the same `jobId` while the first is active/waiting |
| Mux webhook retry | Safe — retried `video.asset.ready` events should not spawn parallel ingest |
| Regression guard | Unit test in `mux-vod.constants.spec.ts` |

**When to inspect DLQ / worker logs:**

- `forge_bullmq_jobs_waiting{queue="mux-vod-ingest"}` spikes after a deploy or Mux incident
- Studio shows upload stuck in `processing` while Mux console has a ready asset
- Repeated webhook 5xx from `POST /streams/webhooks/mux` — check API logs, then worker ingest outcome

Do not manually re-enqueue with a new `jobId` unless the prior job failed permanently and the video row is reset.

---

## When to escalate

- Delivery minutes grow faster than MAU → investigate embed hotlinking or leaked playback URLs.
- Storage minutes grow without new creators → audit deleted/hidden videos still on Mux.
