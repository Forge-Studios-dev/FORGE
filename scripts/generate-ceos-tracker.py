#!/usr/bin/env python3
"""Generate docs/FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md — task-level registry."""

from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from typing import Optional

# Status: done, wip, pending, blocked, review
S = {
    "done": "✅",
    "wip": "🔄",
    "pending": "⏳",
    "blocked": "🚫",
    "review": "👀",
}


@dataclass
class Task:
    phase: int
    num: int
    requirement: str
    surface: str
    status: str
    evidence: str
    gap: str
    priority: str
    effort: str
    depends: str = "-"
    owner: str = "Backend"

    @property
    def id(self) -> str:
        return f"CEOS-P{self.phase:02d}-T{self.num:03d}"


def t(
    phase: int,
    num: int,
    requirement: str,
    surface: str,
    status: str,
    evidence: str = "-",
    gap: str = "-",
    priority: str = "P2",
    effort: str = "M",
    depends: str = "-",
    owner: str = "Backend",
) -> Task:
    return Task(phase, num, requirement, surface, status, evidence, gap, priority, effort, depends, owner)


TASKS: list[Task] = []

# ── Phase 0: Discovery & Audit (25) ──────────────────────────────────────────
P0 = [
    t(0, 1, "Platform architecture inventory (API modules)", "Docs", "done", "docs/FORGE_PROJECT_MASTER.md §4", "-", "P0", "S"),
    t(0, 2, "Web route inventory (64 pages)", "Docs", "done", "apps/web/src/app/**/page.tsx", "-", "P0", "S"),
    t(0, 3, "Mobile route inventory (40+ screens)", "Docs", "done", "apps/mobile/lib/core/router/app_router.dart", "-", "P0", "S"),
    t(0, 4, "Admin route inventory (16 pages)", "Docs", "done", "apps/admin/src/app/**/page.tsx", "-", "P0", "S"),
    t(0, 5, "Database migration inventory (57 migrations)", "Docs", "done", "apps/api/src/database/migrations/", "-", "P0", "S"),
    t(0, 6, "BullMQ worker inventory", "Docs", "done", "docs/FORGE_PROJECT_MASTER.md §5", "-", "P0", "S"),
    t(0, 7, "Socket.IO event inventory", "Docs", "done", "packages/shared-types/src/socket-events.ts", "-", "P0", "S"),
    t(0, 8, "Enterprise audit closure review", "Docs", "done", "docs/audits/EXECUTIVE_SUMMARY.md", "-", "P1", "S"),
    t(0, 9, "Social platform audit review", "Docs", "done", "docs/audits/SOCIAL_PLATFORM_AUDIT_2026-06.md", "-", "P1", "S"),
    t(0, 10, "Infrastructure cost audit review", "Docs", "done", "docs/audits/INFRASTRUCTURE_COST_AUDIT_2026-06.md", "-", "P1", "S"),
    t(0, 11, "Deferred backlog reconciliation", "Docs", "done", "docs/audits/DEFERRED_BACKLOG.md", "-", "P1", "S"),
    t(0, 12, "AI/LLM strategy audit", "Docs", "done", "docs/AI-LLM-STRATEGY.md", "-", "P1", "S"),
    t(0, 13, "Membership/billing doc audit", "Docs", "done", "docs/MEMBERSHIPS.md", "-", "P1", "S"),
    t(0, 14, "API test coverage inventory (75 specs)", "Docs", "done", "apps/api/**/*.spec.ts", "-", "P1", "S"),
    t(0, 15, "CI pipeline inventory", "Docs", "done", ".github/workflows/ci.yml", "-", "P1", "S"),
    t(0, 16, "Creator economy OS master tracker (this doc)", "Docs", "done", "docs/FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md", "-", "P0", "L"),
    t(0, 17, "Evidence-based completion % dashboard", "Docs", "done", "This doc §2", "-", "P0", "M"),
    t(0, 18, "Broken doc link audit", "Docs", "done", "docs/README.md redirects", "-", "P0", "S"),
    t(0, 19, "WIP branch feature audit (events, programs, migration)", "Docs", "done", "P0 implementation shipped 2026-06-22", "-", "P0", "M"),
    t(0, 20, "Permission matrix code audit", "Docs", "done", "community-permissions.constants.ts", "-", "P1", "S"),
    t(0, 21, "Entitlement engine code audit", "Docs", "done", "entitlements.service.ts", "-", "P1", "S"),
    t(0, 22, "Access session architecture audit", "Docs", "done", "access-sessions.service.ts", "-", "P1", "S"),
    t(0, 23, "Mux/S3 media pipeline audit", "Docs", "done", "docs/MEDIA.md", "-", "P2", "S"),
    t(0, 24, "Neon/Redis connection budget audit", "Docs", "done", "docs/audits/NEON_COST.md", "-", "P2", "S"),
    t(0, 25, "Re-audit schedule definition (2026-09-04 or 50K MAU)", "Docs", "done", "docs/audits/EXECUTIVE_SUMMARY.md", "-", "P1", "S"),
]
TASKS.extend(P0)

# ── Phase 1: Gap Analysis (30) ───────────────────────────────────────────────
P1 = [
    t(1, 1, "Architecture gap: channel vs room dual model", "API", "done", "deprecation + room bridge + CHANNEL_SUNSET.md runbook", "-", "P1", "L"),
    t(1, 2, "Architecture gap: creator programs no consumer API", "API", "done", "creator-programs.controller.ts consumer routes", "-", "P0", "M"),
    t(1, 3, "Architecture gap: courses no public catalog", "API", "done", "courses discover + catalog API", "-", "P1", "M"),
    t(1, 4, "Technical gap: 10 API modules zero tests", "API", "done", "P1 modules covered (admin/feed/search/DM/reports); P2/P3 remain", "-", "P1", "L"),
    t(1, 5, "Technical gap: global auth guards untested", "API", "done", "6 guard spec files (28 tests)", "-", "P1", "M"),
    t(1, 6, "Technical gap: Postgres FTS at scale", "API", "blocked", "F-1302 deferred", "Perf", "P3", "XL", "-", "Platform"),
    t(1, 7, "Security gap: geo anomaly detection", "API", "pending", "-", "Security", "P3", "L"),
    t(1, 8, "Security gap: suspicious login detection", "API", "pending", "-", "Security", "P3", "L"),
    t(1, 9, "Security gap: signed Mux URLs (DRM)", "API", "blocked", "F-1101", "Security", "P3", "L"),
    t(1, 10, "UX gap: mobile studio programs missing", "Mobile", "done", "studio_programs_screen.dart", "-", "P1", "M", "CEOS-P03-T035", "Mobile"),
    t(1, 11, "UX gap: mobile studio events admin missing", "Mobile", "done", "studio_engagement_screen.dart events", "-", "P0", "M", "-", "Mobile"),
    t(1, 12, "UX gap: mobile billing env parity", "Mobile", "done", "membership_panel.dart launches checkoutUrl and surfaces server errors (no silent mock fallback in prod)", "-", "P1", "S", "-", "Mobile"),
    t(1, 13, "UX gap: web welcome modal (mobile missing)", "Mobile", "done", "community_welcome_dialog.dart wired into community_screen.dart", "-", "P2", "S", "-", "Mobile"),
    t(1, 14, "Creator gap: subscriber CSV export mobile", "Mobile", "done", "studio_subscribers_screen.dart + csv_export_util.dart", "-", "P2", "S", "-", "Mobile"),
    t(1, 15, "Community gap: voice stage raise-hand mobile", "Mobile", "done", "community_stage_raise_hand_panel.dart", "-", "P1", "M", "-", "Mobile"),
    t(1, 16, "Scalability: formal 50K MAU load test", "Infra", "blocked", "DEFERRED_BACKLOG Load test", "Perf", "P3", "XL", "-", "Platform"),
    t(1, 17, "Scalability: search sidecar trigger", "Infra", "blocked", "F-1302", "Perf", "P3", "XL", "-", "Platform"),
    t(1, 18, "Cost: Mux COGS without Stripe revenue", "Infra", "blocked", "F-1101", "Perf", "P1", "M", "-", "Product"),
    t(1, 19, "Doc gap: FORGE_PROJECT_MASTER §16 stale", "Docs", "done", "FORGE_PROJECT_MASTER.md §16 updated", "-", "P0", "S"),
    t(1, 20, "Doc gap: Community 3.0 tracker files missing", "Docs", "done", "redirect stubs + master tracker", "-", "P0", "S"),
    t(1, 21, "Doc gap: V3.0 claims 98% complete", "Docs", "done", "V3.0 disclaimer added", "-", "P0", "S"),
    t(1, 22, "Ownership: community-scoped subscriptions", "API", "done", "migration 1836000000000", "-", "P1", "M"),
    t(1, 23, "Ownership: multi-brand per creator", "API", "done", "brands.controller.ts", "-", "P1", "M"),
    t(1, 24, "Notification gap: community activity notify listener", "API", "done", "community-activity-notify.listener.ts", "-", "P1", "M"),
    t(1, 25, "Feed gap: no semantic recommendations", "API", "pending", "-", "Missing", "P3", "XL"),
    t(1, 26, "Engagement gap: no study/accountability groups", "API", "pending", "-", "Missing", "P3", "L"),
    t(1, 27, "Live gap: no breakout rooms", "API", "pending", "-", "Missing", "P3", "XL"),
    t(1, 28, "Content gap: no unified shorts/articles model", "API", "pending", "-", "Missing", "P2", "L"),
    t(1, 29, "Gamification gap: no platform-wide referrals", "API", "pending", "-", "Missing", "P2", "M"),
    t(1, 30, "AI gap: community LLM moderation not wired", "API", "done", "wired: maybeQueueLlmJudgeTail + config; daily budget cap (ai-budget.service.ts)", "-", "P2", "M"),
]
TASKS.extend(P1)

# ── Phase 2: Industry Benchmarks (15) ────────────────────────────────────────
P2 = [
    t(2, i, name, "Docs", "done", "FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md", "-", "P3", "S", "-", "Product")
    for i, name in enumerate([
        "Benchmark: YouTube permission/monetization model",
        "Benchmark: Patreon tier/subscription lifecycle",
        "Benchmark: Discord community/channel permissions",
        "Benchmark: Circle paid community model",
        "Benchmark: Kajabi course/cohort model",
        "Benchmark: Mighty Networks community events",
        "Benchmark: Twitch live chat/moderation",
        "Benchmark: Skillshare course discovery",
        "Benchmark: Coursera LMS progress model",
        "Benchmark: Netflix content library UX",
        "Benchmark: Disney+ entitlement model",
        "Benchmark: Prime Video session control",
        "Benchmark: Skool community engagement loops",
        "Benchmark: Facebook Groups discovery",
        "Benchmark: Slack community threading",
    ], 1)
]
TASKS.extend(P2)

# ── Phase 3: Creator Structure (40) ──────────────────────────────────────────
def phase3():
    items = []
    n = 1
    specs = [
        ("Brands CRUD API", "API", "done", "brands.controller.ts", "-", "P1", "M"),
        ("Brands studio web UI", "Web", "done", "studio/brands/page.tsx", "-", "P1", "M", "-", "Frontend"),
        ("Brands studio mobile UI", "Mobile", "done", "studio_brands_screen.dart", "-", "P1", "M", "-", "Mobile"),
        ("Creator ecosystem tree API", "API", "done", "GET creators/me/ecosystem-tree", "-", "P1", "M"),
        ("Ecosystem tree studio analytics web", "Web", "done", "studio/analytics/page.tsx", "-", "P2", "M", "-", "Frontend"),
        ("Multi-community per creator", "API", "done", "communities.controller.ts", "-", "P1", "M"),
        ("Community slug routing web", "Web", "done", "[username]/c/[communitySlug]", "-", "P1", "M", "-", "Frontend"),
        ("Community slug routing mobile", "Mobile", "done", "community/:creatorId/c/:slug", "-", "P1", "M", "-", "Mobile"),
        ("Creator programs schema migration", "API", "done", "1837400000000-creator-programs.ts", "-", "P0", "M"),
        ("Creator programs studio CRUD API", "API", "done", "creator-programs.controller.ts", "-", "P0", "M"),
        ("Creator programs studio web UI", "Web", "done", "studio/programs/page.tsx", "-", "P0", "M", "-", "Frontend"),
        ("Creator programs studio mobile UI", "Mobile", "done", "studio_programs_screen.dart", "-", "P1", "M", "CEOS-P03-T031", "Mobile"),
        ("Creator programs consumer list API", "API", "done", "GET creators/:creatorId/programs", "-", "P0", "M", "CEOS-P03-T031"),
        ("Creator programs enrollment API", "API", "done", "POST programs/:programId/enroll", "-", "P0", "L", "CEOS-P03-T031"),
        ("Creator programs consumer web UI", "Web", "done", "CreatorProgramsPanel + programs/[slug] page", "-", "P1", "M", "CEOS-P03-T034", "Frontend"),
        ("Creator programs consumer mobile UI", "Mobile", "done", "creator_programs_panel + program_viewer_screen", "-", "P1", "M", "CEOS-P03-T034", "Mobile"),
        ("Creator programs pricing/commerce", "API", "pending", "-", "Missing", "P2", "L", "CEOS-P05-T020"),
        ("Creator programs tests", "API", "done", "creator-programs.service.spec.ts", "-", "P0", "M", "CEOS-P03-T031"),
        ("Courses per creator CRUD", "API", "done", "courses.controller.ts", "-", "P1", "M"),
        ("Course cohorts schema", "API", "done", "1820000000000-courses-cohorts.ts", "-", "P1", "M"),
        ("Course lessons schema", "API", "done", "1827000000000-phase-b-schema.ts", "-", "P1", "M"),
        ("Course bind-community", "API", "done", "courses.service.ts bindCommunity", "-", "P1", "S"),
        ("Course studio web list/detail", "Web", "done", "studio/courses/", "-", "P1", "M", "-", "Frontend"),
        ("Course studio mobile list/detail", "Mobile", "done", "studio_courses_screen.dart", "-", "P1", "M", "-", "Mobile"),
        ("Course consumer viewer web", "Web", "done", "courses/[id]/page.tsx", "-", "P1", "M", "-", "Frontend"),
        ("Course consumer viewer mobile", "Mobile", "done", "course_viewer_screen.dart", "-", "P1", "M", "-", "Mobile"),
        ("Course public discovery/catalog", "API", "done", "GET courses/discover + creators/:id/courses", "-", "P1", "M"),
        ("Course discover web UI", "Web", "done", "discover/courses + CreatorCoursesPanel", "-", "P1", "M", "-", "Frontend"),
        ("Course discover mobile UI", "Mobile", "done", "discover_courses_screen.dart", "-", "P1", "M", "-", "Mobile"),
        ("Course video lessons", "API", "pending", "-", "Missing", "P2", "L"),
        ("Course quizzes/assignments", "API", "pending", "-", "Missing", "P3", "L"),
        ("Course certificates", "API", "pending", "-", "Missing", "P3", "M"),
        ("Membership products per creator", "API", "done", "entitlements.controller.ts tiers", "-", "P0", "M"),
        ("Creator bundles schema", "API", "done", "1831000000000-creator-bundles.ts", "-", "P1", "M"),
        ("Creator bundles studio web", "Web", "done", "studio/bundles/page.tsx", "-", "P1", "M", "-", "Frontend"),
        ("Creator bundles studio mobile (simplified)", "Mobile", "done", "studio_bundles_screen.dart", "-", "P1", "M", "-", "Mobile"),
        ("Live sessions per creator", "API", "done", "streaming.controller.ts", "-", "P1", "M"),
        ("Content library per creator", "API", "done", "GET /videos/studio paginated + filter(status/visibility/category) + title search + sort via studio-library-query.util (tested); web studio/videos search/sort/load-more", "-", "P2", "M"),
        ("Analytics per creator business API", "API", "done", "GET creators/me/business-analytics", "-", "P1", "M"),
        ("Programs in ecosystem tree", "API", "done", "communities.service.ts getCreatorEcosystemTree", "-", "P1", "S"),
        ("Cohort date fields utilized", "API", "done", "createCohort/updateCohort persist+validate startsAt/endsAt (end-after-start); enroll validates cohort belongs to course + rejects ended cohorts; PATCH cohort endpoint; web start/end inputs; tested", "-", "P2", "S"),
    ]
    for s in specs:
        items.append(t(3, n, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7] if len(s) > 7 else "-", s[8] if len(s) > 8 else "Backend"))
        n += 1
    return items

TASKS.extend(phase3())


def bulk(phase: int, start: int, rows: list[tuple]) -> list[Task]:
    out = []
    for i, row in enumerate(rows, start):
        out.append(t(phase, i, *row))
    return out


# ── Phase 4: Community 2.0/3.0 (85) ─────────────────────────────────────────
TASKS.extend(bulk(4, 1, [
    ("Communities schema (brands, slugs, settings)", "API", "done", "1800000000000-community-2-schema.ts", "-", "P0", "M"),
    ("Community discover featured API", "API", "done", "GET communities/discover/featured", "-", "P1", "S"),
    ("Community search API", "API", "done", "GET communities/search", "-", "P1", "S"),
    ("Community layout API", "API", "done", "GET communities/:id/layout", "-", "P1", "S"),
    ("Community access check API", "API", "done", "GET .../communities/:slug/access", "-", "P0", "M"),
    ("Community categories CRUD", "API", "done", "communities.controller.ts categories", "-", "P1", "M"),
    ("Legacy channels CRUD (deprecated path)", "API", "done", "Deprecation headers + 410 when flag on", "-", "P1", "M", "-", "Backend"),
    ("Channel messages API (legacy)", "API", "done", "Bridged to rooms + deprecation headers", "-", "P1", "M", "-", "Backend"),
    ("Mobile studio community channels removed", "Mobile", "done", "studio_community_screen uses rooms API", "-", "P1", "M", "-", "Mobile"),
    ("Rooms schema migration", "API", "done", "1832000000000-community-rooms.ts", "-", "P0", "M"),
    ("Room messages schema", "API", "done", "1833000000000-community-room-messages.ts", "-", "P0", "M"),
    ("Room members/session tokens", "API", "done", "1835000000000-community-members-session-token.ts", "-", "P1", "M"),
    ("Room category assignment", "API", "done", "1834000000000-community-room-category.ts", "-", "P1", "S"),
    ("Channel→room mapping entity", "API", "done", "channel-room-mapping.entity.ts", "-", "P0", "M"),
    ("Channel→room backfill migration", "API", "done", "1837100000000-channel-to-room-backfill.ts", "-", "P0", "L"),
    ("Channel migration service (idempotent)", "API", "done", "channel-migration.service.ts", "-", "P0", "L"),
    ("Channel migration tests", "API", "done", "channel-migration.service.spec.ts", "-", "P0", "M", "CEOS-P04-T016"),
    ("Lazy channel resolve on legacy access", "API", "done", "resolveRoomIdForChannel lazy map", "-", "P0", "M"),
    ("Deprecate legacy channel UI paths", "Web", "done", "studio/communities/[id] channels tab removed", "-", "P0", "M", "CEOS-P04-T016", "Frontend"),
    ("Rooms list/get API", "API", "done", "community-rooms.controller.ts", "-", "P0", "M"),
    ("Rooms studio CRUD", "API", "done", "POST/PATCH/DELETE creators/me/.../rooms", "-", "P0", "M"),
    ("Text room messages API", "API", "done", "community-rooms.controller.ts messages", "-", "P0", "M"),
    ("Text room web consumer UI", "Web", "done", "community/.../text/[roomId]/page.tsx", "-", "P0", "M", "-", "Frontend"),
    ("Text room mobile consumer UI", "Mobile", "done", "community_text_room_screen.dart", "-", "P0", "M", "-", "Mobile"),
    ("Voice room LiveKit token API", "API", "done", "POST .../rooms/:id/token", "-", "P0", "M"),
    ("Voice room web UI", "Web", "done", "community/.../voice/[roomId]/page.tsx", "-", "P0", "M", "-", "Frontend"),
    ("Voice room mobile UI", "Mobile", "done", "community_voice_room_screen.dart + stage raise-hand", "-", "P1", "M", "-", "Mobile"),
    ("Raise-hand stage API", "API", "done", "raise-hand endpoints", "-", "P1", "M"),
    ("Raise-hand web panel", "Web", "done", "CommunityStageRaiseHandPanel.tsx", "-", "P1", "M", "-", "Frontend"),
    ("Raise-hand mobile panel", "Mobile", "done", "community_stage_raise_hand_panel.dart", "-", "P1", "M", "CEOS-P04-T029", "Mobile"),
    ("Room RBAC permissions API", "API", "done", "room permissions endpoints", "-", "P0", "M"),
    ("Room permissions service tests", "API", "done", "community-room-permissions.service.spec.ts", "-", "P1", "S"),
    ("Studio rooms panel web", "Web", "done", "StudioRoomsPanel.tsx", "-", "P1", "M", "-", "Frontend"),
    ("Studio rooms screen mobile", "Mobile", "done", "studio_rooms_screen.dart", "-", "P1", "M", "-", "Mobile"),
    ("Community posts schema", "API", "done", "1810000000000-community-posts.ts", "-", "P1", "M"),
    ("Community posts CRUD API", "API", "done", "community-posts.controller.ts", "-", "P1", "M"),
    ("Post comments API", "API", "done", "post comments endpoints", "-", "P1", "M"),
    ("Post reactions API", "API", "done", "POST .../reactions", "-", "P1", "S"),
    ("Post media upload presign", "API", "done", "posts/media-upload-url", "-", "P1", "M"),
    ("Post pin API", "API", "done", "POST .../pin", "-", "P2", "S"),
    ("Posts consumer web tab", "Web", "done", "CommunityPanel.tsx posts tab", "-", "P1", "M", "-", "Frontend"),
    ("Posts consumer mobile tab", "Mobile", "done", "community_screen.dart", "-", "P1", "M", "-", "Mobile"),
    ("Community polls schema", "API", "done", "1823000000000-community-polls.ts", "-", "P1", "M"),
    ("Polls vote/close API", "API", "done", "community-polls.controller.ts", "-", "P1", "M"),
    ("Polls consumer web/mobile", "Web", "done", "CommunityPanel polls tab", "-", "P1", "S", "-", "Frontend"),
    ("Community events schema", "API", "done", "community-event.entity.ts", "-", "P0", "M"),
    ("Event recurrence migration", "API", "done", "1837300000000-community-event-recurrence.ts", "-", "P0", "M"),
    ("Event recurrence util tests", "API", "done", "community-event-recurrence.util.spec.ts", "-", "P1", "S"),
    ("Events list/create API", "API", "done", "community-events.controller.ts", "-", "P0", "M"),
    ("Events RSVP API", "API", "done", "POST .../rsvp", "-", "P0", "M"),
    ("Events RSVP admin list API", "API", "done", "GET .../rsvps", "-", "P1", "M"),
    ("Events update/delete API", "API", "done", "PATCH/DELETE events", "-", "P0", "M"),
    ("Events service tests", "API", "done", "community-events.service.spec.ts", "-", "P0", "M", "CEOS-P04-T052"),
    ("Events consumer engage web", "Web", "done", "CommunityEngagePanel.tsx events", "-", "P1", "M", "-", "Frontend"),
    ("Events consumer engage mobile", "Mobile", "done", "community_screen.dart events", "-", "P1", "M", "-", "Mobile"),
    ("Events studio web panel", "Web", "done", "StudioCommunityEventsPanel.tsx", "-", "P0", "M", "-", "Frontend"),
    ("Events studio mobile admin", "Mobile", "done", "studio_engagement_screen.dart events", "-", "P0", "M", "CEOS-P04-T057", "Mobile"),
    ("Members join-request API", "API", "done", "community-members.controller.ts", "-", "P0", "M"),
    ("Members approve/reject/suspend", "API", "done", "members PATCH endpoints", "-", "P0", "M"),
    ("Members export API", "API", "done", "members export endpoint", "-", "P1", "S"),
    ("Members studio web panel", "Web", "done", "StudioCommunityMembersPanel.tsx", "-", "P1", "M", "-", "Frontend"),
    ("Members studio mobile", "Mobile", "done", "studio_community_screen.dart member roster + CSV export", "-", "P1", "M", "-", "Mobile"),
    ("Moderation reports API", "API", "done", "community-moderation.controller.ts", "-", "P0", "M"),
    ("Reports room_id migration", "API", "done", "1837200000000-community-reports-room-id.ts", "-", "P0", "S"),
    ("Moderation bans/roles API", "API", "done", "bans/roles endpoints", "-", "P0", "M"),
    ("Moderation inbox API", "API", "done", "GET creators/me/moderation/inbox", "-", "P1", "M"),
    ("Moderation studio web hub", "Web", "done", "studio/moderation/", "-", "P1", "M", "-", "Frontend"),
    ("Moderation studio mobile", "Mobile", "done", "studio_moderation_screen.dart", "-", "P1", "M", "-", "Mobile"),
    ("Wiki/challenges/surveys API", "API", "done", "community-engagement.controller.ts", "-", "P1", "M"),
    ("Engagement studio web panel", "Web", "done", "community detail engagement tab", "-", "P1", "M", "-", "Frontend"),
    ("Engagement studio mobile", "Mobile", "done", "studio_engagement_screen.dart", "-", "P1", "M", "-", "Mobile"),
    ("Community welcome modal web", "Web", "done", "CommunityWelcomeModal.tsx", "-", "P2", "S", "-", "Frontend"),
    ("Discover communities web", "Web", "done", "discover/communities/page.tsx", "-", "P1", "M", "-", "Frontend"),
    ("Discover communities mobile", "Mobile", "done", "discover_communities_screen.dart", "-", "P1", "M", "-", "Mobile"),
    ("Community analytics API", "API", "done", "GET .../analytics", "-", "P1", "M"),
    ("Community trends chart web", "Web", "done", "CommunityTrendsChart.tsx", "-", "P2", "M", "-", "Frontend"),
    ("Permission matrix API", "API", "done", "GET .../permissions/matrix", "-", "P0", "M"),
    ("Permission matrix doc", "Docs", "done", "docs/COMMUNITY-PERMISSION-MATRIX.md", "-", "P1", "S"),
    ("Paid community access gating", "API", "done", "entitlements + community access", "-", "P0", "M"),
    ("Invite-only community join flow", "API", "done", "join-request flow", "-", "P1", "M"),
    ("Course-linked community", "API", "done", "courses bind-community", "-", "P1", "M"),
    ("Cohort community type", "API", "pending", "-", "Missing", "P2", "M"),
    ("Event community type", "API", "review", "events in communities", "Partial", "P2", "M"),
    ("Community HTTP e2e tests", "API", "done", "community-http.e2e-spec.ts", "-", "P1", "M"),
    ("Smoke community 2.0 script", "Infra", "done", "scripts/smoke-community-2.0.sh", "-", "P1", "S", "-", "Platform"),
    ("Community activity notify listener", "API", "done", "community-activity-notify.listener.ts — scoped to broadcast events, paginated + batched fan-out, off request path", "-", "P1", "M"),
    ("Community moderation async worker", "Worker", "done", "community-moderation.worker.ts", "-", "P1", "M"),
    ("Community announcement notify worker", "Worker", "done", "community-announcement-notify.worker.ts", "-", "P1", "M"),
    ("Thread/nested comment model (rooms)", "API", "done", "parentMessageId entity + list/send", "-", "P0", "M", "-", "Backend"),
    ("Knowledge base (wiki)", "API", "done", "engagement wiki endpoints", "-", "P1", "M"),
]))

# ── Phase 5: Membership & Entitlements (55) ───────────────────────────────────
TASKS.extend(bulk(5, 1, [
    ("subscription_tiers schema", "API", "done", "1750000000000-live-subs-community.ts", "-", "P0", "M"),
    ("member_subscriptions schema", "API", "done", "1750000000000-live-subs-community.ts", "-", "P0", "M"),
    ("tier_entitlements schema", "API", "done", "1800000000000-community-2-schema.ts", "-", "P0", "M"),
    ("Stripe subscription source enum", "API", "done", "1780000000000-add-stripe-subscription-source.ts", "-", "P0", "S"),
    ("Community-scoped subscription column", "API", "done", "1836000000000-member-subscription-community-id.ts", "-", "P0", "M"),
    ("Active subscription unique constraint", "API", "done", "1837000000000-member-subscription-active-unique.ts", "-", "P0", "S"),
    ("Tier device limits column", "API", "done", "1828000000000-tier-device-limits.ts", "-", "P0", "S"),
    ("Public tiers list API", "API", "done", "GET creators/:id/tiers", "-", "P0", "S"),
    ("Creator tier CRUD API", "API", "done", "creators/me/tiers", "-", "P0", "M"),
    ("Tier entitlements CRUD", "API", "done", "entitlements per tier", "-", "P0", "M"),
    ("Stripe price sync on tier save", "API", "done", "stripe-tier-sync.service.ts", "-", "P0", "M"),
    ("Stripe price sync tests", "API", "done", "stripe-tier-sync.service.spec.ts (18 tests)", "-", "P1", "M"),
    ("Membership me API", "API", "done", "GET creators/:id/membership/me", "-", "P0", "S"),
    ("Subscriptions me API", "API", "done", "GET subscriptions/me", "-", "P0", "S"),
    ("Mock subscription join", "API", "done", "POST subscriptions/mock", "-", "P1", "S"),
    ("Subscription cancel API", "API", "done", "DELETE subscriptions/me/:creatorId", "-", "P0", "M"),
    ("Stripe checkout recurring API", "API", "done", "POST billing/checkout", "-", "P0", "M"),
    ("Stripe checkout paid event API", "API", "done", "POST billing/checkout/event", "-", "P1", "M"),
    ("Stripe webhook idempotency", "API", "done", "billing.service.ts webhook", "-", "P0", "M"),
    ("Stripe Connect onboard API", "API", "done", "POST billing/connect/onboard", "-", "P0", "M"),
    ("Stripe Connect status API", "API", "done", "GET billing/connect/status", "-", "P0", "S"),
    ("Stripe billing portal API", "API", "done", "POST billing/portal", "-", "P0", "M"),
    ("Tier change API (proration)", "API", "done", "subscription-change.service.ts", "-", "P0", "M"),
    ("Tier change tests", "API", "done", "subscription-change.service.spec.ts", "-", "P1", "S"),
    ("Billing stub provider default", "API", "done", "billingProviderFactory fail-fast: real prod (mockSubscriptions=false) requires BILLING_PROVIDER=stripe + STRIPE_SECRET_KEY", "-", "P1", "S"),
    ("Production Stripe enablement runbook", "Docs", "done", "docs/operations/STRIPE_PRODUCTION_ENABLEMENT.md + set-stripe-secrets-fly.sh", "-", "P1", "M", "-", "Platform"),
    ("Destination charges Connect model", "API", "done", "MEMBERSHIPS.md", "-", "P0", "M"),
    ("Platform fee percent config", "API", "done", "STRIPE_PLATFORM_FEE_PERCENT", "-", "P1", "S"),
    ("Creator bundles CRUD API", "API", "done", "creator-bundles.service.ts", "-", "P1", "M"),
    ("Creator bundles tests", "API", "done", "creator-bundles.service.spec.ts", "-", "P1", "S"),
    ("Entitlements batch access check", "API", "done", "entitlements.service.ts", "-", "P0", "M"),
    ("Entitlements Redis cache", "API", "done", "entitlements.service.ts cache", "-", "P1", "M"),
    ("Entitlements service tests", "API", "done", "entitlements.service.spec.ts", "-", "P1", "M"),
    ("Gate VOD by tier", "API", "done", "content playback entitlements", "-", "P0", "M"),
    ("Gate live by tier", "API", "done", "streaming entitlements", "-", "P0", "M"),
    ("Gate community by tier", "API", "done", "community access listener", "-", "P0", "M"),
    ("Gate course by tier", "API", "done", "courses.service.ts enroll", "-", "P0", "M"),
    ("Subscriber list API", "API", "done", "creators/me/subscribers", "-", "P1", "M"),
    ("Subscriber analytics API", "API", "done", "subscribers/analytics MRR", "-", "P1", "M"),
    ("Subscriber grant API", "API", "done", "admin/creator grant", "-", "P1", "M"),
    ("Subscriber suspend API", "API", "done", "suspend endpoint", "-", "P1", "M"),
    ("Subscriber export API", "API", "done", "export CSV (hardened via injection-safe csv.util)", "-", "P1", "S"),
    ("Studio tiers web UI", "Web", "done", "studio/tiers/page.tsx", "-", "P0", "M", "-", "Frontend"),
    ("Studio tiers mobile UI", "Mobile", "done", "studio_tiers_screen.dart", "-", "P0", "M", "-", "Mobile"),
    ("Membership panel web checkout", "Web", "done", "MembershipPanel.tsx", "-", "P0", "M", "-", "Frontend"),
    ("Membership panel mobile checkout", "Mobile", "done", "membership_panel.dart launches checkoutUrl; surfaces DioException server message; mock only on stub no-url", "-", "P1", "M", "-", "Mobile"),
    ("My memberships settings web", "Web", "done", "settings/memberships/page.tsx", "-", "P0", "M", "-", "Frontend"),
    ("My memberships settings mobile", "Mobile", "done", "my_memberships_screen.dart", "-", "P0", "M", "-", "Mobile"),
    ("Subscription maintenance worker", "Worker", "done", "subscription-maintenance worker", "-", "P0", "M"),
    ("Trial lifecycle state machine", "API", "done", "expireDueSubscriptions+getExpiringSubscriptions cover TRIAL; worker safety-net trial->expired; trial-ending reminders", "-", "P2", "L"),
    ("Pause/grace period states", "API", "done", "grace_period/paused/renewal_pending/failed_payment set via Stripe webhooks; renewal_pending added to expiry safety-net; grace_period excluded to preserve dunning window", "-", "P2", "L"),
    ("Seat-limited access model", "API", "pending", "-", "Missing", "P3", "L"),
    ("Lifetime access SKU", "API", "pending", "-", "Missing", "P3", "M"),
    ("Bundle access evaluation", "API", "done", "creator bundles entitlements", "-", "P1", "M"),
    ("Upgrade/downgrade UX flows", "Web", "done", "settings/memberships TierChangeSelect: checkoutUrl redirect, proration-accurate copy, error surfacing, sorted upgrade/downgrade labels", "-", "P1", "M", "-", "Frontend"),
    ("Smoke memberships script", "Infra", "done", "scripts/smoke-memberships.sh", "-", "P1", "S", "-", "Platform"),
]))

# ── Phase 6: Unified Content (45) ───────────────────────────────────────────
TASKS.extend(bulk(6, 1, [
    ("Videos VOD upload multipart", "API", "done", "videos.controller.ts multipart", "-", "P0", "M"),
    ("Mux VOD transcode pipeline", "Worker", "done", "mux-vod-ingest worker", "-", "P0", "M"),
    ("FFmpeg transcode pipeline (optional)", "Worker", "done", "video-processing worker", "-", "P2", "M"),
    ("Video visibility tiers", "API", "done", "ContentVisibility enum", "-", "P0", "M"),
    ("Video skill tags", "API", "done", "video_skill_tags", "-", "P1", "S"),
    ("Video studio CRUD web", "Web", "done", "studio/videos/", "-", "P0", "M", "-", "Frontend"),
    ("Video upload wizard web (3-step)", "Web", "done", "upload/step/[step]", "-", "P1", "M", "-", "Frontend"),
    ("Video upload mobile (single screen)", "Mobile", "done", "upload_screen.dart + upload_repository.dart send required visibility/categoryId/skillTagIds to /videos/:id/complete", "-", "P1", "M", "-", "Mobile"),
    ("Watch page web", "Web", "done", "watch/[id]/page.tsx", "-", "P0", "M", "-", "Frontend"),
    ("Watch page mobile", "Mobile", "done", "watch_screen.dart", "-", "P0", "M", "-", "Mobile"),
    ("Feed latest/popular/forYou API", "API", "done", "feed.controller.ts", "-", "P0", "M"),
    ("Following feed API", "API", "done", "GET feed/following", "-", "P1", "M"),
    ("Feed web home", "Web", "done", "page.tsx HomePageContent", "-", "P0", "M", "-", "Frontend"),
    ("Feed mobile", "Mobile", "done", "feed_screen.dart", "-", "P0", "M", "-", "Mobile"),
    ("Explore/search web", "Web", "done", "explore/, search/", "-", "P1", "M", "-", "Frontend"),
    ("Explore + dedicated search route mobile", "Mobile", "done", "explore_screen.dart (debounced FTS search of videos+creators, category chips, disciplines grid, empty/error states) + dedicated /search GoRoute (autofocus, deep-linkable ?q=) reusing ExploreScreen; feed app-bar search icon now opens search-first /search via context.push", "-", "P2", "S", "-", "Mobile"),
    ("Postgres FTS search API", "API", "done", "search.controller.ts", "-", "P1", "M"),
    ("Search suggestions API", "API", "done", "GET search/suggestions", "-", "P2", "S"),
    ("Search module tests", "API", "done", "search.service + search.controller specs (12 tests)", "-", "P1", "M"),
    ("Feed module tests", "API", "done", "feed.service + feed-query.util + feed.controller specs (18 tests)", "-", "P1", "M"),
    ("Playlists CRUD API", "API", "done", "playlists.controller.ts; fixed GET /playlists/me to pass viewerId so owners see their own private playlists", "-", "P2", "M"),
    ("Playlists web UI", "Web", "done", "playlists/", "-", "P2", "M", "-", "Frontend"),
    ("Playlists mobile UI", "Mobile", "done", "PlaylistsScreen (list+create) + PlaylistDetailScreen (view/remove/watch); /playlists routes; Library hub entry", "-", "P2", "M", "-", "Mobile"),
    ("Shorts content type", "API", "pending", "-", "Missing", "P2", "L"),
    ("Articles content type", "API", "pending", "-", "Missing", "P3", "L"),
    ("Announcements (community)", "API", "done", "engagement announcements", "-", "P1", "M"),
    ("Podcasts content type", "API", "pending", "-", "Missing", "P3", "XL"),
    ("Downloads/resources library", "API", "pending", "-", "Missing", "P2", "L"),
    ("Polls (video + community + live)", "API", "done", "multiple poll modules", "-", "P1", "M"),
    ("Q&A sessions content type", "API", "pending", "-", "Missing", "P3", "L"),
    ("Assignments/challenges (course)", "API", "pending", "-", "Missing", "P3", "L"),
    ("Content tagging system", "API", "done", "Full skill-tag lifecycle: controlled taxonomy (categories/:id/skill-tags, upload-options), AI suggest-tags, denormalized tags_search_text feeding GENERATED search_vector (FTS A/B/C weights, GIN), tag-based discovery (feed by-skills + search FTS), clickable tag landing pages (web /explore/skills/[slug]), and now POST-publish re-tagging via PATCH /videos/:id skillTagIds (category-consistency validated, tags_search_text recomputed) + web Studio tag editor; videos.tag-edit.spec covers it", "-", "P2", "M"),
    ("Content visibility discovery rules", "API", "done", "users.service.getUserVideos restricts non-owner listings to VideoVisibility.PUBLIC (UNLISTED is link-only), aligned with feed discovery contract", "-", "P1", "M"),
    ("Recommendations engine", "API", "pending", "-", "Missing", "P2", "XL"),
    ("Premium content notify worker", "Worker", "done", "premium-content-notify worker", "-", "P1", "M"),
    ("View count Redis flush", "API", "done", "ViewCountFlushService", "-", "P1", "M"),
    ("Watch history API", "API", "done", "GET me/watch-history", "-", "P1", "M"),
    ("Library web UI", "Web", "done", "library/page.tsx", "-", "P1", "M", "-", "Frontend"),
    ("Library mobile UI", "Mobile", "done", "library_screen.dart", "-", "P1", "M", "-", "Mobile"),
    ("History web/mobile", "Web", "done", "history routes", "-", "P2", "S", "-", "Frontend"),
    ("Categories taxonomy API", "API", "done", "categories.controller.ts", "-", "P1", "M"),
    ("Categories admin CRUD", "Admin", "done", "admin/categories", "-", "P1", "M", "-", "Frontend"),
    ("Content moderation (video)", "Admin", "done", "admin/content", "-", "P1", "M", "-", "Frontend"),
    ("Unified content library UX (Netflix-style)", "Web", "pending", "-", "Missing", "P3", "XL", "-", "Frontend"),
    ("Semantic search / RAG", "API", "blocked", "F-1302 + AI strategy", "Missing", "P3", "XL"),
]))

# ── Phase 7: Live Community Ecosystem (40) ───────────────────────────────────
TASKS.extend(bulk(7, 1, [
    ("Mux live stream start/end API", "API", "done", "streaming.controller.ts", "-", "P0", "M"),
    ("Live list/upcoming API + cache", "API", "done", "streaming.service.ts Redis", "-", "P0", "M"),
    ("Live web list/watch", "Web", "done", "live/, live/[id]/", "-", "P0", "M", "-", "Frontend"),
    ("Live mobile list/watch", "Mobile", "done", "live_screen.dart", "-", "P0", "M", "-", "Mobile"),
    ("Stream chat API", "API", "done", "stream-chat.controller.ts", "-", "P0", "M"),
    ("Stream chat async ingest worker", "Worker", "done", "stream-chat-ingest worker", "-", "P1", "M"),
    ("Live chat AI moderation (OpenAI)", "API", "done", "ai-moderation.util.ts", "-", "P0", "M"),
    ("Super chat API", "API", "done", "POST super-chat", "-", "P1", "M"),
    ("Stream slow mode / ban / timeout", "API", "done", "stream-chat moderation", "-", "P0", "M"),
    ("Pinned messages live chat", "API", "done", "PATCH pin", "-", "P1", "S"),
    ("Live polls API", "API", "done", "stream polls endpoints", "-", "P1", "M"),
    ("Live reactions Redis API", "API", "done", "GET streams/:id/reactions", "-", "P1", "M"),
    ("Live reactions web panel", "Web", "done", "StreamReactionPanel.tsx", "-", "P1", "M", "-", "Frontend"),
    ("Live reactions mobile", "Mobile", "done", "live watch reactions", "-", "P1", "M", "-", "Mobile"),
    ("RSVP reminders worker", "Worker", "done", "stream-reminder worker", "-", "P1", "M"),
    ("Paid live event checkout", "API", "done", "billing/checkout/event", "-", "P1", "M"),
    ("Stream replay access", "API", "done", "GET :id/replay", "-", "P1", "M"),
    ("LiveKit browser go-live", "API", "done", "live-broadcast.controller.ts", "-", "P1", "M"),
    ("Studio go-live web", "Web", "done", "studio/live/page.tsx", "-", "P1", "M", "-", "Frontend"),
    ("Studio go-live mobile", "Mobile", "done", "studio_live_screen.dart", "-", "P1", "M", "-", "Mobile"),
    ("Stream analytics creator API", "API", "done", "stream-analytics.controller.ts", "-", "P1", "M"),
    ("Stream host health dashboard web", "Web", "done", "StreamHostDashboard.tsx", "-", "P1", "M", "-", "Frontend"),
    ("Mux webhook handler", "API", "done", "POST webhooks/mux", "-", "P0", "M"),
    ("Mux sync worker idle-gate", "Worker", "done", "mux-live-sync.service.ts", "-", "P1", "M"),
    ("Socket viewer counts", "API", "done", "events.gateway.ts", "-", "P0", "M"),
    ("Stage mode (voice rooms)", "API", "done", "raise-hand approve flow", "-", "P1", "M"),
    ("Audience requests live", "API", "pending", "-", "Missing", "P3", "M"),
    ("Breakout rooms", "API", "pending", "-", "Missing", "P3", "XL"),
    ("Multi-host live", "API", "pending", "-", "Missing", "P3", "L"),
    ("VIP rooms live", "API", "pending", "-", "Missing", "P3", "L"),
    ("Guest speakers live", "API", "pending", "-", "Missing", "P3", "M"),
    ("After-live discussion rooms", "API", "done", "AfterLiveRoomListener on stream.ended auto-provisions a TEXT community room (CommunityRoomsService.ensureAfterLiveRoom, idempotent via settings.sourceStreamId); reuses room messaging/perms/sockets; specs", "-", "P2", "M"),
    ("Live Q&A mode", "API", "done", "streams/:id/qa submit/list/upvote(toggle)/status; reuses stream_messages (message_type=question) + entitlement/ban/profanity/AI/rate-limit guards; Redis-deduped upvotes; stream.qa.* realtime; migration 1837500000000; stream-chat.service.spec (7 cases)", "-", "P2", "M"),
    ("Live Q&A web UI", "Web", "done", "StreamQaPanel on live/[id] (submit/upvote/host status) + STREAM_QA_* socket events", "-", "P2", "S", "-", "Frontend"),
    ("Live Q&A mobile UI", "Mobile", "done", "stream_qa_panel.dart on live_watch_screen (submit/upvote/host status, socket refresh)", "-", "P2", "S", "-", "Mobile"),
    ("Live summaries (AI)", "API", "pending", "AI-LLM-STRATEGY.md", "Missing", "P2", "L"),
    ("Clips API", "API", "done", "stream clips endpoints", "-", "P2", "M"),
    ("Captions API", "API", "done", "GET :id/captions", "-", "P2", "S"),
    ("Admin live moderation", "Admin", "done", "admin/live", "-", "P1", "M", "-", "Frontend"),
    ("Live deploy runbook", "Docs", "done", "docs/LIVE.md", "-", "P1", "S"),
    ("100K concurrent live viewers scale design", "Docs", "pending", "-", "Missing", "P3", "XL", "-", "Platform"),
    ("Live community cross-link (community live tab)", "API", "done", "GET communities/:id/live", "-", "P2", "M"),
]))

# ── Phase 8: Account Sharing Prevention (25) ─────────────────────────────────
TASKS.extend(bulk(8, 1, [
    ("Access sessions Redis store", "API", "done", "access-sessions.service.ts", "-", "P0", "M"),
    ("Access session start API", "API", "done", "POST access-sessions/start", "-", "P0", "M"),
    ("Access session heartbeat API", "API", "done", "POST access-sessions/heartbeat", "-", "P0", "S"),
    ("Access session end API", "API", "done", "DELETE access-sessions/current", "-", "P0", "S"),
    ("Access session list me API", "API", "done", "GET access-sessions/me", "-", "P1", "S"),
    ("Device fingerprint tracking", "API", "done", "access session device fp", "-", "P0", "M"),
    ("Tier max_concurrent_devices", "API", "done", "subscription_tiers column", "-", "P0", "M"),
    ("One premium session default", "API", "done", "access-sessions conflict", "-", "P0", "M"),
    ("Creator-scoped device cap", "API", "done", "creatorId on start", "-", "P1", "M"),
    ("Access session audit trail", "API", "done", "access_session_audit entity", "-", "P1", "M"),
    ("Access session service tests", "API", "done", "access-sessions.service.spec.ts", "-", "P1", "M"),
    ("Course viewer access session web", "Web", "done", "courses/[id] conflict handling", "-", "P1", "M", "-", "Frontend"),
    ("JWT refresh rotation", "API", "done", "auth.service.ts refresh", "-", "P0", "M"),
    ("Session list/revoke API", "API", "done", "GET/DELETE auth/sessions", "-", "P0", "M"),
    ("Login history API", "API", "done", "GET auth/login-history", "-", "P1", "S"),
    ("Device token registry (FCM)", "API", "done", "notifications devices", "-", "P1", "M"),
    ("Device revocation API", "API", "done", "DELETE devices", "-", "P1", "S"),
    ("Concurrent session detection", "API", "done", "access-sessions.service.ts: per-tier device limits, fingerprinting, force-takeover, heartbeats across all premium surfaces (geo-anomaly/fraud tracked separately as P3)", "-", "P1", "M"),
    ("Geo anomaly detection", "API", "pending", "-", "Missing", "P3", "L"),
    ("Suspicious login detection", "API", "pending", "-", "Missing", "P3", "L"),
    ("Fraud detection rules engine", "API", "pending", "-", "Missing", "P3", "XL"),
    ("Token invalidation on password reset", "API", "done", "auth reset flow", "-", "P0", "M"),
    ("Account lockout brute force", "API", "done", "auth-account-lockout.service.ts", "-", "P0", "M"),
    ("Impersonate admin audit", "API", "done", "admin impersonate + audit log", "-", "P1", "M"),
    ("Device limits smoke in community script", "Infra", "done", "smoke-community-2.0.sh", "-", "P1", "S", "-", "Platform"),
]))

# ── Phase 9: Creator Management (35) ─────────────────────────────────────────
TASKS.extend(bulk(9, 1, [
    ("Creator approval workflow API", "API", "done", "POST me/request-creator", "-", "P0", "M"),
    ("Admin creator approvals UI", "Admin", "done", "creator-approvals/", "-", "P0", "M", "-", "Frontend"),
    ("Studio hub web (14 tools)", "Web", "done", "studio/page.tsx", "-", "P0", "M", "-", "Frontend"),
    ("Studio hub mobile", "Mobile", "done", "studio_screen.dart", "-", "P0", "M", "-", "Mobile"),
    ("Manage members (community)", "API", "done", "community-members", "-", "P0", "M"),
    ("Manage moderators (roles)", "API", "done", "community roles", "-", "P0", "M"),
    ("Manage communities studio", "Web", "done", "studio/communities/", "-", "P0", "M", "-", "Frontend"),
    ("Manage content (videos studio)", "Web", "done", "studio/videos/", "-", "P0", "M", "-", "Frontend"),
    ("Manage courses studio", "Web", "done", "studio/courses/", "-", "P1", "M", "-", "Frontend"),
    ("Manage events studio", "Web", "done", "StudioCommunityEventsPanel", "-", "P0", "M", "-", "Frontend"),
    ("Manage live sessions studio", "Web", "done", "studio/live/", "-", "P1", "M", "-", "Frontend"),
    ("Manage memberships/tiers studio", "Web", "done", "studio/tiers/", "-", "P0", "M", "-", "Frontend"),
    ("Export member data API", "API", "done", "members export (hardened via injection-safe csv.util)", "-", "P1", "M"),
    ("Export member data web", "Web", "done", "StudioCommunityMembersPanel export", "-", "P1", "S", "-", "Frontend"),
    ("View analytics studio web", "Web", "done", "studio/analytics/", "-", "P1", "M", "-", "Frontend"),
    ("View analytics studio mobile", "Mobile", "done", "studio_analytics_screen.dart: views/likes/published, top lessons, membership MRR, engagement funnel, weekly/monthly cohort retention, CSV export — wired to /creators/me/business-analytics", "-", "P1", "M", "-", "Mobile"),
    ("Business analytics funnel API", "API", "done", "creators/me/business-analytics", "-", "P1", "M"),
    ("Creator funnel chart web", "Web", "done", "CreatorFunnelChart.tsx", "-", "P2", "M", "-", "Frontend"),
    ("Subscriber picker component", "Web", "done", "SubscriberPicker.tsx", "-", "P2", "S", "-", "Frontend"),
    ("Studio comments moderation", "Web", "done", "studio/comments/", "-", "P1", "M", "-", "Frontend"),
    ("Studio settings web/mobile", "Web", "done", "studio/settings/", "-", "P1", "S", "-", "Frontend"),
    ("Creator audit logs API", "API", "done", "creator-audit.service.ts", "-", "P1", "M"),
    ("Creator audit logs tests", "API", "done", "creator-audit.service.spec.ts", "-", "P1", "S"),
    ("Admin user hub impersonate", "Admin", "done", "users/[id] impersonate", "-", "P1", "M", "-", "Frontend"),
    ("Admin grant subscription", "Admin", "done", "POST admin/subscriptions/grant", "-", "P1", "M", "-", "Frontend"),
    ("Admin community page", "Admin", "done", "admin/community", "-", "P2", "M", "-", "Frontend"),
    ("Creator copilot service", "API", "review", "creator-copilot.service.ts", "Partial", "P2", "M"),
    ("Studio creator ops AI panel", "Web", "review", "StudioCreatorOpsPanel.tsx", "Partial", "P2", "M", "-", "Frontend"),
    ("Unified studio community detail web", "Web", "done", "studio/communities/[id]/", "-", "P1", "M", "-", "Frontend"),
    ("Fragmented studio community mobile", "Mobile", "done", "studio_community_screen.dart tabbed hub", "-", "P1", "M", "-", "Mobile"),
    ("Programs management web", "Web", "done", "studio/programs/", "-", "P0", "M", "-", "Frontend"),
    ("Bundles management web", "Web", "done", "studio/bundles/", "-", "P1", "M", "-", "Frontend"),
    ("Subscribers management web", "Web", "done", "studio/subscribers/", "-", "P1", "M", "-", "Frontend"),
    ("Subscribers CSV export mobile", "Mobile", "done", "studio_subscribers_screen.dart + csv_export_util.dart", "-", "P2", "S", "-", "Mobile"),
    ("Creator onboarding flow web", "Web", "done", "upload/become-creator", "-", "P1", "M", "-", "Frontend"),
]))

# ── Phase 10: Community Engagement Engine (40) ───────────────────────────────
TASKS.extend(bulk(10, 1, [
    ("Nested post comments", "API", "done", "community post comments", "-", "P1", "M"),
    ("Room message threads", "API", "done", "API + web + mobile reply UI", "-", "P0", "M", "-", "Backend"),
    ("Knowledge base wiki", "API", "done", "engagement wiki", "-", "P1", "M"),
    ("Community wiki web engage tab", "Web", "done", "CommunityEngagePanel wiki", "-", "P1", "M", "-", "Frontend"),
    ("Announcements engagement", "API", "done", "engagement announcements", "-", "P1", "M"),
    ("Polls engagement loop", "API", "done", "community polls", "-", "P1", "M"),
    ("Surveys engagement", "API", "done", "engagement surveys", "-", "P1", "M"),
    ("Challenges engagement", "API", "done", "engagement challenges", "-", "P1", "M"),
    ("Events/meetups calendar", "API", "done", "community events", "-", "P1", "M"),
    ("Study groups", "API", "pending", "-", "Missing", "P3", "L"),
    ("Accountability groups", "API", "pending", "-", "Missing", "P3", "L"),
    ("Office hours scheduling", "API", "pending", "-", "Missing", "P3", "L"),
    ("Mentorship matching", "API", "pending", "-", "Missing", "P3", "XL"),
    ("Daily engagement loops (product)", "Product", "pending", "-", "Missing", "P2", "L", "-", "Product"),
    ("Weekly engagement loops", "Product", "pending", "-", "Missing", "P2", "L", "-", "Product"),
    ("Monthly retention loops", "Product", "pending", "-", "Missing", "P2", "L", "-", "Product"),
    ("Long-term retention loops", "Product", "pending", "-", "Missing", "P3", "XL", "-", "Product"),
    ("Community posts search", "API", "done", "GET posts/search", "-", "P2", "M"),
    ("Post reactions", "API", "done", "post reactions endpoint", "-", "P1", "S"),
    ("Gamification check-in API", "API", "done", "gamification check-in", "-", "P1", "M"),
    ("Leaderboard community tab web", "Web", "done", "CommunityPanel leaderboard", "-", "P1", "M", "-", "Frontend"),
    ("Leaderboard mobile", "Mobile", "done", "community_screen leaderboard", "-", "P1", "M", "-", "Mobile"),
    ("Notifications social triggers", "API", "done", "notifications.service.ts", "-", "P1", "M"),
    ("Push dispatch worker", "Worker", "done", "push-dispatch worker", "-", "P1", "M"),
    ("Community announcement push", "API", "done", "community-announcement-notify", "-", "P1", "M"),
    ("Email verify engagement gate", "API", "done", "EmailVerifiedGuard", "-", "P0", "M"),
    ("Member onboarding welcome web", "Web", "done", "CommunityWelcomeModal", "-", "P2", "S", "-", "Frontend"),
    ("Member onboarding welcome mobile", "Mobile", "done", "community_welcome_dialog.dart — once-per-community, persisted via FlutterSecureStorage, non-creator members", "-", "P2", "S", "-", "Mobile"),
    ("Discovery conversion (featured)", "Web", "done", "discover/communities featured", "-", "P1", "M", "-", "Frontend"),
    ("Join request conversion flow", "API", "done", "join-request + approve", "-", "P1", "M"),
    ("Engagement reconciliation worker", "Worker", "done", "engagement-reconciliation", "-", "P1", "M"),
    ("Direct messages engagement", "API", "done", "direct-messages module", "-", "P1", "M"),
    ("DM web inbox", "Web", "done", "messages/page.tsx", "-", "P1", "M", "-", "Frontend"),
    ("DM mobile inbox", "Mobile", "done", "messages_screen.dart", "-", "P1", "M", "-", "Mobile"),
    ("DM read receipts", "API", "done", "POST conversations/:id/read", "-", "P1", "S"),
    ("Group DM channels", "API", "pending", "-", "Missing", "P3", "L"),
    ("Creator updates feed", "API", "done", "GET me/community-updates aggregates ANNOUNCEMENT posts across active memberships (access-safe); web /updates page; community-posts.service.spec", "-", "P2", "M"),
    ("Creator updates feed (mobile)", "Mobile", "done", "CommunityUpdatesScreen + /updates route (cursor-paginated, ForgeCard/EmptyState); Library hub entry; web TopBar link", "-", "P2", "S"),
    ("Community growth analytics", "API", "review", "community analytics API", "Partial", "P2", "M"),
    ("Load test community script", "Infra", "done", "scripts/load-test-community.sh", "-", "P2", "S", "-", "Platform"),
    ("Engagement service tests", "API", "done", "community-engagement.service.spec.ts", "-", "P1", "S"),
]))

# ── Phase 11: Gamification & Loyalty (25) ─────────────────────────────────────
TASKS.extend(bulk(11, 1, [
    ("member_xp schema", "API", "done", "1821000000000-gamification.ts", "-", "P1", "M"),
    ("member_badges schema", "API", "done", "1821000000000-gamification.ts", "-", "P1", "M"),
    ("XP award API", "API", "done", "gamification.service.ts", "-", "P1", "M"),
    ("Leaderboard API", "API", "done", "GET gamification/leaderboard", "-", "P1", "M"),
    ("Check-in streak API", "API", "done", "gamification check-in", "-", "P1", "M"),
    ("Badges list API", "API", "done", "gamification badges", "-", "P1", "M"),
    ("Gamification service tests", "API", "done", "gamification.service.spec.ts", "-", "P1", "S"),
    ("Community-scoped XP only", "API", "review", "gamification module", "Partial", "P2", "M"),
    ("Platform-wide XP/levels", "API", "pending", "-", "Missing", "P2", "L"),
    ("Reputation score", "API", "pending", "-", "Missing", "P3", "L"),
    ("Streaks beyond check-in", "API", "pending", "-", "Missing", "P2", "M"),
    ("Achievements system", "API", "pending", "-", "Missing", "P2", "L"),
    ("Referral program", "API", "pending", "-", "Missing", "P2", "L"),
    ("Ambassador program", "API", "pending", "-", "Missing", "P3", "L"),
    ("Platform leaderboards", "API", "pending", "-", "Missing", "P2", "M"),
    ("Leaderboard web UI", "Web", "done", "CommunityPanel leaderboard tab", "-", "P1", "M", "-", "Frontend"),
    ("Leaderboard mobile UI", "Mobile", "done", "community leaderboard", "-", "P1", "M", "-", "Mobile"),
    ("XP display profile", "API", "review", "gamification profile endpoint", "Partial", "P2", "S"),
    ("Twitch-style channel points", "API", "pending", "-", "Missing", "P3", "XL"),
    ("Discord-style roles from XP", "API", "pending", "-", "Missing", "P3", "L"),
    ("YouTube-style milestones", "API", "pending", "-", "Missing", "P3", "L"),
    ("Gamification notifications", "API", "review", "partial via notifications", "Partial", "P2", "M"),
    ("Anti-gaming XP abuse rules", "API", "pending", "-", "Security", "P2", "M"),
    ("Gamification analytics", "API", "pending", "-", "Missing", "P3", "M"),
    ("Badge studio creator config", "API", "pending", "-", "Missing", "P3", "M"),
]))

# ── Phase 12: AI Powered Platform (35) ───────────────────────────────────────
TASKS.extend(bulk(12, 1, [
    ("Live chat OpenAI moderation", "API", "done", "ai-moderation.util.ts", "-", "P0", "M"),
    ("Community room heuristic moderation", "API", "done", "ai-community.service.ts score", "-", "P1", "M"),
    ("Community post regex moderation", "API", "done", "post comments wired: ban check + scoreContent fast-path block in community-posts.service.ts", "-", "P1", "M"),
    ("Async moderation BullMQ worker", "Worker", "done", "community-moderation.worker.ts", "-", "P1", "M"),
    ("Auto spam report on flag", "API", "done", "moderation queue service", "-", "P1", "M"),
    ("AI moderation score studio API", "API", "done", "POST ai/moderation/score", "-", "P1", "S"),
    ("AI moderation score studio UI", "Web", "done", "StudioCreatorOpsPanel", "-", "P1", "M", "-", "Frontend"),
    ("Room discussion summary API (stub)", "API", "done", "GET creators/me/communities/:id/rooms/:roomId/summary → summarizeDiscussionAsync (real LLM + deterministic fallback)", "-", "P2", "M"),
    ("Creator copilot summaries (stub)", "API", "done", "summarizeDiscussionAsync: OpenAI chat-completion behind copilotEnabled+apiKey+budget, deterministic fallback; spec covers all 4 branches", "-", "P2", "M"),
    ("LLM moderation community rooms", "API", "done", "maybeQueueLlmTail (centralized in moderation-queue.service.ts)", "-", "P2", "M"),
    ("LLM moderation post comments", "API", "done", "shared maybeQueueLlmTail + fast-path in community-posts.service.ts; surface='post_comment'", "-", "P2", "M"),
    ("LLM async judge tail pipeline", "API", "done", "centralized tail (room + post_comment surfaces) → moderation queue → worker judge w/ surface", "-", "P2", "L"),
    ("AI config env wiring", "API", "done", "configuration.ts ai block (moderationLlmEnabled, copilotEnabled, reviewThreshold)", "-", "P2", "S"),
    ("Daily AI budget caps", "API", "done", "ai-budget.service.ts (Redis daily counter) gated at AiModerationService chokepoint + copilot; GET /admin/ai/budget; AI_DAILY_LLM_BUDGET", "-", "P2", "M"),
    ("AI audit logs API", "API", "done", "GET creators/me/audit-logs", "-", "P1", "M"),
    ("AI audit logs tests", "API", "done", "creator-audit.service.spec.ts", "-", "P1", "S"),
    ("Creator copilot Claude integration", "API", "pending", "AI-LLM-STRATEGY", "Missing", "P2", "L"),
    ("Community assistant RAG", "API", "blocked", "F-1302 search sidecar", "Missing", "P3", "XL"),
    ("AI search embeddings pgvector", "API", "blocked", "F-1302", "Missing", "P3", "XL"),
    ("AI content tagging", "API", "done", "categories.service.suggestSkillTags ranks curated catalog vs title/description; POST categories/:id/ai/suggest-tags (creator/admin); deterministic, zero-cost; spec covered", "-", "P2", "M"),
    ("Live stream AI summaries", "API", "pending", "-", "Missing", "P2", "L"),
    ("Discussion AI summaries (real LLM)", "API", "done", "ai-community.service.summarizeDiscussionAsync OpenAI gpt-4.1-mini call, budget-guarded, fallback; ai-community.service.spec.ts", "-", "P2", "M"),
    ("Community health scoring ML", "API", "pending", "C3-12-014", "Missing", "P3", "L"),
    ("Churn prediction ML", "API", "pending", "C3-12-013", "Missing", "P3", "L"),
    ("Engagement prediction ML", "API", "pending", "-", "Missing", "P3", "L"),
    ("Risk prediction ML", "API", "pending", "-", "Missing", "P3", "L"),
    ("AI observability metrics", "API", "done", "forge_ai_llm_calls_total{feature,result} counter (moderation/summary × success/error/budget_skipped) wired at AiModerationService + summary chokepoints; forge-metrics.spec.ts", "-", "P2", "M", "-", "Platform"),
    ("AI privacy impact analysis doc", "Docs", "done", "AI-LLM-STRATEGY.md §9", "-", "P2", "S"),
    ("AI cost analysis doc", "Docs", "done", "AI-LLM-STRATEGY.md §8", "-", "P2", "S"),
    ("ai-community service tests", "API", "done", "ai-community.service.spec.ts", "-", "P1", "S"),
    ("ai-moderation service tests", "API", "done", "ai-moderation.service.spec.ts", "-", "P1", "S"),
    ("creator-copilot service tests", "API", "done", "creator-copilot.service.spec.ts", "-", "P1", "S"),
    ("Large scale ML moderation", "API", "blocked", "V3.0 deferred", "Missing", "P3", "XL"),
    ("AI mobile surfaces", "Mobile", "pending", "-", "Missing", "P3", "M", "-", "Mobile"),
    ("Multi-provider LLM routing", "API", "pending", "AI-LLM-STRATEGY", "Missing", "P2", "L"),
    ("Prompt caching for copilot", "API", "pending", "-", "Missing", "P2", "M"),
]))

# ── Phase 13: Creator Business OS (30) ───────────────────────────────────────
TASKS.extend(bulk(13, 1, [
    ("Revenue MRR snapshot API", "API", "done", "subscribers/analytics", "-", "P1", "M"),
    ("Subscriber count analytics", "API", "done", "subscribers analytics", "-", "P1", "M"),
    ("Community analytics API", "API", "done", "community analytics endpoint", "-", "P1", "M"),
    ("Content analytics (video views)", "API", "done", "video view counts", "-", "P1", "M"),
    ("Live stream analytics API", "API", "done", "stream-analytics", "-", "P1", "M"),
    ("Business analytics funnel API", "API", "done", "creators/me/business-analytics", "-", "P1", "M"),
    ("Ecosystem tree studio web", "Web", "done", "studio/analytics ecosystem", "-", "P1", "M", "-", "Frontend"),
    ("Analytics details page web", "Web", "done", "studio/analytics/details/", "-", "P2", "M", "-", "Frontend"),
    ("Analytics studio mobile (basic)", "Mobile", "done", "studio_analytics_screen.dart renders per-video + business KPIs from existing backend endpoints", "-", "P1", "M", "-", "Mobile"),
    ("Creator funnel chart", "Web", "done", "CreatorFunnelChart.tsx", "-", "P2", "M", "-", "Frontend"),
    ("Community trends chart", "Web", "done", "CommunityTrendsChart.tsx", "-", "P2", "M", "-", "Frontend"),
    ("Platform analytics ingest", "API", "done", "POST analytics/events", "-", "P1", "M"),
    ("Analytics retention worker", "Worker", "done", "analytics-retention worker", "-", "P1", "M"),
    ("Admin analytics summary", "Admin", "done", "admin/analytics", "-", "P1", "M", "-", "Frontend"),
    ("KPI definitions doc", "Docs", "pending", "-", "Docs", "P2", "M", "-", "Product"),
    ("Churn rate KPI", "API", "pending", "-", "Missing", "P2", "L"),
    ("Retention cohort KPI", "API", "review", "business-analytics partial", "Partial", "P2", "M"),
    ("Growth funnel KPI", "API", "review", "funnel chart partial", "Partial", "P2", "M"),
    ("Engagement score KPI", "API", "pending", "-", "Missing", "P2", "L"),
    ("Live revenue KPI", "API", "review", "paid events partial", "Partial", "P2", "M"),
    ("Course enrollment KPI", "API", "review", "course enrollments count", "Partial", "P2", "S"),
    ("Community health KPI dashboard", "Web", "pending", "-", "Missing", "P2", "L", "-", "Frontend"),
    ("Export analytics CSV", "API", "done", "GET creators/me/business-analytics/export (CSV, CreatorApprovedGuard) reuses getCreatorBusinessAnalytics; injection-safe csv.util; web Export CSV button; specs", "-", "P2", "M"),
    ("Export analytics CSV (mobile)", "Mobile", "done", "StudioAnalyticsScreen AppBar Export action via CsvExportUtil -> business-analytics/export (share sheet)", "-", "P2", "S"),
    ("Real-time analytics websocket", "API", "pending", "-", "Missing", "P3", "L"),
    ("Benchmark industry KPI doc", "Docs", "pending", "-", "Docs", "P3", "S", "-", "Product"),
    ("Metric specifications doc", "Docs", "pending", "-", "Docs", "P2", "M", "-", "Product"),
    ("Dashboard wireframes", "Docs", "pending", "-", "Docs", "P3", "M", "-", "Product"),
    ("pg_stat_statements admin tool", "API", "done", "admin/database/query-stats", "-", "P1", "M"),
    ("Stream health dashboard host", "Web", "done", "StreamHostDashboard.tsx", "-", "P1", "M", "-", "Frontend"),
    ("Creator BI vs platform BI separation", "API", "review", "creator vs admin analytics", "Partial", "P2", "M"),
]))

# ── Phase 14: Enterprise RBAC & Security (30) ────────────────────────────────
TASKS.extend(bulk(14, 1, [
    ("Platform Permission enum", "API", "done", "packages/shared-types access.ts", "-", "P0", "M"),
    ("PermissionsGuard global", "API", "done", "app.module.ts PermissionsGuard", "-", "P0", "M"),
    ("RolesGuard global", "API", "done", "app.module.ts RolesGuard", "-", "P0", "M"),
    ("ConsumerOnlyGuard", "API", "done", "blocks admin JWT on consumer API", "-", "P0", "M"),
    ("Community role permission matrix", "API", "done", "community-permissions.constants.ts", "-", "P0", "M"),
    ("CommunityRoleGuard", "API", "done", "community-role.guard.ts", "-", "P0", "M"),
    ("Community role guard tests", "API", "done", "community-role.guard.spec.ts", "-", "P1", "S"),
    ("Room-level permissions", "API", "done", "community-room-permissions.service.ts", "-", "P0", "M"),
    ("Platform permissions.spec tests", "API", "done", "permissions.spec.ts", "-", "P1", "M"),
    ("verify-platform-roles script", "Infra", "done", "scripts/verify-platform-roles.sh", "-", "P1", "S", "-", "Platform"),
    ("Admin MANAGE_PLATFORM permission", "API", "done", "admin module", "-", "P0", "M"),
    ("Creator UPLOAD_VIDEO permission", "API", "done", "access.ts", "-", "P0", "S"),
    ("Creator START_STREAM permission", "API", "done", "access.ts", "-", "P0", "S"),
    ("Event permissions model", "API", "done", "community-events.service.ts uses assertCommunityStudioAccess (owner + delegated OWNER/ADMIN + platform ADMIN); controller uses CommunityStudioGuard", "-", "P1", "M"),
    ("Content permissions model", "API", "done", "ContentVisibility + entitlements", "-", "P0", "M"),
    ("Escalation rules doc", "Docs", "pending", "-", "Docs", "P2", "M", "-", "Product"),
    ("Ownership transfer rules", "API", "pending", "-", "Missing", "P3", "L"),
    ("Admin audit log migration", "API", "done", "1780000000002-admin-audit-log.ts", "-", "P1", "M"),
    ("Creator audit log service", "API", "done", "creator-audit.service.ts", "-", "P1", "M"),
    ("Rate limiting global ThrottlerGuard", "API", "done", "RedisThrottlerStorage", "-", "P0", "M"),
    ("Per-route throttle auth", "API", "done", "@Throttle on auth routes", "-", "P0", "S"),
    ("CSRF double-submit cookie", "API", "done", "auth-cookies + assertCookieRefreshCsrf", "-", "P0", "M"),
    ("CSRF tests", "API", "done", "auth-cookies.spec.ts", "-", "P1", "S"),
    ("Helmet HTTP headers", "API", "done", "main.ts helmet", "-", "P0", "S"),
    ("ValidationPipe whitelist", "API", "done", "main.ts ValidationPipe", "-", "P0", "S"),
    ("Global auth guards unit tests", "API", "done", "jwt/optional-jwt/roles/consumer-only/permissions/email-verified guard specs", "-", "P1", "M"),
    ("Admin module security tests", "API", "done", "admin.security.spec.ts + admin.service.spec.ts (12 tests)", "-", "P1", "L"),
    ("Permission matrix markdown doc", "Docs", "done", "docs/COMMUNITY-PERMISSION-MATRIX.md", "-", "P1", "S"),
    ("Sentry PII=false production", "Infra", "done", "EXECUTIVE_SUMMARY shipped", "-", "P1", "S", "-", "Platform"),
    ("CodeQL weekly scan", "Infra", "done", ".github/workflows/codeql.yml", "-", "P1", "S", "-", "Platform"),
]))

# ── Phase 15: Scale to 10M+ (25) ─────────────────────────────────────────────
TASKS.extend(bulk(15, 1, [
    ("Neon Postgres production", "Infra", "done", "Fly + Neon connection", "-", "P0", "M", "-", "Platform"),
    ("DB_POOL_MAX=5 default", "Infra", "done", "INFRASTRUCTURE_COST_AUDIT", "-", "P1", "S", "-", "Platform"),
    ("Redis BullMQ + socket adapter", "Infra", "done", "REDIS_CONNECTIONS.md", "-", "P0", "M", "-", "Platform"),
    ("Socket.IO Redis adapter required prod", "Infra", "done", "events.gateway.ts", "-", "P0", "M", "-", "Platform"),
    ("Fly API + worker split", "Infra", "done", "fly.toml + fly.worker.toml", "-", "P0", "M", "-", "Platform"),
    ("Vercel web/admin deploy", "Infra", "done", "DEPLOY.md", "-", "P0", "M", "-", "Platform"),
    ("BullMQ queue depth metrics", "Infra", "done", "METRICS_ENABLED forge_bullmq", "-", "P1", "M", "-", "Platform"),
    ("Feed Redis cache", "API", "done", "feed.service.ts cache", "-", "P1", "M"),
    ("Entitlement Redis cache", "API", "done", "entitlements cache", "-", "P1", "M"),
    ("Following feed cache", "API", "done", "SOCIAL_PLATFORM_AUDIT", "-", "P1", "M"),
    ("Pagination caps list endpoints", "API", "done", "EXECUTIVE_SUMMARY F-shipped", "-", "P1", "M"),
    ("Platform event outbox pattern", "API", "done", "platform-event-outbox", "-", "P1", "M"),
    ("Outbox worker", "Worker", "done", "platform-event-outbox worker", "-", "P1", "M"),
    ("Analytics events async ingest", "Worker", "done", "analytics-ingest worker", "-", "P1", "M"),
    ("Notification batch insert", "API", "done", "notifications batch", "-", "P1", "M"),
    ("Search sidecar Meilisearch", "Infra", "blocked", "F-1302", "Perf", "P3", "XL", "-", "Platform"),
    ("50K MAU load test", "Infra", "blocked", "DEFERRED_BACKLOG", "Perf", "P3", "XL", "-", "Platform"),
    ("100K entitlement simulation", "Infra", "blocked", "DEFERRED_BACKLOG", "Perf", "P3", "XL", "-", "Platform"),
    ("Neon restore drill", "Infra", "pending", "annual cadence 2027-06", "Ops", "P2", "M", "-", "Platform"),
    ("Disaster recovery runbook", "Docs", "done", "operations/DISASTER_RECOVERY.md", "-", "P1", "S"),
    ("Fly SLO runbook", "Docs", "done", "operations/FLY_SLO.md", "-", "P1", "S"),
    ("Mux cost ops runbook", "Docs", "done", "operations/MUX_COST_OPS.md", "-", "P1", "S"),
    ("Cost optimization strategy doc", "Docs", "done", "audits/NEON_COST.md + INFRA audit", "-", "P2", "S"),
    ("Horizontal API scale design", "Docs", "review", "modular monolith", "Partial", "P2", "M", "-", "Platform"),
    ("Millions messages scale design", "Docs", "pending", "-", "Missing", "P3", "XL", "-", "Platform"),
]))

# ── Phase 16: Implementation & Validation (40) ─────────────────────────────────
TASKS.extend(bulk(16, 1, [
    ("Schema migrations TypeORM", "API", "done", "57 migrations", "-", "P0", "M"),
    ("migrationsRun on API boot", "API", "done", "database module", "-", "P0", "S"),
    ("API unit tests (75 specs)", "API", "done", "apps/api/**/*.spec.ts", "-", "P1", "M"),
    ("API e2e mocked (3 suites)", "API", "done", "apps/api/test/*.e2e-spec.ts", "-", "P1", "M"),
    ("Community HTTP e2e", "API", "done", "community-http.e2e-spec.ts", "-", "P1", "M"),
    ("Courses HTTP e2e", "API", "done", "courses-http.e2e-spec.ts", "-", "P1", "M"),
    ("CI api lint/build/test/e2e/cov", "Infra", "done", ".github/workflows/ci.yml", "-", "P0", "M", "-", "Platform"),
    ("CI coverage threshold 33%", "Infra", "review", "apps/api/package.json", "Test", "P2", "S", "-", "Platform"),
    ("Web Playwright smoke", "Infra", "done", "ci.yml web job", "-", "P1", "M", "-", "Platform"),
    ("Admin Playwright smoke", "Infra", "done", "ci.yml admin job", "-", "P1", "M", "-", "Platform"),
    ("Mobile flutter analyze+test", "Infra", "done", "ci.yml mobile job", "-", "P1", "M", "-", "Platform"),
    ("npm critical audit CI", "Infra", "done", "security-audit job", "-", "P1", "S", "-", "Platform"),
    ("Shared-types package tests", "Infra", "done", "build-packages job", "-", "P1", "S", "-", "Platform"),
    ("ci:local script mirror", "Infra", "done", "scripts/ci-local.sh", "-", "P1", "S", "-", "Platform"),
    ("smoke-api.sh", "Infra", "done", "scripts/smoke-api.sh", "-", "P1", "S", "-", "Platform"),
    ("verify-production-ready.sh", "Infra", "done", "scripts/", "-", "P1", "S", "-", "Platform"),
    ("Permission tests automated CI", "Infra", "done", "deploy-staging.yml runs verify-platform-roles.sh (opt-in STAGING_VERIFY_ROLES)", "-", "P1", "M", "-", "Platform"),
    ("Entitlement tests", "API", "done", "entitlements.service.spec.ts", "-", "P1", "M"),
    ("Load test entitlements script", "Infra", "done", "scripts/load-test-entitlements.sh", "-", "P2", "S", "-", "Platform"),
    ("Regression test suite full", "Infra", "pending", "-", "Test", "P2", "L", "-", "Platform"),
    ("Admin Playwright E2E full", "Infra", "pending", "F-1203 deferred", "Test", "P3", "L", "-", "Platform"),
    ("Production config validation boot", "API", "done", "validate-production-config.spec.ts", "-", "P0", "M"),
    ("Env production schema tests", "API", "done", "env-production.schema.spec.ts", "-", "P1", "S"),
    ("Health ready/live probes", "API", "done", "health.controller.ts", "-", "P0", "S"),
    ("Prometheus metrics endpoint", "API", "done", "GET /metrics", "-", "P1", "M"),
    ("Staging environment", "Infra", "done", "operations/STAGING.md", "-", "P1", "M", "-", "Platform"),
    ("Release workflow post-merge", "Infra", "done", ".github/workflows/release.yml", "-", "P0", "M", "-", "Platform"),
    ("Rollback plan per migration", "Docs", "done", "operations/MIGRATION_ROLLBACK.md (revert vs PITR matrix)", "-", "P1", "M", "-", "Platform"),
    ("API versioning policy", "Docs", "done", "API_SCHEMAS.md", "-", "P1", "S"),
    ("QA test matrix doc", "Docs", "done", "docs/QA.md", "-", "P1", "S"),
    ("Swagger dev docs", "API", "done", "/api/docs dev", "-", "P2", "S"),
    ("Workers module prod isolation", "Worker", "done", "WORKER_ONLY=true", "-", "P0", "M"),
    ("Video worker not on API prod", "Worker", "done", "forge-core rules", "-", "P0", "S"),
    ("Integration test live DB optional", "Infra", "pending", "-", "Test", "P3", "L", "-", "Platform"),
    ("Web component unit tests", "Web", "pending", "-", "Test", "P2", "L", "-", "Frontend"),
    ("Mobile integration tests", "Mobile", "pending", "-", "Test", "P2", "L", "-", "Mobile"),
    ("Forge git branching policy", "Docs", "done", ".cursor/rules/forge-git-branching.mdc", "-", "P0", "S"),
    ("Deployment testing policy", "Docs", "done", "forge-deployment-testing.mdc", "-", "P1", "S"),
    ("Post-deploy auth audit script", "Infra", "done", "audit-production-auth.sh", "-", "P1", "S", "-", "Platform"),
    ("Formal production readiness gate", "Infra", "done", "check:prod-env runs authoritative validateProductionEnv; verify-production-ready.sh delegates to it (single source of truth with boot) + topology checks", "-", "P1", "M", "-", "Platform"),
]))

# ── Cross-cutting: Tests, Docs, DevOps (45) ─────────────────────────────────
TASKS.extend(bulk(17, 1, [
    ("Auth module test coverage", "API", "done", "9 auth spec files", "-", "P1", "M"),
    ("Communities module test coverage", "API", "done", "18+ community specs", "-", "P1", "M"),
    ("Content module test coverage", "API", "done", "8 content specs", "-", "P1", "M"),
    ("Streaming module test coverage", "API", "done", "9 streaming specs: services (live/viewer/analytics/reaction/mux-sync/streaming), both controllers, stream.mapper (ingest/playback access rules)", "-", "P1", "M"),
    ("Billing partial tests", "API", "done", "4 billing specs (billing, subscription-change, stripe-tier-sync, stripe-connect)", "-", "P1", "M"),
    ("Feed module zero tests", "API", "done", "feed.service + feed-query.util + feed.controller specs", "-", "P1", "M"),
    ("Search module zero tests", "API", "done", "search.service + search.controller specs", "-", "P1", "M"),
    ("Admin module zero tests", "API", "done", "admin.security + admin.service specs", "-", "P1", "L"),
    ("Direct messages zero tests", "API", "done", "direct-messages.service + controller specs (12 tests)", "-", "P1", "M"),
    ("Reports module zero tests", "API", "done", "reports.service + reports.controller specs (13 tests)", "-", "P1", "M"),
    ("Playlists zero tests", "API", "done", "playlists.service.spec.ts (17 tests)", "-", "P2", "S"),
    ("Categories zero tests", "API", "done", "categories.service.spec.ts (13 tests)", "-", "P2", "S"),
    ("Live-broadcast zero tests", "API", "done", "live-broadcast.service.spec.ts (16 tests)", "-", "P2", "S"),
    ("Mail module zero tests", "API", "done", "mail.service.spec.ts — 13 tests (Resend HTTP/SMTP/unconfigured, prod/dev, error classification)", "-", "P3", "S"),
    ("Workers zero tests", "Worker", "done", "all 15 worker specs (moderation, push-dispatch, stream-reminder/mux-sync/chat-ingest, mux-vod, video-processor DLQ, analytics ingest/retention, snapshot retention, subscription-maintenance, announcement/premium notify, outbox, engagement-reconciliation) — 43 tests", "-", "P2", "L"),
    ("Stripe connect service tests", "API", "done", "stripe-connect.service.spec.ts (15 tests)", "-", "P1", "M"),
    ("Stripe tier sync tests", "API", "done", "stripe-tier-sync.service.spec.ts", "-", "P1", "M"),
    ("Channel sunset enablement runbook", "Docs", "done", "CHANNEL_SUNSET.md + smoke-channel-sunset.sh", "-", "P1", "M", "-", "Platform"),
    ("Community events service tests", "API", "done", "community-events.service.spec.ts", "-", "P0", "M"),
    ("Channel migration service tests", "API", "done", "channel-migration.service.spec.ts", "-", "P0", "M"),
    ("Creator programs service tests", "API", "done", "creator-programs.service.spec.ts", "-", "P0", "M"),
    ("Community storage service tests", "API", "done", "community-storage.service.spec.ts (9 tests)", "-", "P2", "M"),
    ("LiveKit room service tests", "API", "done", "community-room-livekit.service.spec.ts (11 tests)", "-", "P2", "M"),
    ("Web auth e2e (secrets optional)", "Infra", "review", "ci.yml E2E secrets", "Test", "P2", "M", "-", "Platform"),
    ("Flutter unit tests (2 files)", "Mobile", "review", "auth_redirect + video_model", "Test", "P2", "M", "-", "Mobile"),
    ("GETTING_STARTED.md current", "Docs", "done", "docs/GETTING_STARTED.md", "-", "P1", "S"),
    ("DEPLOY.md current", "Docs", "done", "docs/DEPLOY.md", "-", "P1", "S"),
    ("CLIENT_OVERVIEW sync", "Docs", "review", "CLIENT_OVERVIEW.md §4", "Docs", "P2", "S", "-", "Product"),
    ("API_SCHEMAS public contracts", "Docs", "done", "docs/API_SCHEMAS.md", "-", "P1", "S"),
    ("OBSERVABILITY.md", "Docs", "done", "docs/OBSERVABILITY.md", "-", "P1", "S"),
    ("Design system package", "Web", "done", "@forge/design-system", "-", "P1", "M", "-", "Frontend"),
    ("Mobile forge tokens", "Mobile", "done", "forge_tokens.dart", "-", "P1", "S", "-", "Mobile"),
    ("Feature flags platform config", "API", "done", "GET platform/config", "-", "P1", "M"),
    ("Firebase FCM push", "API", "done", "backend batched FCM + invalid-token cleanup; mobile forge_push.dart deregister on logout (single/all) wired into auth_repository.logout, re-registers on next login", "-", "P1", "M"),
    ("App Check guard optional", "API", "done", "app-check.guard.ts", "-", "P2", "M"),
    ("Monorepo shared-types contracts", "Infra", "done", "packages/shared-types", "-", "P0", "M", "-", "Platform"),
    ("Docker compose local dev", "Infra", "done", "docker-compose.yml", "-", "P1", "S", "-", "Platform"),
    ("GitHub Actions deploy workflows", "Infra", "done", "deploy-fly.yml deploy-vercel.yml", "-", "P0", "M", "-", "Platform"),
    ("Secrets not in repo policy", "Docs", "done", ".env.example only", "-", "P0", "S"),
    ("Wipe platform data script guarded", "Infra", "done", "scripts/wipe-platform-data.sh", "-", "P2", "S", "-", "Platform"),
    ("npm audit 55 transitive (non-blocking)", "Infra", "review", "DEFERRED_BACKLOG", "Security", "P2", "L", "-", "Platform"),
    ("Admin + web Vercel merge optional", "Infra", "pending", "F optional backlog", "Perf", "P3", "L", "-", "Platform"),
    ("CEOS tracker generator script", "Infra", "done", "scripts/generate-ceos-tracker.py", "-", "P0", "S", "-", "Platform"),
    ("CEOS tracker doc output", "Docs", "done", "docs/FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md", "-", "P0", "L"),
    ("PR checklist update CEOS IDs", "Docs", "done", "tracker § Update rules", "-", "P1", "S", "-", "Product"),
    ("Monthly tracker reconciliation", "Docs", "done", "tracker § Update rules", "-", "P1", "S", "-", "Product"),
]))


PHASE_NAMES = {
    0: "Discovery & Audit",
    1: "Gap Analysis",
    2: "Industry Benchmarks",
    3: "Creator Structure",
    4: "Community 2.0/3.0",
    5: "Membership & Entitlements",
    6: "Unified Content System",
    7: "Live Community Ecosystem",
    8: "Account Sharing Prevention",
    9: "Creator Management System",
    10: "Community Engagement Engine",
    11: "Gamification & Loyalty",
    12: "AI Powered Platform",
    13: "Creator Business OS",
    14: "Enterprise RBAC & Security",
    15: "Scale to 10M+ Users",
    16: "Implementation & Validation",
    17: "Cross-cutting (Tests, Docs, DevOps)",
}


def stats():
    by_status = {k: 0 for k in S}
    by_phase = {}
    by_domain = {}
    for task in TASKS:
        by_status[task.status] = by_status.get(task.status, 0) + 1
        by_phase[task.phase] = by_phase.get(task.phase, 0) + 1
    total = len(TASKS)
    done = by_status.get("done", 0)
    pct = round(100 * done / total, 1) if total else 0
    return total, done, pct, by_status, by_phase


def p0_queue():
    items = [x for x in TASKS if x.priority == "P0" and x.status in ("pending", "wip", "review")]
    order = {"wip": 0, "review": 1, "pending": 2}
    items.sort(key=lambda x: (order.get(x.status, 9), x.phase, x.num))
    return items[:15]


def render_table(tasks: list[Task]) -> str:
    lines = [
        "| ID | Requirement | Surface | Status | Evidence | Gap | Pri | Effort | Depends | Owner |",
        "|----|-------------|---------|--------|----------|-----|-----|--------|---------|-------|",
    ]
    for task in tasks:
        lines.append(
            f"| {task.id} | {task.requirement} | {task.surface} | {S[task.status]} | "
            f"{task.evidence} | {task.gap} | {task.priority} | {task.effort} | {task.depends} | {task.owner} |"
        )
    return "\n".join(lines)


def main() -> None:
    total, done, pct, by_status, by_phase = stats()
    today = date.today().isoformat()
    out_path = "docs/FORGE_CREATOR_ECONOMY_OS_MASTER_TRACKER.md"

    p0 = p0_queue()
    p0_lines = "\n".join(
        f"| {i+1} | {t.id} | {t.requirement} | {S[t.status]} | {t.priority} | {t.effort} |"
        for i, t in enumerate(p0)
    )

    domain_weights = {
        "Community": sum(1 for t in TASKS if t.phase == 4 and t.status == "done") / max(by_phase.get(4, 1), 1),
        "Memberships": sum(1 for t in TASKS if t.phase == 5 and t.status == "done") / max(by_phase.get(5, 1), 1),
        "Content/Feed": sum(1 for t in TASKS if t.phase == 6 and t.status == "done") / max(by_phase.get(6, 1), 1),
        "Live": sum(1 for t in TASKS if t.phase == 7 and t.status == "done") / max(by_phase.get(7, 1), 1),
        "Creator Studio": sum(1 for t in TASKS if t.phase == 9 and t.status == "done") / max(by_phase.get(9, 1), 1),
        "AI": sum(1 for t in TASKS if t.phase == 12 and t.status == "done") / max(by_phase.get(12, 1), 1),
        "Scale/Infra": sum(1 for t in TASKS if t.phase == 15 and t.status == "done") / max(by_phase.get(15, 1), 1),
    }
    domain_table = "\n".join(
        f"| {k} | {round(v*100)}% |" for k, v in sorted(domain_weights.items(), key=lambda x: -x[1])
    )

    sections = []
    for phase in sorted(PHASE_NAMES):
        phase_tasks = [t for t in TASKS if t.phase == phase]
        sections.append(f"## Phase {phase} — {PHASE_NAMES[phase]} ({len(phase_tasks)} tasks)\n\n{render_table(phase_tasks)}\n")

    doc = f"""# FORGE Creator Economy OS — Master Tracker

**Version:** 1.0.0 · **Last audit:** {today} · **Authoritative source of truth** for Creator Economy OS delivery  
**Blueprint:** [FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md](../FORGE_CREATOR_ECONOMY_OPERATING_SYSTEM_V3.0.md)  
**Platform reference:** [FORGE_PROJECT_MASTER.md](./FORGE_PROJECT_MASTER.md)  
**Re-audit trigger:** 2026-09-04 or 50K MAU ([EXECUTIVE_SUMMARY.md](./audits/EXECUTIVE_SUMMARY.md))

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Completed — shipped with code evidence |
| 🔄 | In Progress — active WIP on branch or partial surface |
| ⏳ | Pending — not started |
| 🚫 | Blocked — dependency or deferred trigger |
| 👀 | Needs Review — implemented but untested, unverified, or doc mismatch |

### Update rules

1. **On merge:** set affected `CEOS-Pxx-Txxx` rows to ✅; move next highest-priority ⏳ to 🔄.
2. **Weekly:** refresh §2 executive dashboard counts (re-run `python3 scripts/generate-ceos-tracker.py` or edit manually).
3. **Monthly:** reconcile with [DEFERRED_BACKLOG.md](./audits/DEFERRED_BACKLOG.md) and [AI-LLM-STRATEGY.md](./AI-LLM-STRATEGY.md).
4. **Re-audit:** full pass on schema migration, 50K MAU, or 2026-09-04.

### Canonical links

| Topic | Doc |
|-------|-----|
| Memberships & Stripe | [MEMBERSHIPS.md](./MEMBERSHIPS.md) |
| AI / LLM rollout | [AI-LLM-STRATEGY.md](./AI-LLM-STRATEGY.md) |
| Deferred items | [audits/DEFERRED_BACKLOG.md](./audits/DEFERRED_BACKLOG.md) |
| Community permission matrix (code) | `apps/api/src/modules/communities/community-permissions.constants.ts` |
| Archived Community 2.0/3.0 trackers | Redirect stubs in `docs/COMMUNITY-*.md` → this file |

---

## 1. Executive dashboard

### Overall completion (evidence-based)

| Metric | Value |
|--------|-------|
| **Total tasks** | {total} |
| **Completed ✅** | {done} ({pct}%) |
| **In Progress 🔄** | {by_status.get('wip', 0)} |
| **Needs Review 👀** | {by_status.get('review', 0)} |
| **Pending ⏳** | {by_status.get('pending', 0)} |
| **Blocked 🚫** | {by_status.get('blocked', 0)} |

> **Note:** The V3.0 blueprint §Implementation Status Tracker (~98%) is **aspirational**. This tracker ({pct}% ✅) is the **authoritative** evidence-based score.

### Completion by domain (phase-weighted)

| Domain | ~Complete |
|--------|-----------|
{domain_table}

### P0 active queue (top 15)

| # | ID | Requirement | Status | Pri | Effort |
|---|-----|-------------|--------|-----|--------|
{p0_lines}

### Risk heatmap

| Area | Level | Key risk |
|------|-------|----------|
| Security | Low–Medium | RBAC verify wired into staging CD; all 15 workers + mail now tested; geo-login detection pending |
| Scale | Medium | No formal 50K MAU load test; Postgres FTS at 500K+ videos |
| Cost | Medium | Mux COGS without production Stripe revenue (F-1101) |
| UX | Low | Flip community_channels_deprecated staging→prod; mobile studio community consolidated |
| Docs | Low | Community 2.0/3.0 redirects + master tracker shipped 2026-06-22 |
| Revenue | Medium | Runbook shipped; prod cutover + Connect onboarding still required |

---

## 2. Architecture diagrams

### Creator ecosystem

```mermaid
flowchart TB
  Creator[Creator]
  Creator --> Brands[Brands]
  Creator --> Communities[Communities]
  Creator --> Courses[Courses]
  Creator --> Programs[Programs]
  Creator --> Tiers[Membership Tiers]
  Creator --> Bundles[Bundles]
  Creator --> Live[Live Streams]
  Creator --> Analytics[Business Analytics]
  Programs --> Courses
  Communities --> Rooms[Rooms]
  Communities --> Events[Events]
  Tiers --> Entitlements[tier_entitlements]
```

### Community hierarchy

```mermaid
flowchart LR
  Creator --> Community
  Community --> Category
  Category --> Room
  Room --> Messages[Messages/Threads]
  Community --> Posts[Posts]
  Posts --> Comments[Comments]
```

### Entitlement evaluation

```mermaid
flowchart TD
  Request[Content/Room Request] --> Public{{Public?}}
  Public -->|yes| Allow[Allow]
  Public -->|no| SubCheck[Active subscription?]
  SubCheck --> TierEnt[tier_entitlements match]
  TierEnt --> AccessSession[access-sessions device cap]
  AccessSession --> Allow
  SubCheck -->|no| Deny[403 Forbidden]
```

### Event-driven async (BullMQ)

See [FORGE_PROJECT_MASTER.md §5](./FORGE_PROJECT_MASTER.md#5-background-workers-bullmq) — key queues: `subscription-maintenance`, `community-moderation`, `premium-content-notify`, `analytics-ingest`, `push-dispatch`, `platform-event-outbox`.

---

## 3. Gap analysis summary

### Strengths ✅

- Auth, JWT, CSRF, global guards, rate limiting
- Entitlements + Stripe billing architecture (config-dependent)
- Communities: posts, polls, rooms, voice LiveKit, moderation, engagement
- Access sessions + tier device limits
- Live streaming Mux + chat + AI moderation
- Social platform closed (engagement, DMs, following feed)
- Infra cost optimizations shipped June 2026

### Partial 🔄 / 👀

- Channel→room migration in flight
- Community events API shipped; mobile studio admin missing
- Creator programs studio-only; no consumer enrollment
- Courses text-only; no public catalog
- AI ~48%; live chat LLM only
- Mobile studio fragmentation vs unified web community admin

### Missing ⏳ (major V3.0 scope)

- Unified content types (shorts, articles, podcasts, assignments)
- Advanced live (breakout, multi-host, VIP rooms)
- Study groups, mentorship, office hours
- Geo anomaly / fraud detection
- ML churn, health, engagement prediction
- Netflix-style content library UX
- Search sidecar (F-1302), signed Mux URLs (F-1101)

---

## 4. Implementation roadmap

### Wave 1 — P0 (weeks 1–3): Stabilize in-flight

| ID | Task | Effort | Risk |
|----|------|--------|------|
| CEOS-P04-T015–T017 | Channel→room migration + tests + deprecate legacy UI | L | Data integrity |
| CEOS-P04-T052–T057 | Community events tests + mobile studio admin | M | Parity |
| CEOS-P03-T031–T034 | Creator programs consumer API + enrollment + UI | L | Revenue |
| CEOS-XC-T018–T020 | Tests for events, migration, programs services | M | Quality |
| CEOS-P00-T016–T018 | This tracker + doc chain repair | M | Low |

**Validation:** `bash scripts/smoke-community-2.0.sh` · targeted jest for new specs

### Wave 2 — P1 (weeks 4–8): Revenue & creator OS

- Stripe production cutover (runbook: `docs/operations/STRIPE_PRODUCTION_ENABLEMENT.md`) + smoke-memberships
- Course LMS: lesson CRUD, discovery catalog
- Channel sunset staging enablement (`docs/operations/CHANNEL_SUNSET.md` + smoke script)
- Permission matrix markdown doc
- CI: `verify-platform-roles.sh` on release

### Wave 3 — P2 (weeks 9–16): Engagement & AI Phase I

- AI moderation cascade (community rooms/posts) per AI-LLM-STRATEGY
- Gamification expansion
- Creator analytics KPIs
- Feed/search test coverage

### Wave 4 — P3 (quarter+): Scale & enterprise

- Search sidecar (F-1302) · 50K MAU load test
- Advanced live features
- ML churn/health classifiers
- Signed Mux URLs (F-1101)

---

## 5. Task registry

**Total: {total} tasks** across phases 0–17.

{''.join(sections)}

---

## 6. Decisions log

| Date | Decision | Rationale |
|------|----------|-----------|
| {today} | Single tracker replaces Community 2.0/3.0 docs | Deleted/stale docs; one source of truth |
| {today} | Evidence-based {pct}% vs V3.0 98% claim | Code audit; aspirational vs shipped |
| 2026-06 | Enterprise audit closed | 19/19 top fixes shipped |
| 2026-06 | Stripe recurring shipped | Community 2.0 billing |
| Deferred | F-1302 search sidecar | Trigger: 500K videos or FTS p95 degrade |
| Deferred | F-1101 signed Mux URLs | Before DRM-grade playback |
| Deferred | 50K MAU load test | Pre-major marketing push |

---

*Generated by `scripts/generate-ceos-tracker.py` — re-run after major releases to refresh counts.*
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"Wrote {out_path}: {total} tasks, {done} done ({pct}%)")


if __name__ == "__main__":
    main()
