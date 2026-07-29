# FORGE — Mobile

> Scope: **Apply when touching** `apps/mobile/**`. Mirrors `.cursor/rules/forge-mobile.mdc`.

## Architecture

- Feature folders: `data` / `presentation`; domain via repositories.
- HTTP only through `core/network` — no raw Dio/HTTP in widgets.
- Reuse `forge_card`, motion tokens, and shared `lib/core` patterns.

## UX & performance

- Offline-friendly: cache watch history; graceful offline UI.
- Background-friendly uploads; adaptive quality on watch.
- Efficient lists; avoid rebuilding whole trees on minor state changes.

## Platform

- Deep links via `app_router.dart`; push hooks when adding notification features.
- Secure token storage; refresh aligned with API JWT flow.
- Parity on critical flows with web: auth, watch, studio upload, notifications, live.
- Validate iOS and Android paths when touching platform channels.
- `flutter test` with mocked repositories — no live API in unit/widget tests.
