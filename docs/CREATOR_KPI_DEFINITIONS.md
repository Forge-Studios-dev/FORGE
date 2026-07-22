# FORGE — Creator KPI & Metric Specifications

> Source of truth for all creator business KPIs and platform engagement metrics.
> See also: [MEMBERSHIPS.md](./MEMBERSHIPS.md), [FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md](./FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md)

---

## 1. Revenue KPIs

| KPI | Definition | API field | Notes |
|-----|-----------|-----------|-------|
| **MRR** | Monthly Recurring Revenue — sum of active subscription prices (cents) for current month | `revenue.mrr` | From `getCreatorBusinessAnalytics` |
| **ARR** | Annual Recurring Revenue — MRR × 12 | `revenue.arr` | |
| **Revenue (30d)** | Live event ticket revenue collected in last 30 days (cents), from `stream_event_purchases` | `membership.totalRevenue30d` | Stripe-sourced |
| **Trial Conversion** | Percentage of trial members who convert to paid within 14 days | Not yet tracked server-side | Future |

---

## 2. Membership KPIs

| KPI | Definition | API field | Notes |
|-----|-----------|-----------|-------|
| **Active Subscribers** | Count of members with `status = 'active'` in `member_subscriptions` | `membership.active` | |
| **Trial Members** | Count of members with `status = 'trialing'` | `membership.trial` | |
| **Churn Rate (30d)** | Percentage of subscribers who cancelled in last 30 days relative to total base | `kpis.churnRate30d` | `(canceled / (active + trial + canceled)) × 100` |
| **Canceled (30d)** | Raw count of cancellations in last 30 days | `kpis.canceledLast30Days` | |

---

## 3. Engagement KPIs

| KPI | Definition | API field | Notes |
|-----|-----------|-----------|-------|
| **Engagement Score** | 0–100 weighted composite: active chatters (40%) + post authors (30%) + course enrollments (30%) relative to total member base | `kpis.engagementScore` | Capped at 100 |
| **Active Members (7d)** | Count of members who sent at least 1 message in last 7 days | `activeMembersLast7Days` | From community analytics |
| **Messages (7d)** | Total chat messages in last 7 days | `messagesLast7Days` | |
| **Posts (7d)** | Community posts created in last 7 days | `postsLast7Days` | |
| **Poll Votes (7d)** | Total poll votes in last 7 days | `pollVotesLast7Days` | |
| **Engaged Members (XP)** | Members who earned any XP in last 30 days | `retention.engagedMembers` | Gamification-based |

---

## 4. Content KPIs

| KPI | Definition | Notes |
|-----|-----------|-------|
| **Video Views** | Qualified view (≥ threshold of duration viewed) counted via `view_count` + Redis pending | `video.viewCount` |
| **Watch Rate** | % of video watched (tracked via `RecordWatchDto.progressSeconds`) | Per-session |
| **Course Enrollment** | Active enrollment count per course | `course.enrollmentCount` |
| **Lesson Completion** | % of enrolled students who completed each lesson | Future aggregate |

---

## 5. Platform XP Thresholds

| Action | XP | Daily Limit |
|--------|----|-------------|
| Video upload | 50 | 1 |
| Course publish | 100 | 1 |
| Platform check-in | 10 | 1 |
| Post create | 5 | 10 |
| Comment create | 3 | 20 |
| Lesson complete | 15 | 5 |
| Course enroll | 20 | 3 |
| Live attend | 10 | 3 |

**Global daily XP cap:** 500 XP/user/day  
**Velocity limit:** max 5 XP grants per 60-second window (anti-gaming)

---

## 6. Gamification Milestones

| Streak | Bonus XP | Badge |
|--------|----------|-------|
| 7 days | +50 XP | Week Warrior |
| 14 days | +75 XP | — |
| 30 days | +150 XP | Monthly Dedication |
| 60 days | +300 XP | — |
| 100 days | +500 XP | Centurion |
| 180 days | +1000 XP | — |
| 365 days | +2000 XP | — |

---

## 7. API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /creators/me/business-analytics` | Creator | Full KPI dashboard |
| `GET /creators/me/business-analytics/export` | Creator | CSV export |
| `GET /creators/me/communities/:id/analytics` | Creator | Community engagement analytics |
| `GET /platform/gamification/me` | Any | User XP, level, streak |
| `GET /platform/gamification/leaderboard` | Any | Top users by XP |

---

## 8. Industry Benchmark Comparisons

> Benchmarks sourced from publicly reported creator platform data (Patreon, Substack, Teachable, Mighty Networks, 2023–2025).
> Use these as health targets, not hard constraints.

### Membership churn
| Metric | Industry median | FORGE target | Status |
|--------|----------------|--------------|--------|
| Monthly churn rate | 5–8% | < 5% | Tracked via `kpis.churnRate30d` |
| Annual subscriber retention | 40–60% | > 65% | Derived from churn |
| Trial-to-paid conversion | 20–35% | > 30% | Future tracking |

### Engagement
| Metric | Industry median | FORGE target |
|--------|----------------|--------------|
| Monthly active rate (MAU/total members) | 25–40% | > 40% |
| Messages per active member per week | 3–8 | > 5 |
| Course completion rate | 10–20% | > 25% |
| NPS (creator-reported) | 30–50 | > 45 |

### Revenue
| Metric | Industry median | FORGE target |
|--------|----------------|--------------|
| ARPU (avg revenue per member/month) | $8–$20 | Creator-set (platform takes 10%) |
| Revenue per active creator | $200–$2,000/mo | Benchmark at 6-month maturity |
| MRR growth (healthy creator) | 5–15%/mo | Flag < 3% as at-risk |

### Content
| Metric | Industry median | FORGE target |
|--------|----------------|--------------|
| Videos per active creator per month | 4–8 | Track via creator analytics |
| Live sessions per month | 2–4 | Track via streaming analytics |
| Watch rate (% of video watched) | 40–60% | > 50% |

---

## 9. KPI Alert Thresholds

These thresholds trigger operator or creator alerts in the moderation/escalation pipeline:

| KPI | Warning | Critical |
|-----|---------|----------|
| Churn rate (30d) | > 8% | > 15% |
| Engagement score | < 30 | < 15 |
| MRR month-over-month change | < −10% | < −25% |
| Days since last creator post | > 14 | > 30 |

See [ESCALATION_RULES.md](./ESCALATION_RULES.md) for content moderation escalation thresholds and operator response SLAs.
