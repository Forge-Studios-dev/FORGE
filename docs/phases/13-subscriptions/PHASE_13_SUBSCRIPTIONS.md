# Phase 13 — Subscription Platform

**Status:** Complete (parity already shipped in Phases 04–05; verified)

## Model

- Channel **Subscribe** maps to follow graph (`viewerFollowingCreator` / subscribe APIs)
- Paid **Members** = membership tiers (separate monetization surface)

## Verified present

- Subscribe CTA on watch (`VideoInfo`) and channel (`ProfileHeader`)
- Home **Subscriptions** tab + `/subscriptions` page
- Live chat mode labels: Subscribers vs Members (Phase 10)

## Deferred

- Push-matrix notification prefs beyond per-channel bell (All / Personalized / None) — bell shipped on web + mobile

## Closed (2026-08-05)

- Unsubscribe confirmation: web `SubscribeChannelControl` + Shorts; mobile watch / Shorts / profile

See [PHASE_13_REPORT.md](./PHASE_13_REPORT.md).
