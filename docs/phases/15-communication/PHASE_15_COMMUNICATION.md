# Phase 15 — Communication Platform

**Status:** Complete for DM + notifications polish

## Already present

- In-app notifications + deep links
- Socket.IO DMs
- Live chat / slow mode / pin / super chat

## Shipped

- Messages: username search to start a DM (no raw UUID)
- Guest empty state for messages
- Settings: Notifications section + link
- Channel notification bell: All / Personalized / None (watch Subscribe menu)
- Live fanout skips subscribers with notify `none`
- Push preference matrix UI: web already had it (`NotificationPreferencesSettings.tsx`); added the missing mobile counterpart 2026-08-11 (`profile_settings_screen.dart`'s `_NotificationPreferencesSection`, same `/users/me/notification-preferences` endpoint). Server-side `Share` tracking (`POST /videos/:id/share`) also added 2026-08-11, wired to web + mobile video-share flows — see `docs/PLATFORM_AUDIT_2026-08-09.md §2.7`.

## Deferred

- Personalized ranking (distinct from All) — `FollowNotifyLevel.PERSONALIZED` is still a labeled-but-inert setting, needs an affinity/interest signal to act on, not attempted yet.
