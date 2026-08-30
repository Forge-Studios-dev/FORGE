# Live streaming

**Status:** Production-ready, shipped ceiling ~10K viewers/stream. **[SCALE_LIVE.md](./SCALE_LIVE.md) is a proposed 100K-viewer design, not yet implemented** — don't read it as current capability.  
**Full route list:** [FORGE_PROJECT_MASTER §20](./FORGE_PROJECT_MASTER.md#20-api-route-catalog) · **Media/Mux:** [MEDIA.md](./MEDIA.md)

---

## Capabilities

| Area | Shipped |
|------|---------|
| Mux RTMP ingest + HLS playback | ✅ |
| LiveKit browser go-live (RTMP egress to Mux) | ✅ Web |
| Scheduled streams, RSVP, reminders | ✅ |
| Host dashboard (mods, grants, polls, clips, chat settings) | ✅ Web · ✅ Mobile (W43–45) |
| Chat modes (`all`, `followers`, `subscribers`, `mods_only`) | ✅ |
| Replay + offset-synced chat (`fromMs`/`toMs`) | ✅ |
| Paid events (checkout + entitlement grants) | ✅ |
| Super chat (Stripe + stub dev path) | ✅ |
| Live DVR (`dvrEnabled` on create) | ✅ |
| AI moderation (OpenAI when `OPENAI_API_KEY` set) | ✅ |
| Analytics (unique viewers, revenue, poll totals) | ✅ |
| Highlight clip markers (30s window) | ✅ Schema + API + Mux export job |

| After-live discussion rooms | ✅ Auto TEXT room on stream end (community-linked streams) |
| Live Q&A mode (submit / upvote / answer) | ✅ API + realtime + web + mobile |

**Not architected:** chat microservice, multi-region, Stripe Connect payouts, auto ASR captions, global 1M+ concurrent.

### After-live discussion rooms

When a stream that is linked to a community (`Stream.communityId`) ends, the API
emits `stream.ended` and `AfterLiveRoomListener` provisions a standard **TEXT**
community room via `CommunityRoomsService.ensureAfterLiveRoom`, so members can
keep talking after the broadcast. Design notes:

- **Reuse, not a new system:** the room is an ordinary `CommunityRoom`, so it
  inherits room permissions, AI spam moderation, rate limiting, message history,
  and the `room:${roomId}` socket fan-out. It appears in the normal rooms list on
  web and mobile with no extra UI.
- **Idempotent:** the source stream id is stored in `room.settings.sourceStreamId`;
  retried/duplicate `stream.ended` events return the existing room instead of
  creating duplicates.
- **Best-effort & off the request path:** the listener never throws — failures
  (stream not community-linked, host lacks studio access, transient DB error) are
  logged and swallowed so they cannot affect the stream-end flow.
- **Authorization:** room creation runs under the host's identity and requires the
  host to own/manage the target community (creator or `OWNER`/`ADMIN` role).

### Live Q&A mode

Viewers submit questions during a stream; the audience upvotes them and the host
marks them answered/dismissed. Endpoints live under `streams/:streamId/qa`:

| Method | Path | Who |
|--------|------|-----|
| `GET` | `/streams/:id/qa?status=` | Anyone with chat access (optional auth) |
| `POST` | `/streams/:id/qa` | Authenticated viewer with chat access |
| `POST` | `/streams/:id/qa/:questionId/upvote` | Authenticated viewer (toggles) |
| `PATCH` | `/streams/:id/qa/:questionId/status` | Owner / delegated moderator |

Design notes:

- **Reuses `stream_messages`** with `message_type = 'question'` plus
  `question_status` (`pending|answered|dismissed`) and an `upvotes` tally — so
  questions inherit the same entitlement, ban/timeout, profanity, AI-moderation,
  and rate-limit guards as chat (questions are rate-limited a little harder).
- **Upvotes** are deduplicated per user via a Redis set (`stream:qa:votes:{id}`)
  with the persisted tally clamped at zero, so a lost Redis set can never drive
  the count negative.
- **Realtime:** `stream.qa.created` / `stream.qa.updated` EventEmitter2 events are
  relayed by the gateway to the `stream:${id}` room as `stream:qa:created` /
  `stream:qa:updated`. Web (`StreamQaPanel`) and mobile (`StreamQaPanel`) both
  refresh on these.
- **Migration:** `1837500000000-stream-qa` adds the enum value + columns + a
  partial index `(stream_id, upvotes DESC) WHERE message_type='question'`
  (`transaction = false` because Postgres disallows `ALTER TYPE ... ADD VALUE`
  inside a transaction).

### Host disconnect / auto-termination & recovery

The host's RTMP ingest (OBS, mobile encoder, or LiveKit browser egress — all
paths terminate at Mux) is the source of truth for connectivity. There is no
separate app-level heartbeat: Mux's `video.live_stream.idle`/`active` webhooks
(`StreamingService.handleMuxWebhook` → `MuxLiveSyncService`) plus a poll
fallback (`stream-mux-sync` worker) detect disconnects within seconds and are
authoritative even if a webhook is dropped or the API restarts mid-session.

| Step | Behavior |
|------|----------|
| Host disconnects | Stream stays `LIVE`; `muxIdleSince` is set; `stream.reconnecting` → `stream:reconnecting` fans out to the `stream:{id}` room |
| Host reconnects in time | `muxIdleSince` cleared; `stream.reconnected` → `stream:reconnected`; no new stream/session is created |
| Grace period expires (`MUX_IDLE_GRACE_SEC`, default 60s) | `MuxLiveSyncService.finalizeStreamEnded` sets `status=ENDED`, `endReason=connection_lost`, `endedAt`, finalizes `uniqueViewerCount`; `stream.ended` includes `endReason` |
| Host manually ends | `StreamingService.endStream` sets `endReason=host_ended` |

A late/out-of-order Mux "active" webhook can arrive after the grace period already auto-terminated a stream — `handleWebhookActive` no-ops on an `ENDED` row rather than resurrecting it. Finalization itself (`finalizeStreamsPastIdleGrace` and the equivalent branch in `syncStream`) is guarded by a per-stream Redis `SET NX` lock (`stream:finalize:lock:{id}`) so two replicas racing the same periodic scan can't double-finalize the same stream.

**Socket event payload contract** (each event carries only its own fields — they don't share a shape):

| Event | Payload |
|-------|---------|
| `stream:viewer-count` | `{ streamId, viewerCount }` |
| `stream:reconnecting` | `{ streamId, userId, since, timeoutSec, attempt }` |
| `stream:reconnected` | `{ streamId, userId }` |
| `stream:ended` | `{ streamId, userId, title, communityId, endReason }` |

Viewers: `GET /streams/:id` exposes `reconnecting`/`reconnectDeadline`/`endReason` (deadline computed server-side from the real `MUX_IDLE_GRACE_SEC`, never client-guessed) so a refreshed page or a viewer who (re)joins mid-reconnect sees the correct overlay/countdown immediately — `join-stream`'s ack carries the same `reconnecting`/`since`/`timeoutSec`. Super chat is blocked with a 400 while `muxIdleSince` is set, both at creation (`StreamChatService.sendSuperChat`) and at Stripe-checkout fulfillment (`handleSuperChatPaid` — a checkout started while live can complete mid-reconnect or post-end; the payment is already captured, so this only skips posting the message and logs a warning for manual reconciliation, it does not refund).

Host: `GET /creators/me/streams/:id/health` adds `reconnectDeadline`, `reconnectGraceSec`, `reconnectAttempts` (soft-capped by `MUX_MAX_RECONNECT_ATTEMPTS`, logged — not enforced, to avoid punishing a flaky-network host) for dashboard display.

Env: `MUX_IDLE_GRACE_SEC` (reconnection timeout), `MUX_MAX_RECONNECT_ATTEMPTS` (default 20, observability only).

**Rollback:** the only schema change is the additive, nullable `streams.end_reason` column (migration `1839900000000-stream-end-reason`) — safe to leave in place even if the API is rolled back to a pre-feature release (old code simply never reads/writes it), so no special migration-down step is required during a code rollback. If a full rollback (including the column) is ever needed, run its `down()` after the API is already back on the previous release, never before — dropping the column while the new code is still running would break `finalizeStreamEnded`/`endStream`. Rolling back the API alone is a normal deploy of the previous image; no worker/queue changes are involved.

---

## Worker queues (production)

Registered on Fly worker (`WORKER_ONLY=true`), not API replicas:

| Queue | Purpose |
|-------|---------|
| `stream-mux-sync` | Mux status poll + idle-end sweeper (45s live / 90s idle / 15m dormant) |
| `premium-content-notify` | Async subscriber fan-out for tier/subscriber replay videos |
| `stream-chat-ingest` | Async chat when `STREAM_CHAT_ASYNC=true` |
| `stream-reminder` | RSVP push reminders |
| `stream-snapshot-retention` | Analytics snapshot cleanup |
| `engagement-reconciliation` | Daily follow-count SQL reconciliation |

Sync secrets after API deploy: `bash scripts/sync-fly-worker-secrets.sh`

---

## Browser go-live (LiveKit)

Creators can broadcast from the browser without OBS. API issues LiveKit publisher tokens; egress pushes RTMP to Mux.

| Route | Purpose |
|-------|---------|
| `POST /streams/:streamId/broadcast/browser/token` | LiveKit publisher token |
| `POST …/start` | Start RTMP egress to Mux |
| `POST …/stop` | Stop egress |

### Required env (API + web)

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (API)
- `NEXT_PUBLIC_LIVEKIT_URL` (web)
- Mux credentials (same as RTMP ingest)

Details: [MEDIA.md](./MEDIA.md)

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
- `BILLING_PROVIDER=stripe` + `STRIPE_*` — paid events / super chat
- `LIVEKIT_*` — browser go-live

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
| Mux clip export from markers | ✅ BullMQ `stream-clip-export` + Mux asset clip; webhook completes playback URL |

