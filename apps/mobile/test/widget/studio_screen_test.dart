import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/features/studio/presentation/studio_screen.dart';

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

  testWidgets('renders the dashboard with no urgent items', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/attention': (_) => jsonResponse({
            'data': {'counts': {}, 'items': []},
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioScreen(), client: client);

    expect(find.text('Comments, moderation, and processing'), findsOneWidget);
    expect(find.text('Videos'), findsOneWidget);
    expect(find.text('Analytics'), findsOneWidget);
  });

  testWidgets('shows an urgent-count badge when attention items exist', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/attention': (_) => jsonResponse({
            'data': {
              'counts': {'commentsNeedingReply': 3, 'pendingModeration': 2},
              'items': [],
            },
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioScreen(), client: client);

    expect(find.text('5'), findsOneWidget);
    expect(find.text('Items need your review'), findsOneWidget);
  });

  testWidgets('opens the create sheet with quick actions', (tester) async {
    final client = fakeApiClient({
      'GET /creators/me/attention': (_) => jsonResponse({
            'data': {'counts': {}, 'items': []},
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioScreen(), client: client);

    await tapAndSettle(tester, find.widgetWithText(FloatingActionButton, 'Create'));

    expect(find.text('Pick what you want to publish next.'), findsOneWidget);
    expect(find.text('Upload video'), findsOneWidget);
    expect(find.text('Go live'), findsWidgets);
  });
}
