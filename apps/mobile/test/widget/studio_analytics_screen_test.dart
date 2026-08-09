import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/studio/presentation/studio_analytics_screen.dart';

import 'test_support/widget_harness.dart';

Map<String, dynamic> _videoJson(String id, {String title = 'A video', int viewCount = 0, int likeCount = 0}) => {
      'id': id,
      'userId': 'creator-1',
      'title': title,
      'status': 'ready',
      'viewCount': viewCount,
      'likeCount': likeCount,
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
      'GET /creators/me/business-analytics': failWith('/creators/me/business-analytics'),
      'GET /analytics/studio/video-performance': failWith('/analytics/studio/video-performance'),
    });

    await pumpForgeScreen(tester, const StudioAnalyticsScreen(), client: client);

    expect(find.text('Upload videos to track views and engagement.'), findsOneWidget);
  });

  testWidgets('renders totals and falls back to the video list with no performance data', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([
            _videoJson('v1', title: 'Intro to FORGE', viewCount: 100, likeCount: 10),
          ]),
      'GET /creators/me/business-analytics': failWith('/creators/me/business-analytics'),
      'GET /analytics/studio/video-performance': failWith('/analytics/studio/video-performance'),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioAnalyticsScreen(), client: client);

    expect(find.text('100'), findsOneWidget);
    expect(find.text('10'), findsOneWidget);
    expect(find.text('Intro to FORGE'), findsOneWidget);
    expect(find.text('100 views'), findsOneWidget);
  });

  testWidgets('renders performance stats, top videos, and business membership', (tester) async {
    final client = fakeApiClient({
      'GET /videos/studio': (_) => _studioVideos([_videoJson('v1', title: 'Intro to FORGE')]),
      'GET /creators/me/business-analytics': (_) => jsonResponse({
            'data': {
              'membership': {'active': 12, 'mrrCents': 50000},
              'funnel': [],
            },
          }),
      'GET /analytics/studio/video-performance': (_) => jsonResponse({
            'data': {
              'impressions': 5000,
              'ctr': 0.045,
              'avgWatchPercent': 62,
              'periodDays': 28,
              'topVideos': [
                {'videoId': 'v1', 'title': 'Intro to FORGE', 'views': 100, 'impressions': 2000, 'ctr': 0.05, 'avgWatchPercent': 60},
              ],
            },
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioAnalyticsScreen(), client: client);

    expect(find.text('5000'), findsOneWidget);
    expect(find.text('4.5%'), findsOneWidget);
    expect(find.text('62%'), findsOneWidget);
    expect(find.text('Active: 12 · MRR ₹500'), findsOneWidget);
    expect(find.text('Export videos CSV'), findsOneWidget);
    expect(find.textContaining('100 views · 2000 impr.'), findsOneWidget);
  });
}
