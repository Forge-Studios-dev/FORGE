import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/core/widgets/forge_button.dart';
import 'package:forge_mobile/features/studio/presentation/studio_comments_screen.dart';

import 'test_support/widget_harness.dart';

ResponseBody _studioComments(List<Map<String, dynamic>> comments) => jsonResponse({
      'data': {
        'data': comments,
        'meta': {'cursor': null, 'hasMore': false, 'filter': 'all'},
      },
    });

Map<String, dynamic> _commentJson(
  String id, {
  String content = 'Great video!',
  String username = 'viewer1',
  String videoId = 'v1',
  String videoTitle = 'Intro to FORGE',
  bool isPinned = false,
  bool creatorHearted = false,
  bool isDeleted = false,
}) =>
    {
      'id': id,
      'videoId': videoId,
      'videoTitle': videoTitle,
      'videoType': 'video',
      'content': content,
      'isPinned': isPinned,
      'creatorHearted': creatorHearted,
      'isDeleted': isDeleted,
      'moderationStatus': 'none',
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
      'GET /creators/me/comments': (_) => _studioComments([]),
    });

    await pumpForgeScreen(tester, const StudioCommentsScreen(), client: client);

    expect(find.text('When viewers comment on your videos, they will appear here.'), findsOneWidget);
  });

  testWidgets('renders comments and filters by search', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/comments': (options) {
        final q = options.uri.queryParameters['q'];
        if (q == 'nomatch') return _studioComments([]);
        return _studioComments([_commentJson('c1', content: 'Loved this!')]);
      },
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCommentsScreen(), client: client);

    expect(find.text('Loved this!'), findsOneWidget);

    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'Search comments'), 'nomatch');
    });
    await tester.pump(const Duration(milliseconds: 350));
    await drainAsync(tester);

    expect(find.text('Loved this!'), findsNothing);
    expect(find.text('No comments match "nomatch"'), findsOneWidget);
  });

  testWidgets('pins a comment', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/comments': (_) => _studioComments([_commentJson('c1')]),
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
      'GET /creators/me/comments': (_) => _studioComments([_commentJson('c1')]),
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
      'GET /creators/me/comments': (_) => _studioComments([_commentJson('c1')]),
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

  testWidgets('renders a tombstone for a deleted comment with no moderation actions', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/comments': (_) => _studioComments([
            _commentJson('c1', content: 'This was removed', username: 'gone', isDeleted: true),
          ]),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCommentsScreen(), client: client);

    expect(find.text('[deleted]'), findsOneWidget);
    expect(find.text('This was removed'), findsNothing);
    expect(find.text('@gone'), findsNothing);
    expect(find.widgetWithText(TextButton, 'Pin'), findsNothing);
    expect(find.widgetWithText(TextButton, 'Heart'), findsNothing);
    expect(find.widgetWithText(TextButton, 'Remove'), findsNothing);
    expect(find.widgetWithText(TextButton, 'Reply'), findsNothing);
  });
}
