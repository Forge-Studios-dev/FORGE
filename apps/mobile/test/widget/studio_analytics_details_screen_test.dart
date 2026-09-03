import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/features/studio/presentation/studio_analytics_details_screen.dart';

import 'test_support/widget_harness.dart';

void main() {
  late TestCache cache;

  setUp(() async {
    installFakeSecureStorage();
    cache = await TestCache.open();
  });

  tearDown(() async {
    await cache.dispose();
  });

  testWidgets('shows empty state when performance has no top videos', (tester) async {
    final client = fakeApiClient({
      'GET /analytics/studio/video-performance': (_) => jsonResponse({
            'data': {
              'impressions': 0,
              'ctr': 0,
              'avgWatchPercent': 0,
              'periodDays': 28,
              'topVideos': <Map<String, dynamic>>[],
            },
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioAnalyticsDetailsScreen(), client: client);

    expect(find.text('Video performance'), findsWidgets);
    expect(find.textContaining('No video performance yet'), findsOneWidget);
  });

  testWidgets('renders top video rows', (tester) async {
    final client = fakeApiClient({
      'GET /analytics/studio/video-performance': (_) => jsonResponse({
            'data': {
              'impressions': 1000,
              'ctr': 0.05,
              'avgWatchPercent': 40,
              'periodDays': 28,
              'topVideos': [
                {
                  'videoId': 'v1',
                  'title': 'Throwing demo',
                  'views': 50,
                  'impressions': 200,
                  'ctr': 0.1,
                  'avgWatchPercent': 55,
                },
              ],
            },
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioAnalyticsDetailsScreen(), client: client);

    expect(find.text('Throwing demo'), findsOneWidget);
    expect(find.textContaining('50 views'), findsOneWidget);
  });
}
