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

`ffmpeg` path is a real scalability limit, not just a config choice: BullMQ concurrency is `1` (serial, one video at a time per worker) and the video stays non-`READY` until **all 4** HLS renditions finish (all-or-nothing, no partial/progressive availability). Prefer `mux` for anything beyond local dev / low volume.

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

### Signed playback (private / unlisted / members)

Non-public VOD and live use Mux **signed** playback policy when keys are present (`requiresMuxSignedPlayback` in `mux-signing.util.ts`). Without keys:

- Viewer HLS URLs for restricted content are **withheld** (owners/admins still get unsigned for Studio via bypass).
- **Create/ingest** of non-public Mux assets and visibility tighten-to-signed are **rejected** (`503` + `MUX_SIGNING_KEYS_REQUIRED`) so we never mint Mux `signed` playback ids the API cannot token.

| Env | Purpose |
|-----|---------|
| `MUX_SIGNING_KEY_ID` | Mux dashboard signing key id |
| `MUX_SIGNING_PRIVATE_KEY` | PEM private key (escape newlines as `\n` in Fly secrets) |

```bash
# Mux dashboard → Signing Keys → Create → copy id + private key
flyctl secrets set MUX_SIGNING_KEY_ID='...' MUX_SIGNING_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----' -a forge-studios-api
npm run sync:fly:worker-secrets   # if worker also resolves playback
```

Health `checks.muxSigning`: `configured` | `misconfigured` | `unsigned`. Admin → Settings surfaces the same. Required before premium private content launch ([DEFERRED_BACKLOG](./audits/DEFERRED_BACKLOG.md) · [R1_LAUNCH_GATES](./operations/R1_LAUNCH_GATES.md)).

---

## Thumbnails (live)

Resolved in order: custom `thumbnailUrl` → Mux `image.mux.com` from playback ID → creator avatar (`mux-playback.util.ts`).

---

## Live platform (OBS + browser + paid events)

| Path | Use |
|------|-----|
| OBS / RTMP | Default — `rtmps://global-live.mux.com:443/app` + stream key from `POST /streams/start` |
| Browser go-live | LiveKit room → RTMP egress to Mux (`LIVEKIT_*` on API, `NEXT_PUBLIC_LIVEKIT_URL` on web) |
| Paid events | `BILLING_PROVIDER=stripe` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`; ticket via `POST /streams/:id/checkout` |
| Scheduling | `scheduledAt` on create; `GET /streams/upcoming`; BullMQ `stream-reminder` worker (every 5m) |

**API env (live):**

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
BILLING_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STREAM_PROFANITY_FILTER_ENABLED=true
```

**Web env:**

```bash
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
```

**Stripe webhook:** `POST /api/v1/billing/webhook` — event `checkout.session.completed` with `metadata.type=stream_event` grants ticket access.
