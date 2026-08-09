import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/studio/presentation/studio_subscribers_screen.dart';

import 'test_support/widget_harness.dart';

ResponseBody _me({String id = 'creator-1'}) => jsonResponse({
      'data': {'id': id},
    });

ResponseBody _list(List<Map<String, dynamic>> items) => jsonResponse({'data': items});

Map<String, ResponseBody Function(RequestOptions)> _baseHandlers({
  List<Map<String, dynamic>> subscribers = const [],
  List<Map<String, dynamic>> tiers = const [],
  List<Map<String, dynamic>> communities = const [],
}) =>
    {
      'GET /users/me': (_) => _me(),
      'GET /creators/me/subscribers': (_) => _list(subscribers),
      'GET /creators/creator-1/tiers': (_) => _list(tiers),
      'GET /creators/creator-1/communities': (_) => _list(communities),
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

  testWidgets('renders subscribers with a suspend action for active members', (tester) async {
    final client = fakeApiClient(_baseHandlers(subscribers: [
      {'id': 'sub1', 'userId': 'u1', 'displayName': 'Bob', 'tierName': 'Gold', 'status': 'active'},
      {'id': 'sub2', 'userId': 'u2', 'displayName': 'Ann', 'tierName': 'Silver', 'status': 'suspended'},
    ]));

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioSubscribersScreen(), client: client);

    expect(find.text('Bob'), findsWidgets);
    expect(find.text('Gold · active'), findsOneWidget);
    expect(find.text('Silver · suspended'), findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Suspend'), findsOneWidget);
  });

  testWidgets('suspends an active subscriber', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(subscribers: [
        {'id': 'sub1', 'userId': 'u1', 'displayName': 'Bob', 'tierName': 'Gold', 'status': 'active'},
      ]),
      'POST /creators/me/subscribers/sub1/suspend': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioSubscribersScreen(), client: client);

    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Suspend'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any((r) => r.method == 'POST' && r.uri.path == '/creators/me/subscribers/sub1/suspend'),
      isTrue,
    );
  });

  testWidgets('grants membership once a user id and tier are chosen', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(tiers: [
        {'id': 'tier1', 'name': 'Gold'},
      ]),
      'POST /creators/me/subscribers/grant': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioSubscribersScreen(), client: client);

    FilledButton grantButton() => tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Grant membership'));
    expect(grantButton().onPressed, isNull);

    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'Or enter user UUID'), 'u9');
    });
    await drainAsync(tester);
    await tapAndSettle(tester, find.widgetWithText(DropdownButtonFormField<String>, 'Tier'));
    await tapAndSettle(tester, find.text('Gold').last);

    expect(grantButton().onPressed, isNotNull);

    await tapAndSettle(tester, find.widgetWithText(FilledButton, 'Grant membership'));

    expect(find.text('Membership granted'), findsOneWidget);
  });
}
