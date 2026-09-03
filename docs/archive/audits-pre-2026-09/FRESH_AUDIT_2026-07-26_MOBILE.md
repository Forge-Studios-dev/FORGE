# FORGE Mobile — Fresh Production-Readiness Audit

> **Partially stale, 2026-08-13.** Accessibility has measurably progressed since this audit —
> `PHASE_21_A11Y.md`'s phased sweep (started 2026-08-11) is the current source of truth for a11y
> status, not this doc's counts. H1's "71% of presentation-layer files bypass the repository layer"
> conflates two distinct issues: most of those are calling the sanctioned `ApiClient` directly
> (a real but lower-severity maintainability gap) rather than raw, unpinned `Dio()` outside
> `core/network` (a narrower, security-relevant gap — one real instance found and fixed
> 2026-08-13 in `channel_community_panel.dart`). Re-verify before treating either count as current.

**Date:** 2026-07-26
**Scope:** `/Users/rahulbhanushali/Desktop/FORGE/apps/mobile` (Flutter, Riverpod, go_router)
**Auditor role:** Senior Flutter Engineer + Senior Mobile Performance Expert
**Type:** Fresh from-scratch audit (no prior mobile audit doc referenced)

## Method

- `.codegraph/` exists at repo root but indexes the TypeScript workspace only (no Dart symbol data returned for `apps/mobile` queries) — fell back to `find`/`grep`/`Read` and a real `flutter analyze` run.
- Inventoried `lib/` (19 subfolders under `core/` + `features/`, 102 `.dart` files, 17,663 LOC), ranked files by size (`wc -l | sort -rn`).
- Ran `flutter analyze --no-fatal-infos` (124 issues surfaced; framework/plugin `build/` noise excluded from findings below, only `lib/` issues counted).
- Targeted greps for anti-patterns: `TextEditingController`/`AnimationController`/`StreamSubscription` vs `.dispose()`, `catch (_) {}`, `print(`, `ListView(` vs `.builder`, `Image.network` vs `CachedNetworkImage`, `apiClientProvider`/`.dio.` usage inside `presentation/` (raw HTTP in widgets), `Semantics(`, `IconButton(` vs `tooltip:`, `MediaQuery`/`LayoutBuilder`/`OrientationBuilder`, ARB/localization files, `ThemeMode`.
- Spot-read ~30 representative files across auth, feed, watch, community, studio, upload, playlists, messages, push, network, router, cache, theme layers, plus `pubspec.yaml`, `main.dart`, `app_router.dart`, `api_client.dart`, `local_cache.dart`, `forge_push.dart`, iOS `Info.plist`.

---

## Critical

### C1 — Undisposed `TextEditingController` leaks on every "create playlist" dialog open
- **File:** `lib/features/playlists/presentation/playlists_screen.dart:44`
- **Current implementation:**
  ```dart
  Future<void> _createPlaylist() async {
    final titleCtrl = TextEditingController();
    var visibility = 'public';
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          ...
          content: Column(children: [ TextField(controller: titleCtrl, ...), ... ]),
          ...
  ```
  No `titleCtrl.dispose()` exists anywhere in the file (confirmed: `grep -c "\.dispose()"` → 0, `grep -c "void dispose()"` → 0).
- **Problem:** A new `TextEditingController` is allocated on every call to `_createPlaylist()` (every time the "New playlist" dialog opens) and never released. Unlike controllers declared as `State` fields and disposed in `dispose()`, this one is function-local and has no owner to release it — each dialog open leaks a `ChangeNotifier` + its `TextEditingValue`/listener registrations permanently.
- **Why it matters:** Small but 100%-reproducible leak; on a heavy playlist-creating user session this compounds and shows up as slow, unbounded growth in `flutter --profile` memory graphs. It is exactly the class of bug `forge-mobile.md` calls out ("efficient lists; avoid rebuilding..."), and the project's own testing rules require unit coverage on critical paths — this one has none.
- **Recommended solution:** Move `titleCtrl` to be created immediately before `showDialog` but wrap in `try { ... } finally { titleCtrl.dispose(); }`, or convert `_createPlaylist` dialog to a small `StatefulWidget` that owns the controller and disposes it in its own `dispose()`.
- **Best-practice reference:** Flutter docs — "Every `TextEditingController` you create must be disposed to avoid memory leaks."
- **Estimated effort:** 15 min.
- **Expected impact:** Eliminates a confirmed leak on a common, repeatable user action.

---

## High

### H1 — 71% of presentation-layer files call `apiClientProvider`/`Dio` directly, bypassing the repository layer
- **Files affected (42 of 59 files under `lib/features/*/presentation/`):** including `community_screen.dart`, `community_text_room_screen.dart`, `community_voice_room_screen.dart`, `discover_communities_screen.dart`, `messages_screen.dart`, `notifications_screen.dart`, `playlists_screen.dart`, `playlist_detail_screen.dart`, `follower_list_screen.dart`, `membership_panel.dart`, `my_memberships_screen.dart`, `profile_screen.dart`, `profile_settings_screen.dart`, `program_viewer_screen.dart`, every `studio_*_screen.dart` (12 files), `live_screen.dart`, `live_watch_screen.dart`, `stream_chat_panel.dart`, `stream_poll_panel.dart`, `stream_qa_panel.dart`, `discover_courses_screen.dart`, `upload_screen.dart`, `feed_screen.dart`, `explore_screen.dart`, `verify_email_screen.dart`, `approval_rejected_screen.dart`.
- **Current implementation** (`lib/features/community/presentation/community_screen.dart:64-232`, representative):
  ```dart
  final client = ref.read(apiClientProvider);
  final res = await client.dio.get('/communities/$_communityId/posts');
  ...
  final response = await client.dio.get('/communities/$_communityId/polls/active');
  ...
  final response = await client.dio.get('/communities/$_communityId/leaderboard');
  ```
  Ten-plus raw endpoint calls are inlined directly in `State` methods of this one 987-line widget. Only 10 `data/*_repository.dart` files exist project-wide (`auth`, `explore/search`, `feed`, `gamification`, `history`, `studio`, `upload`, `watch`) versus 59 presentation files — most features (community, messages, notifications, playlists, live, profile) have **no repository at all**.
- **Problem:** `forge-mobile.md` explicitly requires: *"API abstraction via `core/network`; no raw HTTP in widgets."* This is violated across most of the app. The underlying `ApiClient` (`lib/core/network/api_client.dart`) is well-built (cert pinning, JWT refresh interceptor, secure-storage token injection), but nothing enforces its use through a repository — endpoint strings, response-shape parsing (`res.data['data']`), and error handling are duplicated ad hoc inside `State` classes.
- **Why it matters:** Untestable without spinning up widgets (no unit test can hit these endpoints without mounting the full screen); any API contract change requires hunting through 40+ presentation files instead of one repository; raw `res.data['data'] as List<dynamic>?` parsing scattered everywhere is a runtime-`TypeError` risk with zero compile-time safety.
- **Recommended solution:** Introduce a `data/` repository per feature (mirroring `feed_repository.dart`/`watch_repository.dart` patterns already in the codebase) and migrate screens to depend on typed repository methods + models instead of `client.dio.get(...)` + raw map indexing. Prioritize `community/`, `studio/`, and `live/` first — highest raw-call density.
- **Best-practice reference:** Clean architecture / repository pattern; project's own `forge-mobile.md` and `forge-backend.md` conventions.
- **Estimated effort:** Large — 3-5 days phased across features (do not do as one PR; batch per `forge-git-branching.md`).
- **Expected impact:** Testability, maintainability, and blast-radius containment for future API contract changes across the majority of the app's screens.

### H2 — 47 silent `catch (_) {}` blocks, zero explicit Sentry capture anywhere in `lib/`
- **Files (sample of 47 occurrences):** `lib/core/access/access_session_controller.dart:33,66`, `lib/core/push/forge_push.dart:69`, `lib/features/studio/data/studio_repository.dart:44`, `lib/features/studio/presentation/studio_bundles_screen.dart:73`, `studio_tiers_screen.dart:52`, `studio_rooms_screen.dart:144`, `studio_course_detail_screen.dart:78`, `messages_screen.dart:53`, and 39 more.
- **Current implementation** (`lib/features/messages/presentation/messages_screen.dart:26-38`):
  ```dart
  Future<void> _loadConversations() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/messages/conversations');
      if (mounted) {
        setState(() { _conversations = ...; _loading = false; });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }
  ```
  `grep -rn "Sentry\.\|captureException" lib` returns **zero** hits. `lib/core/observability/sentry_setup.dart` wires Sentry only for *uncaught* `FlutterError`/`PlatformDispatcher` errors — every one of the 47 `catch (_) {}` blocks intercepts the exception before it would ever reach that global handler.
- **Problem:** API failures (network errors, malformed responses, auth edge cases) across almost every feature are swallowed with no log line, no breadcrumb, no Sentry event — only a generic UI fallback (spinner stays/empty state shows). Production is flying blind on the actual failure rate and cause of these paths.
- **Why it matters:** Directly conflicts with `forge-production-stability.md` §Mandatory Pre-Deployment Gate item 8 ("Monitoring & observability — ensure ... error tracking ... cover the change so issues are detectable in production") and `forge-infra-docs.md`'s observability mandate. Sentry is a paid-for, configured dependency (`sentry_flutter: ^9.25.0`) that is effectively unused for handled exceptions.
- **Recommended solution:** Wrap the catch bodies in shared error-handling utility (e.g., `logAndSwallow(e, st, {tag: 'messages.loadConversations'})`) that calls `Sentry.captureException` when Sentry is active, falling back to `debugPrint` in debug/no-DSN builds — then sweep all 47 sites onto it.
- **Best-practice reference:** Sentry Flutter docs — capturing handled exceptions via `Sentry.captureException`.
- **Estimated effort:** 0.5-1 day (shared helper + mechanical sweep).
- **Expected impact:** Restores actual production error visibility for the majority of the app's data-loading paths.

### H3 — No accessibility labels: 0 `Semantics()` widgets in the codebase, 92% of `IconButton`s missing `tooltip`
- **Files:** entire `lib/` tree.
- **Evidence:**
  - `grep -rn "Semantics(" lib` → **0** matches across 102 files.
  - `grep -rn "IconButton(" lib` → **49** matches; `tooltip:` present on only **4** of them (~8%).
  - `grep -rln "flutter_localizations\|AppLocalizations" lib` and `find . -iname "*.arb"` → **0** — no localization scaffolding either (see M-series below), compounding the screen-reader gap since `tooltip`/label text can't be swapped per-locale anyway.
- **Problem:** `IconButton.tooltip` is Flutter's primary mechanism for giving icon-only buttons an accessible name for TalkBack/VoiceOver; without it, a screen-reader user hears "button" with no description for ~45 of 49 icon actions app-wide (nav bar search/refresh icons, studio action bars, chat send/attach icons, etc.). No custom `Semantics` labels exist to compensate anywhere for complex custom widgets (video player overlays, chip rows, avatar stacks).
- **Why it matters:** This is a hard accessibility/App Store & Play Store compliance gap, not a style nit — VoiceOver/TalkBack users cannot operate roughly 90% of icon-only controls. `forge-frontend-ux.md`'s "Quality" section (mirrored for mobile intent) explicitly calls for accessibility (labels, focus, contrast).
- **Recommended solution:** Add `tooltip:` to every `IconButton` (cheap, mechanical) and add `Semantics(label: ..., button: true)` wrappers around custom tappable non-Material widgets (`GestureDetector` sites — 6 found, e.g. video overlay controls). Treat as a lint-enforced rule going forward (custom `flutter_lints` rule or code-review checklist item).
- **Best-practice reference:** Flutter accessibility guide — "Every actionable widget should have a semantic label."
- **Estimated effort:** 1-2 days for the mechanical `IconButton` sweep; +0.5 day for custom-widget `Semantics` wrapping.
- **Expected impact:** Makes the app screen-reader-usable; removes a store-review/accessibility-audit risk.

### H4 — `flutter analyze` surfaces 20+ deprecated `DropdownButtonFormField`/form-field `value:` usages that will break on the next Flutter major
- **Files:** `studio_bundles_screen.dart:183,201,214,228`, `studio_community_screen.dart:531,554`, `studio_courses_screen.dart:312`, `studio_engagement_screen.dart:477,573,583`, `studio_live_screen.dart:134,152`, `studio_moderation_screen.dart:170,261`, `studio_rooms_screen.dart:172,192,250`, `studio_subscribers_screen.dart:154,179,192`, `studio_tiers_screen.dart:186,248`, `upload_screen.dart:304,360`.
- **Current implementation:** real analyzer output —
  ```
  info • 'value' is deprecated and shouldn't be used. Use initialValue instead. ... This feature was deprecated after v3.33.0-1.0.pre.
  ```
  repeated 20 times across the Studio surface (the creator-facing revenue/management screens).
- **Problem:** Every creator-facing form in Studio uses a deprecated Flutter Form-field API param. Also flagged: `Share`/`shareXFiles` deprecated in `csv_export_util.dart:26` (replace with `SharePlus.instance.share()`), `androidProvider`/`appleProvider` deprecated in `forge_app_check.dart:10-11`, `roomOptions` deprecated in LiveKit usage (`community_voice_room_screen.dart:80`), plus one real `use_build_context_synchronously` bug at `membership_panel.dart:180` (BuildContext used across an async gap without a `mounted` guard — potential crash if the widget is unmounted mid-await).
- **Why it matters:** Deprecated APIs are removed on a schedule; this concentration in Studio (the creator monetization surface) means a routine Flutter SDK bump will break creator-critical screens unless proactively fixed. The `use_build_context_synchronously` site is a live crash/`FlutterError` risk today, not just a future-breakage risk.
- **Recommended solution:** Mechanical `value:` → `initialValue:` rename across the 20 sites; migrate `Share.shareXFiles` → `SharePlus.instance.share(...)`; add `if (!context.mounted) return;` guard at `membership_panel.dart:180`; bump `firebase_app_check` provider param names.
- **Best-practice reference:** `flutter analyze` output (ground truth, ran locally), Flutter deprecation changelog.
- **Estimated effort:** 0.5 day.
- **Expected impact:** Removes a forward-compat landmine on the app's highest-value (creator monetization) screens and fixes one live crash risk.

---

## Medium

### M1 — No localization/i18n scaffolding; ~467 hardcoded `Text('...')` string literals
- **Evidence:** `grep -rln "flutter_localizations\|AppLocalizations" lib` → 0; no `.arb` files anywhere in the repo; `pubspec.yaml` has no `flutter_localizations`/`generate: true` block; `grep -rn "Text('" lib` → 467 hits.
- **Problem:** All UI copy is hardcoded English string literals directly in widget trees (e.g. `app_router.dart`-reachable screens, `feed_screen.dart:116` `Text('FORGE', ...)`, dialog copy in `playlists_screen.dart:50-79`). There is no `AppLocalizations`/`intl`-generated delegate wired into `MaterialApp.router` in `main.dart`.
- **Why it matters:** `intl: ^0.20.3` is already a dependency (used for date/number formatting) but not leveraged for string localization — the app cannot ship additional locales without a full string-extraction pass later. Low urgency for an English-first launch, but the cost of retrofitting grows with every new hardcoded string added (467 today).
- **Recommended solution:** If multi-locale is on the roadmap, introduce `flutter_localizations` + `.arb` files now and route new copy through `AppLocalizations.of(context)` going forward, rather than batch-migrating all 467 existing strings at once.
- **Best-practice reference:** Flutter internationalization guide.
- **Estimated effort:** 1 day for scaffolding; ongoing for string migration.
- **Expected impact:** Unblocks future locale expansion without a costly retrofit.

### M2 — No responsive/tablet layout handling despite iPad being an explicitly supported target
- **Evidence:** `ios/Runner/Info.plist` declares `UISupportedInterfaceOrientations~ipad` (iPad idiom explicitly supported) and `UIDeviceFamily` is not restricted to phone-only. Yet `grep -rln "MediaQuery" lib` → 1 file, `LayoutBuilder` → 0 files, `OrientationBuilder` → 0 files across all 102 files. `main.dart` renders a single fixed `MaterialApp.router` with no breakpoint logic.
- **Problem:** Every screen (feed, watch, studio, community) uses fixed mobile-phone-oriented layouts (`Column`s, fixed `SizedBox` widths as seen throughout `studio_engagement_screen.dart`, `community_screen.dart`). On an iPad or large-screen Android device, this will stretch single-column phone layouts across a much wider viewport with no adaptive grid/multi-pane treatment.
- **Why it matters:** The app declares iPad support at the platform-config level but has no code path that actually adapts to it — a real UX gap for a "premium, modern" product per `forge-frontend-ux.md`'s product-identity mandate, and a likely App Store review friction point (Apple flags iPad-enabled apps that are obviously unadapted phone UI stretched to tablet size).
- **Recommended solution:** Either restrict `UIDeviceFamily`/orientations to phone-only until tablet layouts exist, or introduce a shared breakpoint helper (`LayoutBuilder`-based) starting with the highest-traffic screens (feed, watch, explore).
- **Best-practice reference:** Apple HIG — adaptive layout for iPad; Material adaptive design guidelines.
- **Estimated effort:** Config fix (restrict device family): 15 min. Real tablet adaptation: multi-day, phased.
- **Expected impact:** Removes a store-review risk short-term; improves tablet UX if pursued further.

### M3 — App is hardcoded to dark theme only; no light theme or system-driven `ThemeMode`
- **File:** `lib/main.dart:41-47`
- **Current implementation:**
  ```dart
  return ConnectivityGate(
    child: MaterialApp.router(
      title: 'FORGE',
      theme: AppTheme.dark,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.dark,
      ...
  ```
  `lib/core/theme/app_theme.dart` defines only `AppTheme.dark` — no `AppTheme.light` exists at all.
- **Problem:** `theme:` and `darkTheme:` both point at the same dark `ThemeData`, and `themeMode` is force-set to `ThemeMode.dark` regardless of system setting. This may be an intentional brand decision (dark-first creator platform), but it means there is no user-facing light-mode option and no way to honor `ThemeMode.system`.
- **Why it matters:** Some users need light mode for accessibility (low vision + bright environments, photosensitivity) or simply prefer it; forcing dark mode with no override is a real usability constraint, not just an aesthetic choice.
- **Recommended solution:** If dark-only is a deliberate brand decision, document it explicitly (e.g., a comment in `app_theme.dart` and `FORGE_PROJECT_MASTER.md`) so it isn't mistaken for an oversight; otherwise add `AppTheme.light` and drive `themeMode` from `ThemeMode.system` with a settings override.
- **Best-practice reference:** Material 3 dynamic theming; WCAG guidance on user-controllable contrast/theme.
- **Estimated effort:** Confirm-as-intentional: 15 min. Full light theme: 1-2 days.
- **Expected impact:** Either closes an accessibility gap or formally confirms a brand decision so it stops looking like a gap in future audits.

### M4 — No `errorBuilder` on `GoRouter`; unmatched/deep-link-miss routes fall through to go_router's default error screen
- **File:** `lib/core/router/app_router.dart:139-304`
- **Evidence:** `grep -n "errorBuilder" lib/core/router/app_router.dart` → no match. The `GoRouter(...)` constructor at line 140 configures `navigatorKey`, `initialLocation`, `redirect`, and `routes`, but no `errorBuilder`.
- **Problem:** Any unmatched path — a malformed deep link, a stale push-notification payload routing to a since-removed path, a typo'd `context.push(...)` — renders go_router's generic unstyled error page instead of a branded "not found" screen with a way back into the app.
- **Why it matters:** Push notifications (`forge_push.dart:_routeForMessage`) and deep links are exactly the kind of external, not-fully-trusted input that can produce an unmatched route; without a custom `errorBuilder`, that's a jarring dead-end for the user instead of a graceful recovery path — directly relevant to `forge-frontend-ux.md`'s "`not-found` / `error` boundaries for graceful failures" requirement.
- **Recommended solution:** Add `errorBuilder: (context, state) => NotFoundScreen(...)` with a button back to `/feed`.
- **Best-practice reference:** go_router docs — `errorBuilder`/`errorPageBuilder`.
- **Estimated effort:** 1 hour.
- **Expected impact:** Graceful recovery from bad deep links/push payloads instead of a dead-end error page.

### M5 — Dead/unused `feedProvider` `FutureProvider` alongside manually-managed duplicate state in the same file
- **File:** `lib/features/feed/presentation/feed_screen.dart:15-19`
- **Current implementation:**
  ```dart
  final feedProvider = FutureProvider.autoDispose<List<VideoModel>>((ref) async {
    final repo = ref.read(feedRepositoryProvider);
    final page = await repo.getFeed();
    return page.videos;
  });
  ```
  `grep -rn "feedProvider" lib` shows this provider is never `ref.watch`/`ref.read` anywhere else in the codebase. Instead, `_FeedScreenState` (lines 28-90) manually manages an equivalent `List<VideoModel> _videos` field, populated via direct `feedRepositoryProvider` calls in `_loadInitial()`/`_loadMore()`.
- **Problem:** Two parallel, inconsistent state-management strategies exist for the exact same data (a declared-but-unused `AsyncValue`-backed provider, and a hand-rolled `setState` list with manual pagination/error flags). This is Riverpod-pattern debt: the "correct" idiomatic approach (`AsyncValue.when` + `ref.watch`) is defined but abandoned mid-refactor in favor of manual state, likely because pagination/infinite-scroll needs outgrew a plain `FutureProvider`.
- **Why it matters:** Confusing for future maintainers (which one is the source of truth?), and it's dead code inflating the file. Not itself a bug today since nothing reads the unused provider.
- **Recommended solution:** Delete the unused `feedProvider`, or — if pagination-aware state is the real need — migrate to `AsyncNotifierProvider`/`riverpod_generator` (already a dev dependency: `riverpod_generator: ^4.0.4`) and drop the manual `_videos` bookkeeping properly instead of leaving both.
- **Best-practice reference:** Riverpod docs — prefer `AsyncNotifier` for paginated/mutable async state over ad hoc `setState`.
- **Estimated effort:** 30 min (delete) or 1 day (proper migration).
- **Expected impact:** Removes confusing dead code; clarifies the feed's actual state-management pattern.

### M6 — `Image.network` used directly (bypassing cache) in two hot paths instead of the project's own `CachedNetworkImage`
- **Files:** `lib/features/watch/presentation/watch_screen.dart:605`, `lib/features/community/presentation/community_screen.dart:561`.
- **Evidence:** `cached_network_image: ^3.3.1` is a declared dependency and used in 5 files elsewhere, but these two sites use raw `Image.network(...)` instead.
- **Problem:** `Image.network` has no disk cache and re-fetches on every rebuild/scroll-back, unlike `CachedNetworkImage` which the rest of the app correctly standardizes on.
- **Why it matters:** Inconsistent caching behavior means these two spots re-download images unnecessarily — wasted bandwidth and slower perceived load, contrary to `forge-performance.md`'s "prioritize performance... resource efficiency" mandate.
- **Recommended solution:** Swap both call sites to `CachedNetworkImage`.
- **Best-practice reference:** `cached_network_image` package docs.
- **Estimated effort:** 15 min.
- **Expected impact:** Consistent image caching, reduced redundant network calls on two visible screens.

### M7 — Very large `build()` methods / files concentrate complexity in a handful of Studio & Community screens
- **Files:** `lib/features/studio/presentation/studio_engagement_screen.dart` (752 lines total; single `build()` spans ~289 lines), `lib/features/community/presentation/community_screen.dart` (987 lines, largest file in the app), `studio_community_screen.dart` (678 lines), `live_watch_screen.dart` (620 lines).
- **Problem:** `studio_engagement_screen.dart`'s `_StudioEngagementScreenState` owns 10 `TextEditingController` fields (announcements, polls, wiki, challenges, surveys) and a 289-line `build()` handling all of them inline, plus raw `client.dio` calls (see H1) and community-fetch logic, all in one class.
- **Why it matters:** Violates `forge-core.md`'s architecture principle to avoid "giant components/services" and keep "separation of concerns." Large build methods are harder to test, review, and are more prone to accidental rebuild-scope bugs (an unrelated `setState` triggers the entire 289-line tree to re-diff).
- **Recommended solution:** Extract each Studio "feature panel" (announcements, polls, wiki, challenges, surveys) into its own `ConsumerWidget`/`ConsumerStatefulWidget`, each owning its own controllers and calling into a shared `StudioEngagementRepository` (ties into H1's fix).
- **Best-practice reference:** Flutter "extract widget" refactor guidance; single-responsibility principle.
- **Estimated effort:** 1-2 days per large file, best done alongside the H1 repository-extraction work.
- **Expected impact:** Smaller rebuild scope, easier testing/review, fewer merge conflicts on high-traffic Studio files.

---

## Low

### L1 — 5 `StatefulWidget`/17 `StatelessWidget` raw base classes still in use alongside 53 Riverpod `Consumer*` widgets
- **Evidence:** `grep -rl "extends StatefulWidget"` → 5 files; `extends StatelessWidget` → 17 files; `ConsumerWidget`/`ConsumerStatefulWidget` → 53 files.
- **Problem:** Not inherently wrong (plenty of leaf widgets legitimately don't need Riverpod), but worth a quick pass to confirm none of the 5 raw `StatefulWidget`s are reaching into `ProviderScope` via a service-locator anti-pattern instead of `Consumer`.
- **Recommended solution:** Spot-check the 5 files; low priority, informational only.
- **Estimated effort:** 30 min.

### L2 — `ListView(children: [...])` (non-virtualized) used in 25 files vs `.builder`/`.separated` in 21
- **Files:** notably `studio_engagement_screen.dart`, `studio_community_screen.dart`, `community_screen.dart`, `watch_screen.dart`, `explore_screen.dart`, `library_screen.dart`, and 19 more (full list captured during grep).
- **Problem:** Plain `ListView(children: ...)` builds and keeps every child in memory/tree immediately rather than lazily, unlike `.builder`. For most of these files the lists are short, bounded settings/action-panel content (acceptable use), but a few (e.g., `community_screen.dart`'s post/comment sections, `watch_screen.dart`'s related-content sections) render potentially unbounded server-driven collections this way rather than via `.builder`.
- **Recommended solution:** Audit each of the 25 sites individually; convert any rendering unbounded/paginated API data to `ListView.builder`. Fixed, short, static-length lists (e.g., a 3-item settings menu) are fine as-is — this is a per-site judgment call, not a blanket problem.
- **Best-practice reference:** Flutter performance docs — `ListView.builder` for long/unbounded lists.
- **Estimated effort:** 0.5-1 day audit + fixes for confirmed unbounded cases.

### L3 — Only 1 `GridView` usage across the app; course/video discovery grids largely list-based
- **Observation:** `grep -rn "GridView" lib` → 1 hit. Not necessarily wrong for a feed-first product, but worth confirming discovery/library surfaces (`discover_courses_screen.dart`, `library_screen.dart`) are deliberately list-first rather than missing a grid treatment that would suit thumbnail-heavy browsing better.
- **Recommended solution:** UX call, not a defect — flagged for design review only.
- **Estimated effort:** N/A (design decision).

### L4 — Thin automated test coverage relative to app size
- **Evidence:** `find test -name "*.dart"` → 13 test files for 102 `lib/` files (~13% file-level ratio). Existing tests (`test/unit/`) correctly avoid live network per `forge-testing.md` (confirmed via `ApiClient`'s constructor test seams for `Dio`/`FlutterSecureStorage`/refresh-Dio injection).
- **Problem:** Coverage exists for auth-redirect/router logic (referenced in `app_router.dart` comments) and core network, but large feature surfaces (Studio's 12 screens, Community's 7 screens, Live) appear to have no dedicated unit tests found under `test/`.
- **Recommended solution:** Prioritize unit tests for the repository-extraction work in H1 — new repositories are the natural, mockable test boundary `forge-testing.md` calls for.
- **Best-practice reference:** `forge-testing.md` (project rule).
- **Estimated effort:** Ongoing, ties to H1 rollout.

---

## Notable Positives (for balance/context)

- **`ApiClient`** (`lib/core/network/api_client.dart`) is well-engineered: certificate pinning, JWT access/refresh rotation with a dedicated non-recursive refresh `Dio` instance, secure-storage token injection via interceptor, and force-logout on refresh failure.
- **Token storage** correctly uses `flutter_secure_storage` (Keychain/Keystore-backed) — no `SharedPreferences` used for tokens anywhere (`grep` confirms zero `SharedPreferences` usage app-wide).
- **Offline cache** (`lib/core/cache/local_cache.dart`) is a clean, bounded (30-item LRU) Hive-backed cache with clear test seams — a genuinely good offline-first building block per `forge-mobile.md`.
- **Video playback** (`watch_screen.dart`'s `_HlsPlayerBlock`) correctly: pauses on app backgrounding (`didChangeAppLifecycleState`), disposes `VideoPlayerController`/`ChewieController` together, records final watch position on dispose, and streams via HLS (native adaptive bitrate) rather than a fixed-quality MP4.
- **Resumable/chunked upload** (`lib/features/upload/data/multipart_upload.dart`, `upload_repository.dart`) implements real S3 multipart upload with checkpoint persistence and resume — matches `forge-mobile.md`'s "background-friendly uploads" intent well.
- **Push notifications** (`lib/core/push/forge_push.dart`) correctly handle foreground/background/terminated launch, deep-link-on-tap routing, token refresh re-registration, and deregistration on logout.
- **Release-build safety net**: `AppConstants.assertValidForRelease()` fails closed if a release build is ever pointed at a non-HTTPS API base URL — a good guardrail.
- **Router** (`app_router.dart`) is a single, well-organized `go_router` table with a real, testable `resolveRedirect()` pure function (deliberately factored out for unit testing per its own comments) covering session/onboarding/creator-tier gating.
- No `print(` debug statements left in the codebase (only 2 intentional `debugPrint` calls, both justified fallback-logging paths).
- No hardcoded secrets/API keys found in source.

---

## Findings Summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 4 |
| Medium | 7 |
| Low | 4 |
| **Total** | **16** |

---

## Mobile Score: 6.5/10

**Justification:**

- **Architecture (weakest area):** The repository/data-layer pattern the project mandates (`forge-mobile.md`: "API abstraction via `core/network`; no raw HTTP in widgets") exists and is well-built where used, but is bypassed in 71% of presentation files (H1). This is the single biggest structural debt — it doesn't crash production today, but it makes the majority of the app hard to test and expensive to change safely, and directly contradicts a documented project convention.
- **Performance:** Good fundamentals — bounded offline cache, HLS adaptive playback with proper lifecycle/dispose handling, resumable multipart uploads, mostly-correct `.builder` usage for long lists, `CachedNetworkImage` used almost everywhere. Deductions for the confirmed controller leak (C1), two `Image.network` stragglers (M6), and unbounded `ListView(children:)` in a handful of high-volume screens (L2).
- **Production stability / observability:** Mixed. Sentry is configured for uncaught errors and there's a fail-closed release-URL guard, but 47 handled exceptions are silently swallowed with zero explicit Sentry capture (H2) — meaning the app's actual production error rate for network/data failures is currently invisible. This is the most consequential gap relative to `forge-production-stability.md`'s explicit observability requirement.
- **UX/platform readiness:** Solid core UX plumbing (go_router, push deep-linking, secure token/session handling) but accessibility is a real gap (H3: zero `Semantics`, 92% of icon buttons unlabeled) and there's no localization or tablet-adaptive layout despite iPad being declared as a supported target (M1, M2). Dark-only theming (M3) may be intentional but is undocumented as such.
- **Code health:** `flutter analyze` is clean of true errors in `lib/` (only info-level deprecations, concentrated in Studio's 20 form-field `value:` usages) plus one real `use_build_context_synchronously` bug (H4) — manageable, mechanical fixes, not structural rot.

**Bottom line:** The networking/security/offline foundation (`ApiClient`, secure storage, Hive cache, video pipeline, push, uploads) is genuinely production-grade. The score is held back by a systemic architecture-convention violation (raw HTTP in widgets), an observability blind spot on handled errors, and an accessibility gap — all fixable without a rewrite, but requiring real engineering time (est. 1-2 sprints) rather than a quick patch.
