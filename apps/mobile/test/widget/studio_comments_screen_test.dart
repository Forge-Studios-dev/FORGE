import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/core/widgets/forge_button.dart';
import 'package:forge_mobile/features/studio/presentation/studio_comments_screen.dart';

import 'test_support/widget_harness.dart';

Map<String, dynamic> _videoJson(String id, {String title = 'A video', String status = 'ready'}) => {
      'id': id,
      'userId': 'creator-1',
      'title': title,
      'status': status,
      'viewCount': 0,
      'likeCount': 0,
      'commentCount': 0,
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

ResponseBody _studioVideos(List<Map<String, dynamic>> videos) => jsonResponse({
      'data': {
        'data': videos,
        'pagination': {'page': 1, 'total': videos.length, 'hasMore': false},
      },
    });

ResponseBody _comments(List<Map<String, dynamic>> comments) => jsonResponse({
      'data': {'data': comments},
    });

Map<String, dynamic> _commentJson(
  String id, {
  String content = 'Great video!',
  String username = 'viewer1',
  bool isPinned = false,
  bool creatorHearted = false,
}) =>
    {
      'id': id,
      'content': content,
      'isPinned': isPinned,
      'creatorHearted': creatorHearted,
      'user': {'username': username, 'displayName': username},
      'createdAt': '2026-01-01T00:00:00.000Z',
    };

void main() {
  late TestCache cache;

  setUp(() async {
    installFakeSecureStorage();
    cache = await TestCache.open();
  });

  tearDown(() async {
    await cache.dispose();
  });

  testWidgets('shows an empty state with no comments', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([]),
    });

    await pumpForgeScreen(tester, const StudioCommentsScreen(), client: client);

    expect(find.text('When viewers comment on your videos, they will appear here.'), findsOneWidget);
  });

  testWidgets('renders comments and filters by search', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([_videoJson('v1', title: 'Intro to FORGE')]),
      'GET /videos/v1/comments': (_) => _comments([_commentJson('c1', content: 'Loved this!')]),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCommentsScreen(), client: client);

    expect(find.text('Loved this!'), findsOneWidget);

    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'Search comments'), 'nomatch');
    });
    await drainAsync(tester);

    expect(find.text('Loved this!'), findsNothing);
    expect(find.text('No comments match "nomatch"'), findsOneWidget);
  });

  testWidgets('pins a comment', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([_videoJson('v1')]),
      'GET /videos/v1/comments': (_) => _comments([_commentJson('c1')]),
      'POST /videos/v1/comments/c1/pin': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCommentsScreen(), client: client);

    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Pin'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any((r) => r.method == 'POST' && r.uri.path == '/videos/v1/comments/c1/pin'),
      isTrue,
    );
  });

  testWidgets('replies to a comment', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([_videoJson('v1')]),
      'GET /videos/v1/comments': (_) => _comments([_commentJson('c1')]),
      'POST /videos/v1/comments': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCommentsScreen(), client: client);

    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Reply'));
    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'Write a helpful reply…'), 'Thanks for watching!');
    });
    await drainAsync(tester);
    await tapAndSettle(tester, find.widgetWithText(ForgeButton, 'Post reply'));

    expect(find.text('Reply posted'), findsOneWidget);
  });

  testWidgets('removes a comment after confirming', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([_videoJson('v1')]),
      'GET /videos/v1/comments': (_) => _comments([_commentJson('c1')]),
      'DELETE /videos/v1/comments/c1': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCommentsScreen(), client: client);

    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Remove'));
    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Remove').last);

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any((r) => r.method == 'DELETE' && r.uri.path == '/videos/v1/comments/c1'),
      isTrue,
    );
  });
}
