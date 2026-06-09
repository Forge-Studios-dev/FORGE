# Live streaming

**Status:** Production-ready for skill-learning live (~10K viewers/stream).  
**Full route list:** [FORGE_PROJECT_MASTER §20](./FORGE_PROJECT_MASTER.md#20-api-route-catalog) · **Media/Mux:** [MEDIA.md](./MEDIA.md)

---

## Capabilities

| Area | Shipped |
|------|---------|
| Mux RTMP ingest + HLS playback | ✅ |
| Scheduled streams, RSVP, reminders | ✅ |
| Host dashboard (mods, grants, polls, clips, chat settings) | ✅ Web · partial mobile |
| Chat modes (`all`, `followers`, `subscribers`, `mods_only`) | ✅ |
| Replay + offset-synced chat (`fromMs`/`toMs`) | ✅ |
| Paid events (checkout + entitlement grants) | ✅ |
| Super chat (Stripe + stub dev path) | ✅ |
| Live DVR (`dvrEnabled` on create) | ✅ |
| AI moderation (OpenAI when `OPENAI_API_KEY` set) | ✅ |
| Analytics (unique viewers, revenue, poll totals) | ✅ |
| Highlight clip markers (30s window) | ✅ Schema + API; Mux export TBD |

**Not architected:** chat microservice, multi-region, Stripe Connect payouts, auto ASR captions, global 1M+ concurrent.

---

## Worker queues (production)

Registered on Fly worker (`WORKER_ONLY=true`), not API replicas:

| Queue | Purpose |
|-------|---------|
| `stream-mux-sync` | Mux status poll + idle-end sweeper (45s live / 90s idle) |
| `premium-content-notify` | Async subscriber fan-out for tier/subscriber replay videos |
| `stream-chat-ingest` | Async chat when `STREAM_CHAT_ASYNC=true` |
| `stream-reminder` | RSVP push reminders |
| `stream-snapshot-retention` | Analytics snapshot cleanup |

Sync secrets after API deploy: `bash scripts/sync-fly-worker-secrets.sh`

---

## Deploy checklist

```bash
npm run build -w @forge/shared-types
npm run migration:run -w @forge/api
cd apps/api && npx jest --testPathPattern="streaming|stream-chat|billing|mux-live|stream-live"
./scripts/sync-fly-worker-secrets.sh
```

### Required Fly secrets (API + worker)

- `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`
- `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`
- `MUX_WEBHOOK_SECRET`, `MUX_IDLE_GRACE_SEC=60`
- `STREAM_CHAT_ASYNC=true`
- `WORKER_ONLY=true` on worker app only

### Optional

- `OPENAI_API_KEY` — AI chat moderation
- `STREAM_SUPER_CHAT_ENABLED=true`
- `STREAM_AI_MODERATION_ENABLED=true` (default on)

---

## Neon cost controls

HTTP read paths for live are **DB-only**; Mux sync runs via worker. See [audits/NEON_COST.md](./audits/NEON_COST.md) for connection budget and monitoring.

---

## Deferred (Phase 5+)

| Item | Notes |
|------|-------|
| Chat microservice + partitioning | Monolith sufficient for current scale |
| Multi-region Fly + Neon replicas | Mux CDN already global |
| Stripe Connect creator payouts | Platform holds super chat funds |
| Auto ASR captions | `stream_captions` schema ready |
| Mux clip export from markers | ffmpeg/Mux job TBD |
