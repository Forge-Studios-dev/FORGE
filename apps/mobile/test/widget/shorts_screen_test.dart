import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/shorts/presentation/shorts_screen.dart';

import 'test_support/widget_harness.dart';

Map<String, dynamic> _short(
  String id, {
  String title = 'A short',
  String username = 'creator',
  bool viewerLiked = false,
  bool viewerDisliked = false,
  bool viewerSubscribed = false,
  int likeCount = 0,
  int commentCount = 0,
}) =>
    {
      'id': id,
      'userId': 'creator-1',
      'title': title,
      'status': 'ready',
      'videoType': 'short',
      'durationSeconds': 30,
      'viewCount': 0,
      'likeCount': likeCount,
      'commentCount': commentCount,
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

ResponseBody _shortsPage(List<Map<String, dynamic>> videos, {bool hasMore = false, String? cursor}) =>
    jsonResponse({
      'data': {
        'data': videos,
        'meta': {'cursor': cursor, 'hasMore': hasMore},
      },
    });

void main() {
  late TestCache cache;

  setUp(() async {
    installFakeSecureStorage();
    cache = await TestCache.open();
  });

  tearDown(() async {
    await cache.dispose();
  });

  testWidgets('shows an error state with Retry when the shorts feed fails to load', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': failWith('/videos/shorts'),
    });

    await pumpForgeScreen(tester, const ShortsScreen(), client: client);

    expect(find.text('Couldn’t load Shorts'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });

  testWidgets('shows an empty state when there are no shorts', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': (_) => _shortsPage([]),
    });

    await pumpForgeScreen(tester, const ShortsScreen(), client: client);

    expect(find.text('No Shorts yet'), findsOneWidget);
  });

  testWidgets('renders a short with title and channel', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': (_) => _shortsPage([_short('s1', title: 'Intro Short', username: 'alice')]),
      'GET /playlists/me/watch-later/contains/s1': (_) => jsonResponse({'data': {'inWatchLater': false}}),
    });

    await pumpForgeScreen(tester, const ShortsScreen(), client: client);

    expect(find.text('Intro Short'), findsOneWidget);
    expect(find.text('@alice'), findsOneWidget);
  });

  testWidgets('likes a short optimistically', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': (_) => _shortsPage([_short('s1', likeCount: 5)]),
      'GET /playlists/me/watch-later/contains/s1': (_) => jsonResponse({'data': {'inWatchLater': false}}),
      'POST /videos/s1/like': (_) => jsonResponse({'data': {}}),
    });

    await pumpForgeScreen(tester, const ShortsScreen(), client: client);

    expect(find.text('5'), findsOneWidget);
    await tapAndSettle(tester, find.byIcon(Icons.thumb_up_outlined));

    expect(find.byIcon(Icons.thumb_up), findsOneWidget);
    expect(find.text('6'), findsOneWidget);
  });

  testWidgets('rolls back a like on failure', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': (_) => _shortsPage([_short('s1', likeCount: 5)]),
      'GET /playlists/me/watch-later/contains/s1': (_) => jsonResponse({'data': {'inWatchLater': false}}),
      'POST /videos/s1/like': failWith('/videos/s1/like'),
    });
    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;

    await pumpForgeScreen(tester, const ShortsScreen(), client: client);

    await tapAndSettle(tester, find.byIcon(Icons.thumb_up_outlined));

    // The failure-rollback end state is identical to "never tapped" — assert
    // the mutation actually fired so a broken tap (e.g. gesture-arena delay
    // eaten by the slide's double-tap-to-like detector) can't masquerade as
    // a passing rollback.
    expect(adapter.requests.any((r) => r.method == 'POST' && r.uri.path == '/videos/s1/like'), isTrue);
    expect(find.byIcon(Icons.thumb_up_outlined), findsOneWidget);
    expect(find.text('5'), findsOneWidget);
  });

  testWidgets('disliking clears an existing like', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': (_) => _shortsPage([_short('s1', likeCount: 5, viewerLiked: true)]),
      'GET /playlists/me/watch-later/contains/s1': (_) => jsonResponse({'data': {'inWatchLater': false}}),
      'POST /videos/s1/dislike': (_) => jsonResponse({'data': {}}),
    });

    await pumpForgeScreen(tester, const ShortsScreen(), client: client);
    expect(find.byIcon(Icons.thumb_up), findsOneWidget);

    await tapAndSettle(tester, find.byIcon(Icons.thumb_down_outlined));

    expect(find.byIcon(Icons.thumb_down), findsOneWidget);
    expect(find.byIcon(Icons.thumb_up_outlined), findsOneWidget);
    expect(find.text('4'), findsOneWidget);
  });

  testWidgets('subscribes to the creator', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': (_) => _shortsPage([_short('s1')]),
      'GET /playlists/me/watch-later/contains/s1': (_) => jsonResponse({'data': {'inWatchLater': false}}),
      'POST /channels/creator-1/subscribe': (_) => jsonResponse({'data': {}}),
    });

    await pumpForgeScreen(tester, const ShortsScreen(), client: client);

    expect(find.text('Subscribe'), findsOneWidget);
    // _ShortAction's label Text is a sibling of the tappable InkWell, not
    // wrapped by it — must tap the icon, not the label.
    await tapAndSettle(tester, find.byIcon(Icons.person_add_alt_1));

    expect(find.text('Subscribed'), findsOneWidget);
  });

  testWidgets('saves a short to watch later', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': (_) => _shortsPage([_short('s1')]),
      'GET /playlists/me/watch-later/contains/s1': (_) => jsonResponse({'data': {'inWatchLater': false}}),
      'POST /playlists/me/watch-later/videos': (_) => jsonResponse({'data': {}}),
    });

    await pumpForgeScreen(tester, const ShortsScreen(), client: client);

    expect(find.text('Save'), findsOneWidget);
    await tapAndSettle(tester, find.byIcon(Icons.bookmark_border));

    expect(find.text('Saved'), findsOneWidget);
  });

  testWidgets('marking a short not interested removes it from the feed', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': (_) => _shortsPage([_short('s1', title: 'Only short')]),
      'GET /playlists/me/watch-later/contains/s1': (_) => jsonResponse({'data': {'inWatchLater': false}}),
      'POST /videos/s1/not-interested': (_) => jsonResponse({'data': {}}),
    });

    await pumpForgeScreen(tester, const ShortsScreen(), client: client);

    // more_vert is nested inside the same GestureDetector.onDoubleTap
    // ancestor as the like/save/subscribe buttons — same real gesture-arena
    // wait applies, so this needs tapAndSettle too, not a plain tap+pump.
    await tapAndSettle(tester, find.byIcon(Icons.more_vert));
    await tapAndSettle(tester, find.text('Not interested'));

    expect(find.text('No Shorts yet'), findsOneWidget);
  });

  testWidgets('blocks the creator after confirming', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': (_) => _shortsPage([_short('s1', title: 'Only short')]),
      'GET /playlists/me/watch-later/contains/s1': (_) => jsonResponse({'data': {'inWatchLater': false}}),
      'POST /users/creator-1/block': (_) => jsonResponse({'data': {}}),
    });

    await pumpForgeScreen(tester, const ShortsScreen(), client: client);

    await tapAndSettle(tester, find.byIcon(Icons.more_vert));
    await tapAndSettle(tester, find.text('Block user'));
    await tapAndSettle(tester, find.text('Block'));

    expect(find.text('No Shorts yet'), findsOneWidget);
  });

  testWidgets('pins a deep-linked short to the front of the feed', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': (_) => _shortsPage([_short('feed1', title: 'Feed short')]),
      'GET /videos/deep1': (_) => jsonResponse({'data': _short('deep1', title: 'Deep linked short')}),
      'GET /playlists/me/watch-later/contains/deep1': (_) => jsonResponse({'data': {'inWatchLater': false}}),
    });

    await pumpForgeScreen(tester, const ShortsScreen(initialVideoId: 'deep1'), client: client);

    expect(find.text('Deep linked short'), findsOneWidget);
  });

  testWidgets('shows an unavailable state for a blocked deep link with no feed fallback', (tester) async {
    final client = fakeApiClient({
      'GET /videos/shorts': (_) => _shortsPage([]),
      'GET /videos/deep1': (_) => throw DioException(
            requestOptions: RequestOptions(path: '/videos/deep1'),
            response: Response(requestOptions: RequestOptions(path: '/videos/deep1'), statusCode: 403),
            type: DioExceptionType.badResponse,
          ),
    });

    await pumpForgeScreen(tester, const ShortsScreen(initialVideoId: 'deep1'), client: client);

    expect(find.text('This Short is not available'), findsOneWidget);
  });
}
