# Mux VOD production checklist

Use after merging Mux VOD rollout code.

## 1. Rotate credentials (if exposed)

Mux Dashboard → Settings → Access Tokens → rotate token and webhook signing secret.

## 2. Fly secrets (API + worker)

```bash
export MUX_TOKEN_ID='your-mux-token-id'
export MUX_TOKEN_SECRET='your-mux-token-secret'
export MUX_WEBHOOK_SECRET='your-mux-webhook-signing-secret'
bash scripts/set-mux-secrets-fly.sh
```

## 3. Mux webhook (required for videos to reach `ready`)

- URL: `https://api.forgestudios.net/api/v1/streams/webhooks/mux`
- Events: `video.asset.ready`, `video.asset.errored`, `video.live_stream.active`, `video.live_stream.idle`, `video.live_stream.recording`
- **Signing secret:** Mux Dashboard → Settings → Webhooks → select your endpoint → copy **Signing secret** (this is **not** the API token secret).
- Set on Fly (must match the dashboard exactly):

```bash
fly secrets set MUX_WEBHOOK_SECRET='paste-signing-secret-from-mux-dashboard' \
  --app forge-studios-api
```

If webhooks return **403 Invalid signature** in API logs, the Fly `MUX_WEBHOOK_SECRET` does not match the Mux endpoint signing secret.

## 4. Verify

```bash
fly logs --app forge-studios-worker   # mux_vod_ingest_*
FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 \
FORGE_PIPELINE_PUT=1 \
FORGE_PIPELINE_SAMPLE_MP4=/path/to/sample.mp4 \
VIDEO_TRANSCODE_PROVIDER=mux \
bash scripts/verify-video-pipeline.sh
```

Upload on https://forgestudios.net → Network tab must show `stream.mux.com/*.m3u8`, never `original.mp4`.

## 5. Ship code to git (required — Fly was deployed from local workspace)

```bash
git checkout feat/mux-vod-production   # branch already created locally
# commit + push + PR → merge once (do not push directly to main)
```
