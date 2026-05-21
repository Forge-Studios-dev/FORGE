# AWS S3 + Mux setup for FORGE

Connect **video upload / transcoding** (AWS) and **live streaming** (Mux) to your production API on Fly.io.

**Production API:** `https://api.forgestudios.net/api/v1`  
**Mux webhook URL:** `https://api.forgestudios.net/api/v1/streams/webhooks/mux`

---

## Overview

| Service | Used for | Required when |
|---------|----------|----------------|
| **AWS S3** | Upload raw video → FFmpeg HLS + thumbnail on Fly → store in S3 | Creators upload lessons |
| **CloudFront** (optional) | CDN URLs for playback (`CLOUDFRONT_DOMAIN`) | Recommended for production playback |
| **Mux** | Live RTMP ingest + HLS playback | Creators use **Go live** |

Without AWS: browse, watch seeded content, admin, engagement still work.  
Without Mux: VOD upload can still work; live returns “not configured” in production.

---

## Part 1 — AWS S3

### 1.1 Create an S3 bucket

1. Sign in to [AWS Console](https://console.aws.amazon.com/) → **S3** → **Create bucket**.
2. **Bucket name:** e.g. `forge-media-prod` (globally unique).
3. **Region:** pick one close to users (e.g. `ap-south-1` Mumbai — matches default in `apps/api/.env.example`).
4. **Block Public Access:** keep **all four ON** (bucket stays private; playback via CloudFront or signed URLs later).
5. Create bucket.

### 1.2 CORS (required for web/mobile upload)

Browser uploads use **presigned PUT** from `forgestudios.net` and `localhost:3000`.

**S3 → your bucket → Permissions → CORS → Edit:**

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": [
      "https://forgestudios.net",
      "https://admin.forgestudios.net",
      "http://localhost:3000",
      "http://localhost:3002"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add your Vercel preview URLs if you test uploads from preview deployments.

### 1.3 IAM user (API + worker access)

1. **IAM** → **Users** → **Create user** → name e.g. `forge-api-media`.
2. **Attach policies directly** → **Create policy** (JSON):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ForgeMediaBucket",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::forge-media-prod",
        "arn:aws:s3:::forge-media-prod/*"
      ]
    }
  ]
}
```

Replace `forge-media-prod` with your bucket name.

3. Create user → **Security credentials** → **Create access key** → **Application running outside AWS**.
4. Save **Access key ID** and **Secret access key** (shown once).

### 1.4 CloudFront (optional, recommended)

Playback URLs use `CLOUDFRONT_DOMAIN` when set (see `video-processor.worker.ts`).

1. **CloudFront** → **Create distribution**.
2. **Origin:** your S3 bucket (REST API origin, OAC recommended).
3. **Default cache behavior:** GET, HEAD, OPTIONS; compress objects.
4. Create distribution → copy domain e.g. `https://d1234abcd.cloudfront.net`.
5. Ensure bucket policy allows CloudFront OAC to read objects (AWS wizard can add this).

**MVP shortcut:** leave `CLOUDFRONT_DOMAIN` empty — playback uses `https://<bucket>.s3.<region>.amazonaws.com/...` (bucket must allow public read on `videos/*/hls/*` **or** you add CloudFront). For private bucket, **use CloudFront** or objects won’t play in browsers.

**Recommended for private bucket:** use CloudFront with OAC (origin access control).

### 1.5 Local `apps/api/.env`

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIAxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxx
S3_BUCKET_NAME=forge-media-prod
CLOUDFRONT_DOMAIN=https://d1234abcd.cloudfront.net
```

`CLOUDFRONT_DOMAIN` — include `https://`, no trailing slash.

### 1.6 Fly.io secrets (production)

From repo root, with values in `apps/api/.env`:

```bash
fly secrets set \
  AWS_REGION=ap-south-1 \
  AWS_ACCESS_KEY_ID='YOUR_KEY' \
  AWS_SECRET_ACCESS_KEY='YOUR_SECRET' \
  S3_BUCKET_NAME=forge-media-prod \
  CLOUDFRONT_DOMAIN='https://d1234abcd.cloudfront.net' \
  --app forge-studios-api
```

Fly redeploys automatically after secrets change.

### 1.7 Test upload pipeline

1. Approved creator on web → **Upload** (mp4 or mov, max **500 MB** per `PresignedUrlDto`).
2. Flow: `POST /videos/presigned-url` → browser **PUT** to S3 → `POST /videos/:id/complete`.
3. Watch `fly logs --app forge-studios-api` for `video-processing` / FFmpeg.
4. When status is **ready**, watch page should play HLS.

```bash
npm run smoke:api:prod   # baseline API health
fly logs --app forge-studios-api
```

---

## Part 2 — Mux (live streaming)

### 2.1 Create Mux account

1. [dashboard.mux.com](https://dashboard.mux.com) → sign up (trial credits often available).
2. **Settings → Access Tokens** → **Generate new token**.
3. Permissions: at least **Mux Video** read/write (live streams).
4. Copy **Token ID** and **Token Secret**.

### 2.2 Webhook (production)

1. Mux dashboard → **Settings → Webhooks** → **Create webhook**.
2. **URL:**

   ```
   https://api.forgestudios.net/api/v1/streams/webhooks/mux
   ```

3. Subscribe to events (minimum):
   - `video.live_stream.active`
   - `video.live_stream.idle`
   - `video.asset.ready` (if recording VOD from live)
4. Copy **Signing secret** → `MUX_WEBHOOK_SECRET`.

### 2.3 Local `apps/api/.env`

```env
MUX_TOKEN_ID=xxxxxxxx
MUX_TOKEN_SECRET=xxxxxxxx
MUX_WEBHOOK_SECRET=xxxxxxxx
```

### 2.4 Fly.io secrets

```bash
fly secrets set \
  MUX_TOKEN_ID='YOUR_MUX_TOKEN_ID' \
  MUX_TOKEN_SECRET='YOUR_MUX_TOKEN_SECRET' \
  MUX_WEBHOOK_SECRET='YOUR_MUX_SIGNING_SECRET' \
  --app forge-studios-api
```

### 2.5 Test live stream

1. Log in as **approved, verified** creator on web.
2. **Studio → Live** or **/live** → start stream → copy **RTMP URL** + **stream key**.
3. OBS / Streamlabs:
   - Server: `rtmps://global-live.mux.com:443/app`
   - Stream key: from API response
4. Open live directory `/live` — stream should appear when active.
5. Mux webhook updates status in DB; check Mux dashboard **Webhooks** delivery log if stuck.

**Note:** In `development`, Mux failures fall back to mock stream IDs. In **production**, missing Mux config returns **503** on start stream.

---

## Part 3 — Checklist

### AWS

- [ ] S3 bucket created (private)
- [ ] CORS allows web origins + localhost
- [ ] IAM user + access key with bucket permissions
- [ ] CloudFront distribution (recommended) or public-read policy on HLS prefix
- [ ] Secrets on Fly: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `CLOUDFRONT_DOMAIN`
- [ ] Test upload → processing → playback

### Mux

- [ ] Access token created
- [ ] Webhook → `https://api.forgestudios.net/api/v1/streams/webhooks/mux`
- [ ] Secrets on Fly: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`
- [ ] Test OBS → live → viewer playback

---

## Part 4 — Troubleshooting

| Problem | Fix |
|---------|-----|
| Upload fails in browser (CORS) | Fix S3 CORS `AllowedOrigins` + `PUT` method |
| `Upload not found in storage` on complete | PUT failed or wrong bucket/key; check Network tab |
| Video stuck **processing** | `fly logs` — FFmpeg OOM? (512MB VM); retry job or scale VM |
| Video **ready** but won’t play | Set `CLOUDFRONT_DOMAIN` or allow read on HLS paths; check `hlsUrl` in DB |
| Live **503 not configured** | Set Mux secrets on Fly; not `placeholder` |
| Webhook **403 Invalid signature** | `MUX_WEBHOOK_SECRET` must match Mux dashboard; redeploy after change |
| Webhook never fires | URL must be public HTTPS; check Mux delivery log |

---

## Env reference (API)

| Variable | Example | Purpose |
|----------|---------|---------|
| `AWS_REGION` | `ap-south-1` | S3 region |
| `AWS_ACCESS_KEY_ID` | `AKIA...` | IAM key |
| `AWS_SECRET_ACCESS_KEY` | `...` | IAM secret |
| `S3_BUCKET_NAME` | `forge-media-prod` | Bucket |
| `CLOUDFRONT_DOMAIN` | `https://dxxx.cloudfront.net` | CDN base for HLS/thumbnails |
| `MUX_TOKEN_ID` | from Mux | API auth |
| `MUX_TOKEN_SECRET` | from Mux | API auth |
| `MUX_WEBHOOK_SECRET` | from Mux webhook | Signature verify |

Templates: `apps/api/.env.example`, `apps/api/.env.production.example`

---

*Last updated: 2026-05-21*
