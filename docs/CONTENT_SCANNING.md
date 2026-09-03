# Upload Content-Safety Scanning

**Status:** Pluggable scaffolding, shipped 2026-08-12. No real scanner vendor is integrated.

---

## 1. What this is (and isn't)

FORGE had no automated content-safety scanning on upload — a video could go from "processing" straight to publicly indexed with zero review, regardless of content (CSAM, terrorism, malware, etc.). This adds a scan step between "transcoding finished" and "published/indexed," with a pluggable provider so a real vendor can be dropped in later.

**What this cannot do:** integrate an actual scanner. Real providers (Google CSAI Match, Thorn Safer, Microsoft PhotoDNA, hash-matching databases) require legal agreements, vendor-specific credentials, and often membership/vetting outside this codebase. The default (`CONTENT_SCAN_PROVIDER=none`) approves every upload — identical to today's behavior — until an operator configures a real integration. **Do not treat this as CSAM/illegal-content protection until a real vendor is wired in.**

## 2. Architecture

`ContentScanService` (`apps/api/src/modules/content/content-scan/`) picks a provider at startup based on `CONTENT_SCAN_PROVIDER`:

| Provider | Behavior |
|---|---|
| `none` (default) | `NoopContentScanProvider` — always `approve`. Preserves current behavior exactly. |
| `webhook` | `WebhookContentScanProvider` — generic REST integration point. POSTs `{videoId, userId, hlsUrl, thumbnailUrl}` to `CONTENT_SCAN_WEBHOOK_URL`, expects `{action: "approve"|"hold"|"block", categories?: string[]}` back. |
| `webhook` **without URL** | `MisconfiguredContentScanProvider` — **fail-closed `hold`** (never silent noop). Fix `CONTENT_SCAN_WEBHOOK_URL`. |

### Webhook contract (vendor adapter)

**Request** (`POST`, `Content-Type: application/json`, optional `Authorization: Bearer <CONTENT_SCAN_WEBHOOK_TOKEN>`):

```json
{
  "videoId": "uuid",
  "userId": "uuid",
  "hlsUrl": "https://stream.mux.com/….m3u8",
  "thumbnailUrl": "https://image.mux.com/…/thumbnail.jpg"
}
```

**Response** (2xx JSON):

```json
{
  "action": "approve",
  "categories": []
}
```

`action` must be exactly `approve` | `hold` | `block`. Anything else, non-2xx, timeout, or network error → **hold** with category `scan_unavailable`. Point `CONTENT_SCAN_WEBHOOK_URL` at a thin proxy that maps vendor JSON into this shape, or implement `ContentScanProvider` directly.

The webhook provider **fails closed to `hold`** on any error, timeout, non-2xx response, or unrecognized `action` value — unlike most external integrations in this codebase (which fail open), a safety scan should err toward caution: a `hold` only queues the video for human review, it doesn't destroy anything.

To integrate a real vendor: implement `ContentScanProvider` (`content-scan.types.ts`) against that vendor's actual API, and add a case to `ContentScanService.buildProvider()` — the call sites (below) don't change.

## 3. Call sites

Both video-ready paths call `ContentScanService.scanVideo()` right before marking a video `READY`:

- `MuxVodService.handleAssetReady` (Mux transcode path, production default)
- `VideoProcessorWorker.process` (local-dev FFmpeg path)

On a non-`approve` verdict:
- `Video.moderationStatus` is set to `held` or `blocked` (existing column — `shouldIndexVideo()`/`indexedAtOnReady()` already gate indexing on `moderationStatus === NONE`, so a held/blocked video's `indexedAt` stays `null` and it never enters search/feed/recommendations even though transcoding succeeded).
- `Video.moderationNote` records the provider + flagged categories; `moderationAt` is stamped.
- `video.content_scan_held` is emitted instead of `video.ready` — so subscriber notifications and feed-cache invalidation for "new video" don't fire for a video that hasn't cleared review. Platform admins and the uploader receive in-app + push `content_scan_held` notifications; Admin → Content filters `moderationStatus=held`.

An `approve` verdict (including the no-op default) proceeds exactly as before this change.

## 4. Configuration

See `.env.example`:

```
CONTENT_SCAN_PROVIDER=none        # or 'webhook'
CONTENT_SCAN_ALLOW_NOOP=true      # required in production while provider=none (ADR-012)
CONTENT_SCAN_WEBHOOK_URL=
CONTENT_SCAN_WEBHOOK_TOKEN=       # optional Bearer token
CONTENT_SCAN_TIMEOUT_MS=15000
```

**Production boot (ADR-012):** `NODE_ENV=production` with `CONTENT_SCAN_PROVIDER=none` **fails closed** unless `CONTENT_SCAN_ALLOW_NOOP=true`. Webhook mode requires `CONTENT_SCAN_WEBHOOK_URL` (no silent fallback to noop). Acknowledgment ≠ CSAM protection — vendor integration remains the launch gate ([ADR-009](./decisions/ADR-009-content-scanning.md)).

### Fly secrets

```bash
# Temporary noop acknowledgment (API + worker)
export CONTENT_SCAN_ALLOW_NOOP=true
npm run set:fly:content-scan-secrets
# or: bash scripts/set-content-scan-secrets-fly.sh

# After vendor is live:
export CONTENT_SCAN_PROVIDER=webhook
export CONTENT_SCAN_WEBHOOK_URL=https://…
export CONTENT_SCAN_WEBHOOK_TOKEN=…   # optional
npm run set:fly:content-scan-secrets
npm run sync:fly:worker-secrets   # also copies CONTENT_SCAN_* from API → worker
```

`verify:production` warns when `CONTENT_SCAN_ALLOW_NOOP` is unset in non-production env files (prod uses `check:prod-env`).

Health `checks.contentScan`: `webhook` | `misconfigured` | `noop` | `noop_ack` (when `CONTENT_SCAN_ALLOW_NOOP=true`). Health `checks.muxSigning`: `configured` | `misconfigured` | `unsigned`. Admin Settings surfaces the same labels. Ops execution: [operations/R1_LAUNCH_GATES.md](./operations/R1_LAUNCH_GATES.md).

Held videos appear in Admin → Content (`moderationStatus=held`). Platform admins receive in-app + push `content_scan_held` notifications (Admin header bell + consumer deep link via `NEXT_PUBLIC_ADMIN_URL`).
