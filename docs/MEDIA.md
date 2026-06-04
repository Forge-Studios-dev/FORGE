# Media (S3 + Mux)

Schemas: [API_SCHEMAS.md](./API_SCHEMAS.md). Worker: Fly `forge-studios-worker` or `docker compose up worker`.

---

## Video upload

1. `POST /videos/presigned-url` — `{ contentType, fileSizeBytes }`
2. PUT to S3 (or multipart if `FEATURE_FLAGS=multipart_upload`, ≥50MB)
3. `POST /videos/:id/complete` — `title`, `visibility`, `categoryId`, `skillTagIds` (not `skillTagName`)

**Transcode** (`VIDEO_TRANSCODE_PROVIDER`):

| Value | Path |
|-------|------|
| `mux` (default) | S3 → Mux asset → `stream.mux.com` HLS |
| `ffmpeg` | Worker → HLS on S3/CloudFront |

Webhook (required for Mux): `POST /api/v1/streams/webhooks/mux`

Proxy fallback if S3 CORS fails: `PUT /videos/:id/upload` — off in prod unless `ALLOW_PROXY_UPLOAD=true`.

---

## AWS S3

1. Private bucket (e.g. `forge-media-prod`, region `ap-south-1`)
2. CORS: PUT/GET from `forgestudios.net`, `localhost:3000` — `./scripts/fix-s3-cors.sh`
3. IAM: Put/Get/Head/Delete on bucket
4. Fly secrets: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
5. Optional `CLOUDFRONT_DOMAIN` for **FFmpeg** playback only

---

## Mux

**Dashboard:** [dashboard.mux.com](https://dashboard.mux.com)

| Use | Config |
|-----|--------|
| Live | RTMP ingest + HLS playback |
| VOD | Default transcode when `VIDEO_TRANSCODE_PROVIDER=mux` |

**Fly secrets (API + worker):**

```bash
export MUX_TOKEN_ID='...' MUX_TOKEN_SECRET='...' MUX_WEBHOOK_SECRET='...'
bash scripts/set-mux-secrets-fly.sh
```

**Webhook URL:** `https://api.forgestudios.net/api/v1/streams/webhooks/mux`  
**Events:** `video.asset.ready`, `video.asset.errored`, `video.live_stream.active`, `video.live_stream.idle`, `video.live_stream.recording`

`MUX_WEBHOOK_SECRET` must match Mux dashboard signing secret (not API token secret).

**Verify VOD:**

```bash
VIDEO_TRANSCODE_PROVIDER=mux bash scripts/verify-video-pipeline.sh
```

Playback must use `stream.mux.com/*.m3u8`.

**Without Mux in production:** live blocked; use `ffmpeg` for VOD only.

---

## Thumbnails (live)

Resolved in order: custom `thumbnailUrl` → Mux `image.mux.com` from playback ID → creator avatar (`mux-playback.util.ts`).
