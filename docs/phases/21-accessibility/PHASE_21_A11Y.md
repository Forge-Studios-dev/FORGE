# Phase 21 — Accessibility

**Status:** Complete for chrome skip-link slice (web). Mobile a11y started 2026-08-11 — see below.

## Shipped

- AppShell “Skip to content” → `#main-content`
- Studio already had skip link (Phase 06 era)
- **Mobile (2026-08-11):** first accessibility slice — `Semantics` labels on the like/comment/share action widgets in `feed_screen.dart` and `shorts_screen.dart` (previously no accessible label at all on these custom buttons), plus missing `tooltip:` added to bare `IconButton`s on `feed_screen.dart`/`shorts_screen.dart`/`watch_screen.dart`. 1 new semantics regression test. Covers the 3 highest-traffic screens only — see `docs/PLATFORM_AUDIT_2026-08-09.md §2.4` for exactly what's covered vs. not.

## Deferred

- Full WCAG audit pass / axe CI gate (web)
- Mobile: remaining IconButtons outside Studio (profile/playlists/live/community/settings sub-pages), color-contrast audit, focus-order/traversal review, `meetsGuideline` tap-target/contrast checks, manual VoiceOver/TalkBack pass
  - **Wave 36:** Studio screens got `tooltip:` on bare back/clear/edit/delete IconButtons
  - **Wave 46:** Live reaction bar Semantics labels
