# FORGE — Moderation Escalation Rules

> Defines when content is auto-actioned vs. escalated for human review.
> See also: [CREATOR_KPI_DEFINITIONS.md](./CREATOR_KPI_DEFINITIONS.md), [COMMUNITY-PERMISSION-MATRIX.md](./COMMUNITY-PERMISSION-MATRIX.md)

---

## 1. Moderation Queue Tiers

| Tier | Trigger | SLA | Auto-Action |
|------|---------|-----|-------------|
| **P0 — Immediate** | CSAM, doxxing, credible threats | 1 hour | Auto-block + alert ops |
| **P1 — High** | Hate speech, spam bot (>20 msgs/min), malware link | 4 hours | Auto-hold pending review |
| **P2 — Standard** | Off-topic, harassment, copyright flag | 24 hours | Queue for human review |
| **P3 — Low** | Minor policy violations, excessive self-promo | 72 hours | Queue; creator resolves first |

---

## 2. AI Moderation Pipeline

### Trigger conditions
- Community post/comment submitted
- AI moderation enabled on community (`aiModerationEnabled = true`)
- Budget gate not exhausted (`AiBudgetService.tryConsume()`)

### Decision thresholds (LLM judge score 0–100)

| Score | Action |
|-------|--------|
| 0–29 | Approve (no action) |
| 30–59 | Create a report for moderator review (`community-moderation.service.ts`) |
| 60–79 | Auto-hold + notify creator mod team |
| 80–100 | Auto-block + escalate to platform ops |

### Fallback (AI unavailable)
- Budget exhausted or both providers fail → approve optimistically; queue for async human review
- All thresholds based on `llm-router.service.ts` judge feature

---

## 3. Human Escalation Paths

### Community-level moderators
- Can resolve reports via `PATCH /creators/me/communities/:communityId/reports/:reportId/resolve`, viewed via `GET /creators/me/moderation/inbox` and `GET /creators/me/communities/:communityId/reports`
- Cannot permanently ban users (creator or admin only)
- Can mute users for up to 7 days

### Creator
- Full moderation authority within own communities
- Can configure AI threshold via `PATCH /creators/me/communities/:id` (`aiModerationThreshold`)
- Escalates to platform ops for P0/P1 via in-app report

### Platform ops (admin role)
- `UserRole.ADMIN` has override access to all moderation endpoints
- Irreversible actions: user ban, content deletion, creator suspension

---

## 4. Rate Limits & Anti-Abuse

### Chat message rate limits
- Default: 1 message/2s (slow mode off)
- Slow mode: configurable 2–120s per message (creator-set)
- Spam detection: >20 messages in 60s window → auto-mute 5 minutes

### XP anti-gaming
- Per-action daily limits (see [CREATOR_KPI_DEFINITIONS.md §5](./CREATOR_KPI_DEFINITIONS.md))
- Global 500 XP/day cap
- Velocity guard: >5 XP actions in 60s → blocked with `velocity_limit_reached`

### Account sharing / access sessions
- Max 3 concurrent sessions per user
- Session conflict → `403 ACCESS_SESSION_CONFLICT`

---

## 5. Reporting & Audit

| Resource | Location |
|----------|----------|
| Reports (admin-wide) | `GET /admin/community-reports` · `PATCH /admin/community-reports/:reportId/resolve` |
| Creator audit log | `GET /creators/me/audit-logs` |
| AI moderation metrics | Prometheus `ai_llm_call_total{feature="moderation"}` |
| Budget status (admin) | `GET /admin/ai/budget` |
