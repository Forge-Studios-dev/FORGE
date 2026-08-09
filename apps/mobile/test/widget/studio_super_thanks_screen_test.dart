import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/features/studio/presentation/studio_super_thanks_screen.dart';

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

  testWidgets('shows an error state when tips fail to load', (tester) async {
    final client = fakeApiClient({
      'GET /billing/super-thanks/received': failWith('/billing/super-thanks/received'),
    });

    await pumpForgeScreen(tester, const StudioSuperThanksScreen(), client: client);

    expect(find.text('Failed to load Super Thanks'), findsOneWidget);
    final exportButton = tester.widget<TextButton>(find.widgetWithText(TextButton, 'Export CSV'));
    expect(exportButton.onPressed, isNull);
  });

  testWidgets('shows an empty state with no tips', (tester) async {
    final client = fakeApiClient({
      'GET /billing/super-thanks/received': (_) => jsonResponse({
            'data': {'data': [], 'summary': null},
          }),
    });

    await pumpForgeScreen(tester, const StudioSuperThanksScreen(), client: client);

    expect(find.text('No Super Thanks yet. Tips from viewers will show here.'), findsOneWidget);
    final exportButton = tester.widget<TextButton>(find.widgetWithText(TextButton, 'Export CSV'));
    expect(exportButton.onPressed, isNull);
  });

  testWidgets('renders the summary and a list of tips, with export enabled', (tester) async {
    final client = fakeApiClient({
      'GET /billing/super-thanks/received': (_) => jsonResponse({
            'data': {
              'data': [
                {
                  'tipper': {'displayName': 'Bob'},
                  'amountCents': 500,
                  'creatorNetCents': 450,
                  'videoTitle': 'Intro to FORGE',
                  'body': 'Great video!',
                },
              ],
              'summary': {'totalAmountCents': 500, 'totalCreatorNetCents': 450, 'totalTips': 1},
            },
          }),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioSuperThanksScreen(), client: client);

    expect(find.text('Bob'), findsOneWidget);
    expect(find.text('Intro to FORGE'), findsOneWidget);
    expect(find.text('Great video!'), findsOneWidget);
    expect(find.textContaining('1 tips'), findsOneWidget);
    final exportButton = tester.widget<TextButton>(find.widgetWithText(TextButton, 'Export CSV'));
    expect(exportButton.onPressed, isNotNull);
  });
}
