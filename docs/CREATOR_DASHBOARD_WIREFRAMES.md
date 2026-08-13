# FORGE — Creator Analytics Dashboard Wireframes

> Layout spec for the creator analytics dashboard in `apps/web` and `apps/admin`.
> Actual components live in `apps/web/src/components/Community/` and `apps/web/src/app/studio/`.

---

## 1. Overview Dashboard (Studio Home)

```
┌─────────────────────────────────────────────────────────────────┐
│  FORGE Studio                             [Rahul ▾]  [Help]    │
├──────────┬──────────────────────────────────────────────────────┤
│          │  ┌────────────────────────────────────────────────┐  │
│ Overview │  │  Revenue Overview                   [30d ▾]   │  │
│ Content  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐      │  │
│ Members  │  │  │ MRR      │ │ Subs     │ │ Churn    │      │  │
│ Live     │  │  │ $4,990   │ │ 247      │ │ 2.1%     │      │  │
│ Courses  │  │  │ ▲ 8.3%   │ │ ▲ 12     │ │ ▼ 0.4%   │      │  │
│ Settings │  │  └──────────┘ └──────────┘ └──────────┘      │  │
│          │  └────────────────────────────────────────────────┘  │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │  Engagement Score         72/100               │  │
│          │  │  ████████████████████░░░░░░                    │  │
│          │  │  Active chatters: 148   Posts: 23   Courses: 4 │  │
│          │  └────────────────────────────────────────────────┘  │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │  Membership Funnel                             │  │
│          │  │  247  Paying members          ████████████████ │  │
│          │  │  148  Engaged (XP)            █████████        │  │
│          │  │   98  Active chatters         ██████           │  │
│          │  │   41  Course enrolled         ██               │  │
│          │  └────────────────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────────────┘
```

**API**: `GET /communities/creators/me/business-analytics`

---

## 2. Members Panel

```
┌─────────────────────────────────────────────────────────────────┐
│  Members                                    [Export CSV]  [+]   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Cohort Retention — Weekly                               │   │
│  │                                                          │   │
│  │  W1  ██████████████████████████  100%                   │   │
│  │  W2  ██████████████████████░░░░   82%                   │   │
│  │  W3  ████████████████░░░░░░░░░░   64%                   │   │
│  │  W4  █████████████░░░░░░░░░░░░░   52%                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │ Active     │  │ Trial      │  │ Canceled   │                │
│  │  247       │  │  14        │  │  31 (30d)  │                │
│  └────────────┘  └────────────┘  └────────────┘                │
│                                                                  │
│  Member List [search ________________] [filter ▾] [sort ▾]    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Name          Joined    Status    XP     Last Active      │   │
│  │ Alice K       Jan 2026  Active    1,240  2h ago           │   │
│  │ Bob R         Mar 2026  Trial     180    1d ago           │   │
│  │ Carol T       Feb 2026  Active    3,400  now              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**API**: `GET /communities/creators/me/business-analytics`, `GET /creators/me/communities/:id/analytics`

---

## 3. Revenue Detail Panel

```
┌─────────────────────────────────────────────────────────────────┐
│  Revenue                                        [90d ▾]         │
├─────────────────────────────────────────────────────────────────┤
│  MRR Trend                                                       │
│  $6k │                                           ▄▄▄            │
│  $4k │                             ▄▄▄      ▄▄▄▄███            │
│  $2k │          ▄▄▄          ▄▄▄▄▄███▄▄▄▄▄▄████████            │
│  $0  └──────────────────────────────────────────────            │
│       Apr       May          Jun         Jul                     │
│                                                                  │
│  Breakdown                                                       │
│  ┌──────────────────────────┬──────────────────────────┐       │
│  │ Subscription tiers       │ One-time                  │       │
│  │ Basic $9     → 120 subs  │ Paid events  → $840       │       │
│  │ Pro   $29    →  98 subs  │ Super Chat/Thanks → $2,400│       │
│  │ VIP   $99    →  29 subs  │                           │       │
│  └──────────────────────────┴──────────────────────────┘       │
│                                                                  │
│  ARR: $59,880   [Export]                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. AI Copilot Insights Widget

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Copilot Insights                          [Refresh]  [·ai]  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Summary                                                   │   │
│  │ "Your community grew 8% this month. Churn is under       │   │
│  │  control. Engagement score dipped — consider a live Q&A."│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Growth Focus: [Engagement recovery]                            │
│                                                                  │
│  Recommendations                                                 │
│  1. Post a new video — last upload was 18 days ago              │
│  2. Schedule a live session to re-engage inactive members       │
│  3. Send a milestone email to members at 6-month anniversary    │
│                                                                  │
│  Powered by claude-haiku-4-5 (configurable via AI_CLAUDE_MODEL)  │
└─────────────────────────────────────────────────────────────────┘
```

**API**: `POST /creators/me/copilot/insights`

---

## 5. Live Stream Analytics Panel

```
┌─────────────────────────────────────────────────────────────────┐
│  Live Analytics — "Sunday Workshop"           [End Stream]      │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Live now   │ │ Peak       │ │ Super chat │ │ Chat/min   │  │
│  │  1,247 👥  │ │  2,041 👥  │ │  $184      │ │  42        │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                  │
│  Concurrent viewers (last 60 min)                               │
│  2.1k │          ▄▄▄▄▄                                         │
│  1.4k │     ▄▄▄▄▄█████▄▄▄▄▄▄▄                                 │
│  0.7k │▄▄▄▄▄██████████████████▄▄▄                             │
│       └────────────────────────────────                         │
│       :00        :20          :40        now                     │
│                                                                  │
│  Poll votes: 312    Unique viewers: 3,401                       │
└─────────────────────────────────────────────────────────────────┘
```

**API**: `GET /streaming/:streamId/analytics/creator`

---

## 6. Mobile Studio Summary (Flutter)

```
┌─────────────────────────┐
│  Studio Overview        │
│  ─────────────────────  │
│  MRR         $4,990     │
│  Subscribers    247     │
│  Churn          2.1%    │
│  ─────────────────────  │
│  Engagement    72/100   │
│  ████████████░░░░░      │
│  ─────────────────────  │
│  [View Full Report]     │
│  [Go Live]              │
└─────────────────────────┘
```

**Screen**: `apps/mobile/lib/features/studio/presentation/`

---

## Implementation Notes

- Web: `StudioCreatorOpsPanel.tsx` drives the business analytics view. Add tabbed sections for Members, Revenue, Live per this spec.
- Admin: `apps/admin` mirrors creator view with platform-wide aggregates.
- Data refresh: React Query with 5-minute stale time for analytics; real-time Socket.IO event (`stream:viewer_count`) for live panel.
- Mobile: Studio overview screen uses cached analytics; full report links to web.
- All KPI definitions: [CREATOR_KPI_DEFINITIONS.md](./CREATOR_KPI_DEFINITIONS.md)
