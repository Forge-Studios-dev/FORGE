# Video upload (web, mobile, API)

## Flow

1. `POST /api/v1/videos/presigned-url` — creator JWT, `contentType`, `fileSizeBytes`
2. Upload bytes to S3 (single PUT or multipart)
3. `POST /api/v1/videos/:id/complete` — title, description, skill tag

## Single PUT (default)

Response includes `uploadUrl`. Client `PUT`s the file directly to S3.

**Fallback:** web retries `PUT /api/v1/videos/:id/upload` (proxy) when direct S3 fails (disabled in production unless `ALLOW_PROXY_UPLOAD=true`).

## Multipart (≥ 50 MB)

Enable on API: `FEATURE_FLAGS=multipart_upload`

Response:

```json
{
  "uploadMode": "multipart",
  "videoId": "...",
  "partSize": 10485760,
  "partCount": 12
}
```

| Step | Endpoint |
|------|----------|
| Resume progress | `GET /videos/:id/multipart/progress` |
| Presign parts | `POST /videos/:id/multipart/parts` `{ "partNumbers": [1,2,3] }` |
| Checkpoint | `POST /videos/:id/multipart/checkpoint` `{ "parts": [{ "partNumber", "etag" }] }` |
| Finish | `POST /videos/:id/multipart/complete` `{ "parts": [...] }` |

Server state: **Redis** hot cache (24h) plus **Postgres** backup (`video_multipart_sessions`, 7d) for cross-device resume and audit. Web also caches completed parts in `sessionStorage`.

## After upload

Transcoding runs on the **worker** process (`WORKER_ONLY=true` or `docker compose up worker`). API machines must not run video transcode in production.

- Default: **FFmpeg → HLS** on S3/CloudFront.
- Optional: **Mux Video (VOD)** when `VIDEO_TRANSCODE_PROVIDER=mux` (S3 upload is still used for ingest; playback is Mux HLS/ABR).

## Clients

| Client | Implementation |
|--------|----------------|
| Web | `apps/web/src/lib/upload-storage-multipart.ts`, `upload-manager.ts` |
| Mobile | `apps/mobile/lib/features/upload/data/multipart_upload.dart` |

See also [AWS_MUX_SETUP.md](./AWS_MUX_SETUP.md), [GETTING_STARTED.md](./GETTING_STARTED.md).
