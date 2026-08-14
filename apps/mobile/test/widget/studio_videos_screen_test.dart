import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/studio/presentation/studio_videos_screen.dart';

import 'test_support/widget_harness.dart';

Map<String, dynamic> _videoJson(String id, {String title = 'A video', String status = 'ready', int viewCount = 0}) => {
      'id': id,
      'userId': 'creator-1',
      'title': title,
      'status': status,
      'viewCount': viewCount,
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

ResponseBody _studioVideos(List<Map<String, dynamic>> videos, {bool hasMore = false}) => jsonResponse({
      'data': {
        'data': videos,
        'pagination': {'page': 1, 'total': videos.length, 'hasMore': hasMore},
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

  testWidgets('shows an empty state with no videos', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([]),
      'GET /categories/upload-options': (_) => jsonResponse({'data': []}),
    });

    await pumpForgeScreen(tester, const StudioVideosScreen(), client: client);

    expect(find.text('No videos yet. Upload your first video.'), findsOneWidget);
  });

  testWidgets('renders videos with status and view count', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([_videoJson('v1', title: 'Intro to FORGE', viewCount: 42)]),
      'GET /categories/upload-options': (_) => jsonResponse({'data': []}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioVideosScreen(), client: client);

    expect(find.text('Intro to FORGE'), findsOneWidget);
    expect(find.textContaining('Ready'), findsOneWidget);
    expect(find.textContaining('42 views'), findsOneWidget);
  });

  testWidgets('debounces search and requeries with the query', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([_videoJson('v1', title: 'Intro to FORGE')]),
      'GET /categories/upload-options': (_) => jsonResponse({'data': []}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioVideosScreen(), client: client);

    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'Search your videos by title'), 'forge');
    });
    await drainAsync(tester);
    await drainAsync(tester);

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any(
        (r) => r.method == 'GET' && r.uri.path == '/videos/studio' && r.uri.queryParameters['search'] == 'forge',
      ),
      isTrue,
    );
  });

  testWidgets('reloads with a status filter when a chip is tapped', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([_videoJson('v1')]),
      'GET /categories/upload-options': (_) => jsonResponse({'data': []}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioVideosScreen(), client: client);

    await tapAndSettle(tester, find.widgetWithText(FilterChip, 'Processing'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any(
        (r) => r.method == 'GET' && r.uri.path == '/videos/studio' && r.uri.queryParameters['status'] == 'processing',
      ),
      isTrue,
    );
  });

  testWidgets('deletes a video after confirming', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([_videoJson('v1', title: 'Intro to FORGE')]),
      'GET /categories/upload-options': (_) => jsonResponse({'data': []}),
      'DELETE /videos/v1': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioVideosScreen(), client: client);

    await tapAndSettle(tester, find.byIcon(Icons.more_vert));
    await tapAndSettle(tester, find.widgetWithText(PopupMenuItem<String>, 'Delete'));
    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Delete'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(adapter.requests.any((r) => r.method == 'DELETE' && r.uri.path == '/videos/v1'), isTrue);
  });
}
