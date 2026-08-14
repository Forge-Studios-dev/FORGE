import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/cache/local_cache.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:hive/hive.dart';

import '../../unit/test_support/fakes.dart';

/// Handlers keyed by `'METHOD /resolved/path'` (query string ignored —
/// widget screens often fan out several concurrent requests whose exact
/// dispatch order isn't worth pinning a test to). Unlike [QueuedAdapter]
/// (strict call order, one repository at a time), this fits a whole screen
/// wiring multiple providers that all read [apiClientProvider].
class MapHttpAdapter implements HttpClientAdapter {
  MapHttpAdapter(Map<String, ResponseBody Function(RequestOptions)> handlers)
      : _handlers = Map.of(handlers);

  final Map<String, ResponseBody Function(RequestOptions)> _handlers;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final key = '${options.method} ${options.uri.path}';
    final handler = _handlers[key];
    if (handler == null) {
      throw StateError(
        'No handler for $key (registered: ${_handlers.keys.join(', ')})',
      );
    }
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

/// A [MapHttpAdapter] response that always fails with a connection error —
/// for exercising a screen's offline/error branch.
ResponseBody Function(RequestOptions) failWith(String path) =>
    (_) => throw DioException(
          requestOptions: RequestOptions(path: path),
          type: DioExceptionType.connectionError,
        );

/// Builds an [ApiClient] backed by [MapHttpAdapter] — the same `dio:` test
/// seam (HIGH-09) the repository unit tests use, just with path-keyed
/// responses instead of a strict queue.
ApiClient fakeApiClient(
    Map<String, ResponseBody Function(RequestOptions)> handlers) {
  final dio = Dio()..httpClientAdapter = MapHttpAdapter(handlers);
  return ApiClient(dio: dio);
}

/// Installs an in-memory FlutterSecureStorage backend — real widgets read the
/// access token via [ApiClient]'s request interceptor on every call, and the
/// real plugin has no implementation under `flutter test`.
void installFakeSecureStorage() {
  FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
}

/// Widens the test surface to [height] so a long scrollable screen's whole
/// content is inside the viewport at once. `ListView`/`Sliver`-based screens
/// only materialize children within the viewport (unlike a plain `Column`
/// inside a `SingleChildScrollView`, which builds everything regardless of
/// visibility) — content below the default 800x600 test window's fold
/// genuinely doesn't exist in the widget tree yet, so `find.text(...)` on it
/// fails with "0 widgets found" rather than a timing or error symptom.
/// Reaches for scrolling instead when the content only needs to be tapped,
/// not universally present. Call `tester.view.resetPhysicalSize()` in
/// `tearDown` (or via `addTearDown`) to undo this before the next test.
void useTallViewport(WidgetTester tester, {double height = 3000}) {
  tester.view.physicalSize = Size(800, height);
  tester.view.devicePixelRatio = 1.0;
}

/// Hive-backed [LocalCache] sandbox — several repositories
/// (feed/history/watch) read or write it unconditionally, so any widget test
/// touching those needs a working cache even when not asserting on it.
class TestCache {
  TestCache._(this._dir);
  final Directory _dir;

  static Future<TestCache> open() async {
    final dir = await Directory.systemTemp.createTemp('forge_widget_test');
    Hive.init(dir.path);
    final box = await Hive.openBox<String>('test_cache');
    await LocalCache.init(box: box);
    return TestCache._(dir);
  }

  Future<void> dispose() async {
    // Hive.deleteFromDisk() hangs under the widget-test binding (unlike the
    // plain `test()` environment repository specs run in) — close explicitly
    // and remove the temp directory ourselves instead.
    await Hive.close();
    if (await _dir.exists()) await _dir.delete(recursive: true);
  }
}

// A `testWidgets` body does NOT run in a zone that drains genuine async I/O
// on its own — an `await` on a real Future (our fake Dio adapter included)
// started outside `tester.runAsync()` never resolves, full stop, even with
// zero `pump()` calls involved (proven directly: `await repo.getFeed()` at
// the top of a bare `testWidgets` body hangs forever; the identical call in
// a plain `test()` — as in `feed_repository_test.dart` — resolves
// instantly). `pumpAndSettle()` doesn't fix this either, since it only
// drains Flutter's own frame/animation scheduling, not arbitrary Futures.
//
// The fix per Flutter's own `tester.runAsync` contract: the call chain must
// *originate* inside `runAsync` for its continuation to run in the real
// zone. `initState()`-triggered fire-and-forget async work (e.g.
// `_loadInitial()`) is kicked off synchronously by `pumpWidget`, and an
// `onTap` handler's async work is kicked off synchronously by `tester.tap`
// — so both `pumpWidget` and `tester.tap` themselves must be called from
// inside `runAsync`, not just awaited afterward.

/// Pumps [child] under a [ProviderScope] with [apiClientProvider] overridden
/// to [client], inside a bare [MaterialApp] (no go_router) — sufficient for
/// screens whose navigation only fires from tap callbacks that a given test
/// doesn't trigger. Runs the initial pump inside [WidgetTester.runAsync] (see
/// note above) so `initState`-triggered repository/provider fetches actually
/// resolve, then pumps twice more to reflect the resulting frame(s).
// One rebuild can mount a *new* widget whose own initState fires *another*
// real async call (e.g. FeedScreen resolving unmounts its skeleton and
// mounts a _ShortSlide, whose initState immediately calls
// isInWatchLater()). That second call is triggered by a `pump()`, so if the
// pumps happen outside `runAsync` (as a naive "runAsync once, then pump
// outside" split would do), its continuation lands back in the broken fake
// zone and its underlying Dio timer never gets cancelled before the test
// ends — surfacing as a "Pending timers" test failure, not a hang. Fix:
// interleave the pumps and real delays *inside one runAsync block* so every
// cascade of mount -> fetch -> rebuild -> mount stays in the real zone.
// Also comfortably clears Flutter's own kDoubleTapTimeout (300ms): any tap
// landing on a widget with an ancestor GestureDetector.onDoubleTap (e.g.
// ShortsScreen's per-slide double-tap-to-like) must win a real gesture-arena
// wait before its own onTap fires — settling too early makes the tap look
// like a silent no-op rather than throwing, so watch for a test whose
// assertions describe "before" state passing when the action should have
// changed something (that's this happening, not a passing test).
// Also, `pump()` with no argument advances Flutter's animation clock by
// zero — a still-transitioning route (e.g. PopupMenuButton's own entrance
// animation) leaves an IgnorePointer/AbsorbPointer in the hit-test path,
// so a tap on its content fails with "would not hit test on the specified
// widget" until that route finishes opening. Pass the same duration to
// `pump` so the fake clock and the real delay advance together.
const _kSettleRounds = 5;
const _kSettleDelay = Duration(milliseconds: 150);

/// Runs another round of settling beyond what [pumpForgeScreen]/[tapAndSettle]
/// already do — for a chain that needs more real time than most (e.g. a
/// second real async hop nested behind the first, like a video controller's
/// own `initialize()` rejecting after the screen's main data has already
/// resolved). Safe to call repeatedly; each call is another full
/// `_kSettleRounds` pass.
Future<void> drainAsync(WidgetTester tester) => _pumpAndDrain(tester);

Future<void> _pumpAndDrain(WidgetTester tester) async {
  await tester.runAsync(() async {
    for (var i = 0; i < _kSettleRounds; i++) {
      await tester.pump(_kSettleDelay);
      await Future<void>.delayed(_kSettleDelay);
    }
  });
}

Future<void> pumpForgeScreen(
  WidgetTester tester,
  Widget child, {
  required ApiClient client,
  List<Override> extraOverrides = const [],
}) async {
  await tester.runAsync(() async {
    await tester.pumpWidget(
      ProviderScope(
        // Riverpod 3's default retry policy re-runs a failed
        // FutureProvider/AsyncNotifier with exponential backoff, staying in
        // `AsyncLoading` (carrying the previous error) the whole time —
        // `.when()` dispatches on runtime type, so that reads as still
        // "loading" and never reaches the `error:` branch. Confirmed via a
        // build()-level debug print showing repeated
        // `AsyncLoading<T>(error: ..., stackTrace: ...)` states that never
        // settle no matter how long the test waits. Screens that manage
        // their own load/error state manually (FeedScreen, ShortsScreen)
        // never hit this; any screen using `ref.watch` on a
        // FutureProvider/AsyncNotifier directly for its data will.
        retry: (_, __) => null,
        overrides: [
          apiClientProvider.overrideWithValue(client),
          ...extraOverrides,
        ],
        child: MaterialApp(home: child),
      ),
    );
    await Future<void>.delayed(_kSettleDelay);
  });
  await _pumpAndDrain(tester);
}

/// Taps [finder] and lets the resulting `onTap` async work (e.g. an
/// optimistic-update mutation) actually resolve — see the `runAsync` note
/// above; a bare `tester.tap` + `pump`/`pumpAndSettle` never observes its
/// real network round trip.
Future<void> tapAndSettle(WidgetTester tester, Finder finder) async {
  await tester.runAsync(() async {
    await tester.tap(finder);
    await Future<void>.delayed(_kSettleDelay);
  });
  await _pumpAndDrain(tester);
}

ResponseBody jsonResponse(Map<String, dynamic> body, {int statusCode = 200}) =>
    ResponseBody.fromString(
      jsonEncode(body),
      statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
