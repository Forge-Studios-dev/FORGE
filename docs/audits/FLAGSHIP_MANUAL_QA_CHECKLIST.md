# Flagship manual QA checklist

**Purpose:** Close audit C6 process gap — document the minimum live verification before a marketing push or major release.  
**Status:** Artifact complete. Click-through verification requires staging (or prod canary) + human/browser/device — **not claimed verified in agent sessions without a running UI session.**

Environments: staging preferred. Record date, build SHA, tester initials.

---

## 1. Checkout / billing

| Step | Expected | Pass? |
|------|----------|-------|
| Open a paid community or premium video paywall | Pricing + CTA visible | |
| Complete Stripe Checkout (test mode) | Redirect success; entitlement grants access | |
| Refresh / reopen gated content | Still accessible without re-pay | |
| Webhook replay / duplicate session | Idempotent; no double charge UX | |
| Cancel / fail card (test) | Clear error; no false entitlement | |

## 2. Live streaming

| Step | Expected | Pass? |
|------|----------|-------|
| Creator schedules or goes live (studio host) | Stream status LIVE; playback URL present | |
| Viewer joins watch page (web) | HLS plays; chat connects | |
| Viewer joins (mobile) | Same | |
| Raise-hand / co-host (if enabled) | Host sees request; approve/deny works | |
| Poll during live | Vote counts update | |
| End stream | Status ENDED; VOD/recording path if configured | |
| Mux webhook idle → finalize | Stream leaves LIVE without manual poll wait | |

## 3. Studio upload

| Step | Expected | Pass? |
|------|----------|-------|
| Start upload (web studio) | Presigned URL; progress | |
| Complete upload | Video row PROCESSING → READY (Mux path) | |
| Publish | Appears in creator library / feed rules | |
| Fail / abort multipart | No orphan entitlement; retry works | |

## 4. Admin moderation

| Step | Expected | Pass? |
|------|----------|-------|
| Open admin triage / reports queue | List sorted; statuses visible | |
| Approve content | Status updates; creator notified if applicable | |
| Reject / remove | Content hidden; audit log entry | |
| Impersonation (if used) | Session purpose-scoped; audit trail | |

## 5. Smoke after deploy

| Step | Expected | Pass? |
|------|----------|-------|
| `GET /api/v1/health/live` | 200 | |
| Fly API machines | 2 started, checks passing | |
| Fly worker | 1 started, health ok | |
| Spot-check Redis/Neon errors in logs | No connection storm | |

---

## Sign-off

| Field | Value |
|-------|-------|
| Date | |
| Git SHA | |
| Environment | |
| Tester | |
| Blockers | |
| Ready for marketing push? | Yes / No |

**C6 tracker note:** Checklist delivered = process Critical closed for audit remediation. Live sign-off rows above remain operator responsibility.
