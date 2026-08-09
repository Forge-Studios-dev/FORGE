import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/features/studio/presentation/studio_copilot_screen.dart';

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

  testWidgets('shows an error state when analytics fail to load', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/business-analytics': failWith('/creators/me/business-analytics'),
    });

    await pumpForgeScreen(tester, const StudioCopilotScreen(), client: client);

    expect(find.text('Could not load AI insights'), findsOneWidget);
  });

  testWidgets('shows an error state when the insights request fails', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/business-analytics': (_) => jsonResponse({
            'data': {
              'membership': {'active': 10, 'mrrCents': 1000},
              'kpis': {'churnRate30d': 0.1, 'engagementScore': 0.5},
            },
          }),
      'POST /creators/me/copilot/insights': failWith('/creators/me/copilot/insights'),
    });

    await pumpForgeScreen(tester, const StudioCopilotScreen(), client: client);

    expect(find.text('Could not load AI insights'), findsOneWidget);
  });

  testWidgets('renders summary, growth focus, and recommendations', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/business-analytics': (_) => jsonResponse({
            'data': {
              'membership': {'active': 10, 'mrrCents': 1000},
              'kpis': {'churnRate30d': 0.1, 'engagementScore': 0.5},
            },
          }),
      'POST /creators/me/copilot/insights': (_) => jsonResponse({
            'data': {
              'summary': 'Your channel is growing steadily.',
              'growthFocus': 'Post shorts twice a week.',
              'recommendations': ['Reply to top comments', 'Go live monthly'],
            },
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCopilotScreen(), client: client);

    expect(find.text('Your channel is growing steadily.'), findsOneWidget);
    expect(find.text('Post shorts twice a week.'), findsOneWidget);
    expect(find.text('Reply to top comments'), findsOneWidget);
    expect(find.text('Go live monthly'), findsOneWidget);
  });
}
