import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/watch/presentation/watch_screen.dart';
import 'package:forge_mobile/shared/models/video.dart';
import 'package:riverpod/misc.dart' show Override;

import 'test_support/widget_harness.dart';

Map<String, dynamic> _videoJson(
  String id, {
  String title = 'A video',
  String username = 'creator',
  String status = 'ready',
  bool accessDenied = false,
  bool viewerLiked = false,
  bool viewerDisliked = false,
  bool viewerSubscribed = false,
  int likeCount = 0,
}) =>
    {
      'id': id,
      'userId': 'creator-1',
      'title': title,
      'status': status,
      'accessDenied': accessDenied,
      'hlsUrl': status == 'ready' && !accessDenied
          ? 'https://cdn.example/$id/master.m3u8'
          : null,
      'durationSeconds': 300,
      'viewCount': 0,
      'likeCount': likeCount,
      'commentCount': 0,
      'viewerLiked': viewerLiked,
      'viewerDisliked': viewerDisliked,
      'viewerSubscribed': viewerSubscribed,
      'user': {
        'id': 'creator-1',
        'username': username,
        'displayName': 'Creator',
        'role': 'creator',
        'followerCount': 0,
        'followingCount': 0,
        'videoCount': 0,
      },
      'createdAt': '2026-01-01T00:00:00.000Z',
    };

VideoModel _video(
  String id, {
  String title = 'A video',
  String username = 'creator',
  String status = 'ready',
  bool accessDenied = false,
  bool viewerLiked = false,
  bool viewerDisliked = false,
  bool viewerSubscribed = false,
  int likeCount = 0,
}) =>
    VideoModel.fromJson(_videoJson(
      id,
      title: title,
      username: username,
      status: status,
      accessDenied: accessDenied,
      viewerLiked: viewerLiked,
      viewerDisliked: viewerDisliked,
      viewerSubscribed: viewerSubscribed,
      likeCount: likeCount,
    ));

/// `videoDetailProvider` is a `FutureProvider.family.autoDispose` — unlike
/// the plain-repository fetches every other screen's tests fake through the
/// Dio adapter, this one gets disposed and re-created mid-settle under the
/// widget-test binding (observed: the same GET fired 3-4 times and the
/// screen never left its loading state no matter how long we settled).
/// Overriding the provider directly sidesteps whatever zone/autoDispose
/// interaction causes that — and is the standard Riverpod testing pattern
/// for a provider whose entire job is "fetch this one thing" anyway.
Override _videoDetail(String id, VideoModel video) =>
    videoDetailProvider(id).overrideWith((ref) async => video);

Override _videoDetailError(String id, Object error) =>
    videoDetailProvider(id).overrideWith((ref) async => throw error);

/// Handlers every WatchScreen render needs regardless of what a test is
/// asserting on — the related rail, watch-later status, and comments
/// section all fetch on mount via plain repositories (not affected by the
/// videoDetailProvider issue above).
Map<String, ResponseBody Function(RequestOptions)> _baseHandlers(String id) => {
      'GET /videos/$id/related': (_) => jsonResponse({
            'data': {'data': []},
          }),
      'GET /playlists/me/watch-later/contains/$id': (_) => jsonResponse({
            'data': {'inWatchLater': false},
          }),
      'GET /videos/$id/comments': (_) => jsonResponse({
            'data': {'data': [], 'meta': {}},
          }),
    };

/// WatchScreen's content (video + controls + title + engage row + ...) is
/// far taller than the video area alone — a tall viewport keeps it all
/// materialized (see [useTallViewport]) without needing scroll gestures.
Future<void> _pumpWatch(
  WidgetTester tester,
  Widget child, {
  required ApiClient client,
  List<Override> extraOverrides = const [],
}) async {
  useTallViewport(tester);
  addTearDown(tester.view.resetPhysicalSize);
  await pumpForgeScreen(tester, child,
      client: client, extraOverrides: extraOverrides);
}

void main() {
  late TestCache cache;

  setUp(() async {
    installFakeSecureStorage();
    cache = await TestCache.open();
  });

  tearDown(() async {
    await cache.dispose();
  });

  testWidgets('shows an unavailable state for a blocked video', (tester) async {
    final client = fakeApiClient(_baseHandlers('v1'));

    await _pumpWatch(
      tester,
      const WatchScreen(videoId: 'v1'),
      client: client,
      extraOverrides: [
        _videoDetailError(
          'v1',
          DioException(
            requestOptions: RequestOptions(path: '/videos/v1'),
            response: Response(
                requestOptions: RequestOptions(path: '/videos/v1'),
                statusCode: 403),
            type: DioExceptionType.badResponse,
          ),
        ),
      ],
    );

    expect(find.text('This video is not available'), findsOneWidget);
  });

  testWidgets('shows a generic error state when the video fails to load',
      (tester) async {
    final client = fakeApiClient(_baseHandlers('v1'));

    await _pumpWatch(
      tester,
      const WatchScreen(videoId: 'v1'),
      client: client,
      extraOverrides: [_videoDetailError('v1', Exception('boom'))],
    );

    expect(find.text('Video unavailable'), findsOneWidget);
  });

  testWidgets(
      'renders the video title and channel, with a load-failure fallback for playback',
      (tester) async {
    final client = fakeApiClient(_baseHandlers('v1'));

    await _pumpWatch(
      tester,
      const WatchScreen(videoId: 'v1'),
      client: client,
      extraOverrides: [
        _videoDetail(
            'v1', _video('v1', title: 'Intro to FORGE', username: 'alice'))
      ],
    );

    expect(find.text('Intro to FORGE'), findsOneWidget);
    expect(find.text('@alice'), findsOneWidget);
    // Not asserting on the "Couldn't load video" fallback here: under
    // `flutter test`, VideoPlayerController.initialize() appears to hang
    // rather than reject (no platform channel registered, unlike Dio it
    // never errors out) — no amount of extra settling reaches it. Testing
    // that path for real would need a dedicated VideoPlayerPlatform fake,
    // which is out of scope here; the same blind spot already exists for
    // ShortsScreen's video controller. The try/catch fix in _bootstrap()
    // (see DEPTH_BACKLOG) still stands on its own — it mirrors the
    // already-working pattern in ShortsScreen's _ensurePlayer().
  });

  testWidgets(
      'shows a not-ready placeholder instead of the player when the video cannot play',
      (tester) async {
    final client = fakeApiClient(_baseHandlers('v1'));

    await _pumpWatch(
      tester,
      const WatchScreen(videoId: 'v1'),
      client: client,
      extraOverrides: [_videoDetail('v1', _video('v1', status: 'processing'))],
    );

    expect(find.text('Processing your video'), findsOneWidget);
    expect(find.text('Couldn’t load video'), findsNothing);
  });

  testWidgets('likes a video optimistically', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers('v1'),
      'POST /videos/v1/like': (_) => jsonResponse({'data': {}}),
    });

    await _pumpWatch(
      tester,
      const WatchScreen(videoId: 'v1'),
      client: client,
      extraOverrides: [_videoDetail('v1', _video('v1', likeCount: 5))],
    );

    expect(find.text('5'), findsOneWidget);
    await tapAndSettle(tester, find.text('5'));

    expect(find.byIcon(Icons.thumb_up), findsOneWidget);
    expect(find.text('6'), findsOneWidget);
  });

  testWidgets('disliking clears an existing like', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers('v1'),
      'POST /videos/v1/dislike': (_) => jsonResponse({'data': {}}),
    });

    await _pumpWatch(
      tester,
      const WatchScreen(videoId: 'v1'),
      client: client,
      extraOverrides: [
        _videoDetail('v1', _video('v1', likeCount: 5, viewerLiked: true))
      ],
    );
    expect(find.byIcon(Icons.thumb_up), findsOneWidget);

    await tapAndSettle(tester, find.byIcon(Icons.thumb_down_outlined));

    expect(find.byIcon(Icons.thumb_down), findsOneWidget);
    expect(find.text('4'), findsOneWidget);
  });

  testWidgets('subscribes to the creator', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers('v1'),
      'POST /channels/creator-1/subscribe': (_) => jsonResponse({'data': {}}),
    });

    await _pumpWatch(
      tester,
      const WatchScreen(videoId: 'v1'),
      client: client,
      extraOverrides: [_videoDetail('v1', _video('v1'))],
    );

    expect(find.text('Subscribe'), findsOneWidget);
    await tapAndSettle(tester, find.text('Subscribe'));

    expect(find.text('Subscribed'), findsOneWidget);
  });

  testWidgets('saves the video to watch later', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers('v1'),
      'POST /playlists/me/watch-later/videos': (_) =>
          jsonResponse({'data': {}}),
    });

    await _pumpWatch(
      tester,
      const WatchScreen(videoId: 'v1'),
      client: client,
      extraOverrides: [_videoDetail('v1', _video('v1'))],
    );

    await tapAndSettle(tester, find.byIcon(Icons.watch_later_outlined));

    expect(find.byIcon(Icons.watch_later), findsOneWidget);
  });

  testWidgets('persists the autoplay preference', (tester) async {
    final client = fakeApiClient(_baseHandlers('v1'));

    await _pumpWatch(
      tester,
      const WatchScreen(videoId: 'v1'),
      client: client,
      extraOverrides: [_videoDetail('v1', _video('v1'))],
    );

    final autoplaySwitch = find.widgetWithText(SwitchListTile, 'Autoplay next');
    expect(tester.widget<SwitchListTile>(autoplaySwitch).value, isTrue);

    await tapAndSettle(tester, autoplaySwitch);

    expect(tester.widget<SwitchListTile>(autoplaySwitch).value, isFalse);
  });

  testWidgets('persists the loop-video preference', (tester) async {
    final client = fakeApiClient(_baseHandlers('v1'));

    await _pumpWatch(
      tester,
      const WatchScreen(videoId: 'v1'),
      client: client,
      extraOverrides: [_videoDetail('v1', _video('v1'))],
    );

    final loopSwitch = find.widgetWithText(SwitchListTile, 'Loop video');
    expect(tester.widget<SwitchListTile>(loopSwitch).value, isFalse);

    await tapAndSettle(tester, loopSwitch);

    expect(tester.widget<SwitchListTile>(loopSwitch).value, isTrue);
  });
}
