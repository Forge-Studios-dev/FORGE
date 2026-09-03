# Implementation prompts (agents)

**Do not use archived mega-prompts as current instructions.**

## SSOT (read in this order)

1. [FORGE_PRODUCT_STRATEGY.md](./FORGE_PRODUCT_STRATEGY.md) — product framing
2. [decisions/](./decisions/) — ADR-001–014 (all Keep as of 2026-09-03 evening revalidation)
3. [FORGE_IMPLEMENTATION_ROADMAP.md](./FORGE_IMPLEMENTATION_ROADMAP.md) — R0→R5 + post-launch triggers
4. [audits/FRESH_AUDIT_2026-09-03_MASTER.md](./audits/FRESH_AUDIT_2026-09-03_MASTER.md) — ledger §2a, gaps §4a
5. [audits/DEFERRED_BACKLOG.md](./audits/DEFERRED_BACKLOG.md) — only open backlog SSOT
6. Feature status: [FORGE_PROJECT_MASTER.md §16](./FORGE_PROJECT_MASTER.md#16-feature-status-matrix) — **not** CEOS tracker %

Agent rules: `forge-product` (framing) + `forge-youtube-replica` (**mechanics only** — never sunset skill taxonomy, approval gate, courses/mentorship/points, or rooms/events to “match YouTube”).

## What to work on next

| Priority | Work | Notes |
|----------|------|-------|
| 1 — R1 ops/legal | CSAM vendor, Stripe live, Neon drill, DMCA agent, load evidence, Mux signing | **Outside git** — execute [R1_LAUNCH_GATES.md](./operations/R1_LAUNCH_GATES.md) |
| **2 — Trigger-gated** | Meili / pgvector / HA Fly / DRM | Only when DEFERRED triggers fire — do not build early |
| **3 — Depth** | Admin billing writes, kids mode, EEA CMP | Requires product/legal scope first |

## Anti-prompts (do not follow)

- YouTube-replica-only framing or “remove FORGE divergences”
- Sunset / retire skill UI to match YouTube
- Treat CEOS tracker % or DEPTH ship log as status SSOT
- Build ads/VAST (ADR-005 permanently N/A)
- Microservices / Elasticsearch / MediaConvert / full LMS UI without an Overturn ADR
- Implement from [platform-research/](./platform-research/) bodies or stubbed Aug/Sep2 audits

## How to implement a phase

1. Copy the matching R-section (or DEFERRED row) into the task.
2. Follow `forge-core` / `forge-ship` / path-scoped rules.
3. Update Master §16 + CLIENT_OVERVIEW if feature status changes; update DEFERRED if a trigger item closes.
4. Prefer smallest coherent change; no drive-by rewrites.
