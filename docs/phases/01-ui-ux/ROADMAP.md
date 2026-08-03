# Phase 01 — Implementation roadmap (Fresh Restart)

Validated against Master Execution: Phase 01 chrome/DS/voice only; no Phase 04–12 feature creep.

| Slice | Priority | Effort | Risk | Deps | Status |
| --- | --- | --- | --- | --- | --- |
| Docs — fresh audit + this roadmap | P0 | S | Low | — | Done |
| A. A11y shell — one skip + one `#main-content` | P0 | S | Low | — | Done |
| B. Immersive Studio + Shorts (web + mobile) | P0 | L | Med | A | Done |
| C. TopicChip, TrendingRail, For you, Continue once, FeedCard chips | P0 | M | Low | — | Done |
| D. Mobile light theme + You always in bottom nav | P0 | M | Med | — | Done |
| E. Mobile-web theme toggle, Admin channel-points, FeedCard Icon | P1 | S | Low | B/C | Done |
| Report + Phase 02 handoff | P0 | S | Low | A–E | Done |

## Validation notes

- No new packages.
- No DB migrations.
- API `skillTags` field names unchanged.
- DS Menu/Select deferred.
- Flutter body surfaces still often use dark `ForgeTokens` consts — ThemeMode flips Material chrome; full of(context) sweep → Phase 02 depth.
