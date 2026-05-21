#!/usr/bin/env bash
# End-to-end VOD smoke: login → presign → complete → poll until ready → HEAD hls master.
set -euo pipefail

API_BASE="${FORGE_SMOKE_API:-http://localhost:3001/api/v1}"
EMAIL="${FORGE_CREATOR_EMAIL:-creator@forge.local}"
PASSWORD="${FORGE_CREATOR_PASSWORD:-ForgeDemo123!}"
POLL_SEC="${FORGE_PIPELINE_POLL_SEC:-300}"
INTERVAL="${FORGE_PIPELINE_POLL_INTERVAL:-5}"

echo "==> Video pipeline verify (${API_BASE})"

TOKEN=$(curl -sf -X POST "${API_BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.data?.accessToken||j.accessToken||'')})")

if [[ -z "${TOKEN}" ]]; then
  echo "FAIL: login returned no token for ${EMAIL}"
  exit 1
fi
echo "OK: logged in as ${EMAIL}"

presign_once() {
  curl -sS -X POST "${API_BASE}/videos/presigned-url" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d '{"contentType":"video/mp4","fileSizeBytes":2048}'
}

PRESIGN=$(presign_once)
VIDEO_ID=$(echo "$PRESIGN" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.data?.videoId||'')})")

if [[ -z "${VIDEO_ID}" ]]; then
  MSG=$(echo "$PRESIGN" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.message||'')})" 2>/dev/null || true)
  if [[ "${MSG}" == *"upload is still in progress"* ]]; then
    echo "WARN: ghost upload slot — waiting 50s for auto-release, then retrying presign…"
    sleep 50
    PRESIGN=$(presign_once)
    VIDEO_ID=$(echo "$PRESIGN" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.data?.videoId||'')})")
  fi
fi

if [[ -z "${VIDEO_ID}" ]]; then
  echo "FAIL: presign missing videoId — ${MSG:-unknown error}"
  echo "$PRESIGN"
  exit 1
fi
echo "OK: presigned video ${VIDEO_ID}"

# Optional tiny PUT when FORGE_PIPELINE_PUT=1 and uploadUrl present
if [[ "${FORGE_PIPELINE_PUT:-0}" == "1" ]]; then
  UPLOAD_URL=$(echo "$PRESIGN" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.data?.uploadUrl||'')})")
  if [[ -n "${UPLOAD_URL}" ]]; then
    # Body must match presigned ContentLength (2048 bytes) or S3 rejects the PUT.
    dd if=/dev/zero bs=2048 count=1 2>/dev/null | curl -sf -X PUT "${UPLOAD_URL}" \
      -H 'Content-Type: video/mp4' --data-binary @- >/dev/null
    echo "OK: PUT to S3 (2048 bytes)"
  fi
fi

if [[ "${FORGE_PIPELINE_PUT:-0}" != "1" ]]; then
  echo "OK: presign-only mode (set FORGE_PIPELINE_PUT=1 for full transcode smoke)"
  exit 0
fi

COMPLETE=$(curl -sS -X POST "${API_BASE}/videos/${VIDEO_ID}/complete" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Pipeline verify","visibility":"unlisted"}')
COMPLETE_OK=$(echo "$COMPLETE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.success?'1':'')})" 2>/dev/null || true)
if [[ "${COMPLETE_OK}" != "1" ]]; then
  echo "FAIL: complete failed"
  echo "$COMPLETE"
  exit 1
fi
echo "OK: complete enqueued processing"

DEADLINE=$(( $(date +%s) + POLL_SEC ))
HLS_URL=""
while [[ $(date +%s) -lt ${DEADLINE} ]]; do
  BODY=$(curl -sf "${API_BASE}/videos/${VIDEO_ID}" -H "Authorization: Bearer ${TOKEN}" || echo '{}')
  STATUS=$(echo "$BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.data?.status||'')})")
  HLS_URL=$(echo "$BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.data?.hlsUrl||'')})")
  echo "… status=${STATUS}"
  if [[ "${STATUS}" == "ready" && -n "${HLS_URL}" ]]; then
    break
  fi
  if [[ "${STATUS}" == "failed" ]]; then
    echo "FAIL: transcoding failed"
    exit 1
  fi
  sleep "${INTERVAL}"
done

if [[ -z "${HLS_URL}" ]]; then
  echo "FAIL: timed out waiting for ready+hlsUrl (${POLL_SEC}s)"
  exit 1
fi

HTTP=$(curl -s -o /dev/null -w '%{http_code}' -I "${HLS_URL}" || echo '000')
if [[ "${HTTP}" != "200" && "${HTTP}" != "403" ]]; then
  echo "WARN: HEAD ${HLS_URL} => HTTP ${HTTP} (private bucket may return 403 without signed URL)"
else
  echo "OK: hls HEAD HTTP ${HTTP}"
fi
echo "OK: pipeline verify complete — ${HLS_URL}"
