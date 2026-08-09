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
ResponseBody Function(RequestOptions) failWith(String path) => (_) => throw DioException(
      requestOptions: RequestOptions(path: path),
      type: DioExceptionType.connectionError,
    );

/// Builds an [ApiClient] backed by [MapHttpAdapter] — the same `dio:` test
/// seam (HIGH-09) the repository unit tests use, just with path-keyed
/// responses instead of a strict queue.
ApiClient fakeApiClient(Map<String, ResponseBody Function(RequestOptions)> handlers) {
  final dio = Dio()..httpClientAdapter = MapHttpAdapter(handlers);
  return ApiClient(dio: dio);
}

/// Installs an in-memory FlutterSecureStorage backend — real widgets read the
/// access token via [ApiClient]'s request interceptor on every call, and the
/// real plugin has no implementation under `flutter test`.
void installFakeSecureStorage() {
  FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
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
Future<void> pumpForgeScreen(
  WidgetTester tester,
  Widget child, {
  required ApiClient client,
  List<Override> extraOverrides = const [],
}) async {
  await tester.runAsync(() async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(client),
          ...extraOverrides,
        ],
        child: MaterialApp(home: child),
      ),
    );
    await Future<void>.delayed(const Duration(milliseconds: 50));
  });
  await tester.pump();
  await tester.pump();
}

/// Taps [finder] and lets the resulting `onTap` async work (e.g. an
/// optimistic-update mutation) actually resolve — see the `runAsync` note
/// above; a bare `tester.tap` + `pump`/`pumpAndSettle` never observes its
/// real network round trip.
Future<void> tapAndSettle(WidgetTester tester, Finder finder) async {
  await tester.runAsync(() async {
    await tester.tap(finder);
    await Future<void>.delayed(const Duration(milliseconds: 50));
  });
  await tester.pump();
  await tester.pump();
}

ResponseBody jsonResponse(Map<String, dynamic> body, {int statusCode = 200}) => ResponseBody.fromString(
      jsonEncode(body),
      statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
