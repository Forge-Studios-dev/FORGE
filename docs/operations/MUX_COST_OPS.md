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

---

## When to escalate

- Delivery minutes grow faster than MAU → investigate embed hotlinking or leaked playback URLs.
- Storage minutes grow without new creators → audit deleted/hidden videos still on Mux.
