COMMUNITY MODULE 2.0 — DEEP AUDIT & NEXT-GENERATION CREATOR ECOSYSTEM PROMPT

Act as a Senior Product Architect, Creator Economy Strategist, Platform Engineer, Community Growth Expert, and Full-Stack Architect.

Before making recommendations, thoroughly analyze the entire FORGE codebase, architecture, documentation, memberships system, social platform audit, live streaming architecture, creator workflows, entitlement system, RBAC model, mobile apps, web apps, admin panel, API modules, database schema, Redis usage, Mux integration, notification system, DM system, and community implementation.

Do not simply suggest features.

First understand:

Existing community architecture
Membership architecture
Creator structure
Live streaming architecture
Entitlement system
Social graph implementation
Current database design
Subscription lifecycle management
Community moderation tools
Scalability model

Then compare FORGE against:

YouTube Communities
Patreon
Circle
Discord
Kajabi
Mighty Networks
Twitch
Skillshare
Coursera Communities
Facebook Groups
Slack Communities
Skool
PHASE 1 — CURRENT STATE AUDIT

Perform a complete audit of the existing Community Module.

Identify:

Architecture Gaps
Missing entities
Missing relationships
Poor ownership structures
Subscription bottlenecks
Community scalability risks
Moderation limitations
Live session limitations
Creator management limitations
Technical Gaps
Database design flaws
Redis opportunities
Permission issues
Entitlement weaknesses
Notification gaps
Search limitations
Feed limitations
UX Gaps
Creator experience
Member onboarding
Community discovery
Community engagement
Subscription conversion flow
Community retention flow
PHASE 2 — INDUSTRY RESEARCH

Research how the following platforms structure communities:

YouTube
Memberships
Community Tab
Channel hierarchy
Live streams
Playlists
Subscriber access
Patreon
Tier system
Exclusive content
Membership lifecycle
Creator monetization
Discord
Servers
Categories
Channels
Roles
Permissions
Live events
Circle
Spaces
Courses
Events
Membership bundles
Kajabi
Products
Courses
Communities
Coaching programs
Mighty Networks
Community organization
Courses
Challenges
Events
Twitch
Subscribers
Live engagement
Community loyalty systems
Skillshare & Coursera
Course communities
Cohorts
Learning groups
Learning journeys

For each platform identify:

Architecture
Permission model
Monetization strategy
Retention strategy
Community engagement strategy
PHASE 3 — DESIGN FORGE COMMUNITY 2.0

Design a future-proof community architecture.

Creator Structure

Creator
├── Communities
├── Courses
├── Channels
├── Events
├── Membership Tiers
├── Live Sessions
├── Content Library
└── Analytics

Allow a creator to own multiple:

Communities
Brands
Programs
Courses
Cohorts
Membership products
Community Hierarchy

Design a structure similar to:

Creator
→ Community
→ Category
→ Channel
→ Room
→ Discussion
→ Thread
→ Comment

Support:

Public communities
Private communities
Paid communities
Invite-only communities
Cohort communities
Course communities
Event communities
PHASE 4 — ADVANCED MEMBERSHIP SYSTEM

Design a subscription engine supporting:

Access Levels

Free Member

Video Member

Live Member

Community Member

Course Member

Premium Member

VIP Member

Enterprise Member

Access Models

Creator-wide access

Community access

Channel access

Course access

Bundle access

Event access

Content access

Lifetime access

Time-based access

Seat-limited access

Subscription Lifecycle

Trial

Active

Paused

Grace Period

Expired

Cancelled

Renewal Pending

Failed Payment

Suspended

Refunded

Provide:

Database design
Entitlement engine
Access evaluation logic
Renewal workflow
Upgrade workflow
Downgrade workflow
Cancellation workflow
PHASE 5 — COMMUNITY CONTENT SYSTEM

Design a unified content architecture.

Support:

Content Types

Videos

Shorts

Live Streams

Live Recordings

Posts

Announcements

Articles

Courses

Lessons

Downloads

Podcasts

Polls

Q&A Sessions

Assignments

Challenges

Resources

Events

Webinars

AMA Sessions

Design:

Content relationships
Content tagging
Content visibility
Content discovery
Content recommendation
PHASE 6 — LIVE COMMUNITY EXPERIENCE

Design a live ecosystem combining Twitch + Discord + Circle.

Support:

Live Features

Live Chat

Stage Mode

Audience Requests

Raise Hand

Reactions

Polls

Q&A

Pinned Messages

Moderation Tools

Breakout Rooms

Guest Speakers

Multi-host Sessions

Live Challenges

Community Events

Paid Events

VIP Rooms

After-Live Discussions

Live Replay Access

Provide:

Backend architecture
Socket architecture
Redis architecture
Scaling strategy
PHASE 7 — COMMUNITY ENGAGEMENT ENGINE

Design engagement systems that maximize retention.

Community Features

Threads

Nested Discussions

Knowledge Base

Community Wiki

Announcements

Creator Updates

Milestones

Polls

Surveys

Challenges

Events

Meetups

Study Groups

Accountability Groups

Office Hours

Mentorship Programs

Provide engagement loops.

Explain:

Daily engagement
Weekly engagement
Monthly engagement
Long-term retention
PHASE 8 — GAMIFICATION & LOYALTY

Design a creator loyalty engine.

Support:

XP
Levels
Reputation
Streaks
Achievements
Community Badges
Creator Badges
Event Badges
Referral Rewards
Ambassador Programs
Leaderboards

Explain:

How YouTube, Discord and Twitch implement retention
How FORGE can improve upon them
PHASE 9 — AI-POWERED COMMUNITY

Design AI capabilities.

AI Features

Community Assistant

AI Moderator

AI Content Tagging

AI Search

AI Summaries

Live Stream Summaries

Discussion Summaries

Course Recommendations

Creator Copilot

Community Health Scoring

Spam Detection

Member Risk Prediction

Subscription Churn Prediction

Engagement Prediction

Provide:

Architecture
Data flow
Cost analysis
Privacy implications
PHASE 10 — CREATOR BUSINESS OPERATING SYSTEM

Design creator tools.

Creator Dashboard

Revenue Analytics

Subscriber Analytics

Community Analytics

Content Analytics

Live Analytics

Conversion Funnels

Retention Funnels

Cohort Analytics

Engagement Analytics

Churn Analytics

Growth Analytics

Provide dashboard wireframes and metrics.

PHASE 11 — PERMISSIONS & SECURITY

Design enterprise-grade RBAC.

Roles:

Owner

Admin

Moderator

Coach

Teacher

Mentor

VIP Member

Paid Member

Free Member

Guest

Support:

Community-level permissions
Channel-level permissions
Room-level permissions
Event-level permissions
Content-level permissions
PHASE 12 — SCALE TO 10M+ USERS

Design for:

10M users
100K concurrent live viewers
Millions of subscriptions
Millions of community messages

Provide:

Database Strategy
Redis Strategy
Queue Strategy
Search Strategy
Feed Strategy
Notification Strategy
Analytics Strategy
Cost Optimization Strategy

Specifically review:

Neon/PostgreSQL
Redis
BullMQ
Socket.IO
Mux
S3
Fly.io
Vercel

and recommend improvements.

PHASE 13 — IMPLEMENTATION ROADMAP

Produce:

Quick Wins (1–2 Weeks)
Phase 1 (30 Days)
Phase 2 (60 Days)
Phase 3 (90 Days)
Phase 4 (180 Days)

For every recommendation include:

Business impact
Creator impact
Technical complexity
Development effort
Revenue impact
Priority score
FINAL DELIVERABLE

Generate:

Community Architecture Diagram
Subscription Architecture Diagram
Creator Ecosystem Diagram
Permission Matrix
Database Schema Recommendations
API Design Recommendations
Event-Driven Architecture
Monetization Strategy
Scalability Strategy
AI Roadmap
Community Growth Roadmap
Gap Analysis Between Current FORGE and Industry Leaders
Detailed Action Plan With Recommended Implementation Order

The goal is not to build a simple community feature.

The goal is to transform FORGE into a complete Creator Economy Operating System that combines the best parts of YouTube, Patreon, Circle, Discord, Kajabi, Twitch, Skillshare, and Coursera while remaining scalable, monetizable, and maintainable.

---

## Implementation Status (2026-06-19)

**Overall:** ~90% of Creator Economy OS vision · **Living tracker:** [docs/COMMUNITY-2.0-IMPLEMENTATION.md](docs/COMMUNITY-2.0-IMPLEMENTATION.md)

| Phase | Scope | Completion | Status |
|-------|-------|------------|--------|
| Sprint 0–6 | Schema, access sessions, moderation, posts, polls, brands, Connect onboarding, gamification hooks | 100% | **Done** |
| Phase A | Post comments/reactions, billing portal, expires_at sync, moderator UI, HTTP e2e, discovery UI, mobile creator fix | 100% | **Done** |
| Phase B | Destination charges, in-place tier change, courses LMS, badges, community-scoped live, mobile parity | 100% | **Done** |
| Phase C | Stage mode raise hand, retention BI, async AI mod queue, mobile moderation | 100% | **Done** |
| Phase D | Device limits, outbox, media attachments, courses UI, creator BI funnel/cohorts, load-test script | ~85% | **Substantially complete** |

### Sprint 0–6 (Foundation) — Done

| Sprint | Scope | Verification |
|--------|-------|--------------|
| 0 | Community 2.0 schema, access sessions, moderation API, unit tests | Migration `1800000000000`, specs |
| 1 | Studio detail, moderation UI, tier entitlements | `studio/communities/[id]` |
| 2 | Mobile multi-community, access sessions, auth devices | Mobile + smoke |
| 3 | Brand CRUD, subscriber analytics, Stripe Connect onboarding | Studio + API |
| 4 | Posts, search, announcements API | BullMQ worker |
| 5 | Courses/cohorts CRUD, gamification hooks, regex spam filter | Foundation |
| 6 | RBAC delegation, posts access control, polls, brands UI | S6 tracker |

### Phase A — Done (2026-06-19)

- Post comments + reactions (migration `1826000000000`, API, web, mobile counts)
- Billing portal (`POST /billing/portal`, memberships UI)
- Stripe `expires_at` sync from webhooks
- Moderator/coach UI (`/studio/moderation`, `GET /creators/me/moderated-communities`)
- HTTP integration tests (`test/community-http.e2e-spec.ts`)
- Community discovery page (`/discover/communities`)
- Thread reply display in `CommunityPanel`
- Mobile studio `_creatorId` fix + multi-community picker

### Phase B/C — Done (2026-06-19)

- Stripe destination charges + in-place tier change
- Courses LMS API (lessons, enrollment, progress)
- Gamification badges + streaks + check-in
- Community-scoped live + raise-hand stage mode
- Async moderation queue + mobile moderation UI
- Expanded HTTP e2e (12 routes) + courses/communities unit specs

### Phase D — Substantially complete (2026-06-19)

- D-3 per-tier device limits (`maxConcurrentDevices`, multi-device sessions)
- SC-1 platform event outbox for durable announcement dispatch
- C-4 post media attachments + YouTube/Vimeo embeds
- Courses web + mobile UI (studio, viewer, lesson editor)
- Creator BI funnel + weekly/monthly cohort retention charts
- Community load test script (`scripts/load-test-community.sh`)
- HTTP e2e expanded to 12 routes

### Deferred backlog

1. Search sidecar when triggered (F-1302, 500K videos)
2. ML moderation pipeline
3. Voice/breakout rooms
4. Formal 50K MAU load validation on staging

### 21 Deliverables Cross-Reference

See [docs/COMMUNITY-2.0-IMPLEMENTATION.md](docs/COMMUNITY-2.0-IMPLEMENTATION.md) §21 Deliverables Index for full audit deliverable status.

Deferred: full Stripe Connect destination charges, signed Mux URLs, search sidecar (F-1302), AI moderation (beyond heuristics), Room entity, enterprise RBAC.