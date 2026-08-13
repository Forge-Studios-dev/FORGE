import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/feed/presentation/feed_screen.dart';

import 'test_support/widget_harness.dart';

Map<String, dynamic> _video(
  String id, {
  String title = 'A video',
  bool viewerLiked = false,
  int likeCount = 0,
}) =>
    {
      'id': id,
      'userId': 'creator-1',
      'title': title,
      'status': 'ready',
      'viewCount': 0,
      'likeCount': likeCount,
      'commentCount': 0,
      'viewerLiked': viewerLiked,
      'user': {
        'id': 'creator-1',
        'username': 'creator',
        'displayName': 'Creator',
        'role': 'creator',
        'followerCount': 0,
        'followingCount': 0,
        'videoCount': 0,
      },
      'createdAt': '2026-01-01T00:00:00.000Z',
    };

ResponseBody _feedPage(List<Map<String, dynamic>> videos, {bool hasMore = false, String? cursor}) =>
    jsonResponse({
      'data': {
        'data': videos,
        'meta': {'cursor': cursor, 'hasMore': hasMore},
      },
    });

ResponseBody _historyPage(List<Map<String, dynamic>> videos) => jsonResponse({
      'data': {'data': videos},
    });

ResponseBody _unreadCount(int count) => jsonResponse({
      'data': {'count': count},
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

  testWidgets('renders feed videos after a successful load', (tester) async {
    final client = fakeApiClient({
      'GET /videos/feed': (_) => _feedPage([_video('v1', title: 'Intro to FORGE')]),
      'GET /users/me/watch-history': (_) => _historyPage([]),
      'GET /notifications/unread-count': (_) => _unreadCount(0),
    });

    await pumpForgeScreen(tester, const FeedScreen(), client: client);

    expect(find.text('Intro to FORGE'), findsOneWidget);
    expect(find.text('@creator'), findsOneWidget);
  });

  testWidgets('shows an empty state when the feed has no videos', (tester) async {
    final client = fakeApiClient({
      'GET /videos/feed': (_) => _feedPage([]),
      'GET /users/me/watch-history': (_) => _historyPage([]),
      'GET /notifications/unread-count': (_) => _unreadCount(0),
    });

    await pumpForgeScreen(tester, const FeedScreen(), client: client);

    expect(find.text('Your feed is empty'), findsOneWidget);
  });

  testWidgets('shows an error state with Retry when the feed fails to load', (tester) async {
    final client = fakeApiClient({
      'GET /videos/feed': failWith('/videos/feed'),
      'GET /users/me/watch-history': (_) => _historyPage([]),
      'GET /notifications/unread-count': (_) => _unreadCount(0),
    });

    await pumpForgeScreen(tester, const FeedScreen(), client: client);

    expect(find.text('Could not load feed'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });

  testWidgets('shows the unread notification badge count', (tester) async {
    final client = fakeApiClient({
      'GET /videos/feed': (_) => _feedPage([_video('v1')]),
      'GET /users/me/watch-history': (_) => _historyPage([]),
      'GET /notifications/unread-count': (_) => _unreadCount(3),
    });

    await pumpForgeScreen(tester, const FeedScreen(), client: client);

    expect(find.text('3'), findsOneWidget);
  });

  testWidgets('shows the continue-watching rail when history has in-progress videos', (tester) async {
    final client = fakeApiClient({
      'GET /videos/feed': (_) => _feedPage([_video('v1')]),
      'GET /users/me/watch-history': (_) => _historyPage([
            {..._video('cw1', title: 'Halfway watched'), 'viewerProgressSeconds': 30, 'durationSeconds': 120},
          ]),
      'GET /notifications/unread-count': (_) => _unreadCount(0),
    });

    await pumpForgeScreen(tester, const FeedScreen(), client: client);

    expect(find.text('Continue watching'), findsOneWidget);
    expect(find.text('Halfway watched'), findsOneWidget);
  });

  testWidgets('likes a video optimistically', (tester) async {
    final client = fakeApiClient({
      'GET /videos/feed': (_) => _feedPage([_video('v1', likeCount: 5, viewerLiked: false)]),
      'GET /users/me/watch-history': (_) => _historyPage([]),
      'GET /notifications/unread-count': (_) => _unreadCount(0),
      'POST /videos/v1/like': (_) => jsonResponse({'data': {}}),
    });

    await pumpForgeScreen(tester, const FeedScreen(), client: client);

    expect(find.text('5'), findsOneWidget);
    await tapAndSettle(tester, find.byIcon(Icons.thumb_up_outlined));

    expect(find.byIcon(Icons.thumb_up), findsOneWidget);
    expect(find.text('6'), findsOneWidget);
  });

  testWidgets('exposes accessible labels on the like/comment/share buttons', (tester) async {
    final handle = tester.ensureSemantics();

    final client = fakeApiClient({
      'GET /videos/feed': (_) => _feedPage([_video('v1', likeCount: 5, viewerLiked: false)]),
      'GET /users/me/watch-history': (_) => _historyPage([]),
      'GET /notifications/unread-count': (_) => _unreadCount(0),
    });

    await pumpForgeScreen(tester, const FeedScreen(), client: client);

    expect(
      tester.getSemantics(find.byIcon(Icons.thumb_up_outlined)),
      matchesSemantics(label: 'Like, 5 likes', isButton: true),
    );
    expect(
      tester.getSemantics(find.byIcon(Icons.comment_outlined)),
      matchesSemantics(label: 'Comment, 0 comments', isButton: true),
    );
    expect(
      tester.getSemantics(find.byIcon(Icons.share_outlined)),
      matchesSemantics(label: 'Share', isButton: true),
    );

    handle.dispose();
  });

  testWidgets('rolls back the like and shows a sign-in prompt on failure', (tester) async {
    final client = fakeApiClient({
      'GET /videos/feed': (_) => _feedPage([_video('v1', likeCount: 5, viewerLiked: false)]),
      'GET /users/me/watch-history': (_) => _historyPage([]),
      'GET /notifications/unread-count': (_) => _unreadCount(0),
      'POST /videos/v1/like': failWith('/videos/v1/like'),
    });

    await pumpForgeScreen(tester, const FeedScreen(), client: client);

    await tapAndSettle(tester, find.byIcon(Icons.thumb_up_outlined));

    expect(find.byIcon(Icons.thumb_up_outlined), findsOneWidget);
    expect(find.text('5'), findsOneWidget);
    expect(find.text('Sign in to like videos'), findsOneWidget);
  });
}
