import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/studio/presentation/studio_tiers_screen.dart';

import 'test_support/widget_harness.dart';

ResponseBody _me({String id = 'creator-1'}) => jsonResponse({
      'data': {'id': id},
    });

ResponseBody _list(List<Map<String, dynamic>> items) => jsonResponse({'data': items});

Map<String, ResponseBody Function(RequestOptions)> _baseHandlers({
  List<Map<String, dynamic>> tiers = const [],
  List<Map<String, dynamic>> communities = const [],
  bool connected = false,
}) =>
    {
      'GET /users/me': (_) => _me(),
      'GET /creators/creator-1/tiers': (_) => _list(tiers),
      'GET /creators/creator-1/communities': (_) => _list(communities),
      'GET /billing/connect/status': (_) => jsonResponse({
            'data': {'connected': connected, 'payoutsEnabled': connected},
          }),
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

  testWidgets('prompts to connect Stripe and lists existing tiers', (tester) async {
    final client = fakeApiClient(_baseHandlers(tiers: [
      {'id': 't1', 'name': 'Gold', 'priceCents': 999, 'maxConcurrentDevices': 2},
    ]));

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioTiersScreen(), client: client);

    expect(find.text('Complete onboarding to accept paid memberships'), findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Connect'), findsOneWidget);
    expect(find.text('Gold'), findsOneWidget);
    expect(find.text('\$9.99 · 2 device(s)'), findsOneWidget);
  });

  testWidgets('shows payouts enabled once Stripe Connect is complete', (tester) async {
    final client = fakeApiClient(_baseHandlers(connected: true));

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioTiersScreen(), client: client);

    expect(find.text('Payouts enabled — paid checkout available'), findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Connect'), findsNothing);
  });

  testWidgets('creates a tier', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(),
      'POST /creators/me/tiers': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioTiersScreen(), client: client);

    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'Tier name'), 'Gold');
    });
    await drainAsync(tester);
    await tapAndSettle(tester, find.widgetWithText(ElevatedButton, 'Create tier'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(adapter.requests.any((r) => r.method == 'POST' && r.uri.path == '/creators/me/tiers'), isTrue);
    expect(find.text('Tier created'), findsOneWidget);
  });

  testWidgets('expands a tier and adds an entitlement', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(tiers: [
        {'id': 't1', 'name': 'Gold', 'priceCents': 999, 'maxConcurrentDevices': 2},
      ]),
      'POST /creators/me/tiers/t1/entitlements': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioTiersScreen(), client: client);

    await tapAndSettle(tester, find.text('Gold'));
    expect(find.text('Add entitlement'), findsWidgets);

    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Add entitlement'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any((r) => r.method == 'POST' && r.uri.path == '/creators/me/tiers/t1/entitlements'),
      isTrue,
    );
    expect(find.text('Entitlement added'), findsOneWidget);
  });
}
