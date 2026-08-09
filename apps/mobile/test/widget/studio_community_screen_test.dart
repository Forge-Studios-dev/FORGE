import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/studio/presentation/studio_community_screen.dart';

import 'test_support/widget_harness.dart';

ResponseBody _me({String id = 'creator-1'}) => jsonResponse({
      'data': {'id': id},
    });

ResponseBody _list(List<Map<String, dynamic>> items) => jsonResponse({'data': items});

ResponseBody _communityDetail({List<Map<String, dynamic>> categories = const []}) => jsonResponse({
      'data': {'categories': categories},
    });

Map<String, dynamic> _memberRow(String userId, {String displayName = 'Bob'}) => {
      'userId': userId,
      'user': {'displayName': displayName},
      'source': 'joined',
    };

Map<String, ResponseBody Function(RequestOptions)> _baseHandlers({
  List<Map<String, dynamic>> communities = const [
    {'id': 'com1', 'name': 'Pottery club', 'slug': 'pottery'},
  ],
  List<Map<String, dynamic>> pending = const [],
  List<Map<String, dynamic>> active = const [],
  List<Map<String, dynamic>> suspended = const [],
  List<Map<String, dynamic>> categories = const [],
}) =>
    {
      'GET /users/me': (_) => _me(),
      'GET /creators/creator-1/communities': (_) => _list(communities),
      'GET /creators/creator-1/communities/pottery': (_) => _communityDetail(categories: categories),
      'GET /creators/me/communities/com1/members': (req) {
        switch (req.uri.queryParameters['status']) {
          case 'active':
            return _list(active);
          case 'suspended':
            return _list(suspended);
          default:
            return _list(pending);
        }
      },
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

  testWidgets('shows no-community prompt on the members tab', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': (_) => _me(),
      'GET /creators/creator-1/communities': (_) => _list([]),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCommunityScreen(initialTabIndex: 1), client: client);

    expect(find.text('Create a community in Settings first'), findsOneWidget);
  });

  testWidgets('approves a pending member', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(pending: [_memberRow('u1')]),
      'PATCH /creators/me/communities/com1/members/u1/approve': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCommunityScreen(initialTabIndex: 1), client: client);

    expect(find.text('Bob'), findsOneWidget);

    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Approve'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any(
        (r) => r.method == 'PATCH' && r.uri.path == '/creators/me/communities/com1/members/u1/approve',
      ),
      isTrue,
    );
  });

  testWidgets('suspends an active member', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(active: [_memberRow('u2', displayName: 'Ann')]),
      'PATCH /creators/me/communities/com1/members/u2/suspend': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCommunityScreen(initialTabIndex: 1), client: client);

    expect(find.text('Ann'), findsOneWidget);

    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Suspend'));
    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Suspend').last);

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any(
        (r) => r.method == 'PATCH' && r.uri.path == '/creators/me/communities/com1/members/u2/suspend',
      ),
      isTrue,
    );
  });

  testWidgets('creates a community from the settings tab', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': (_) => _me(),
      'GET /creators/creator-1/communities': (_) => _list([]),
      'POST /creators/me/communities': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCommunityScreen(initialTabIndex: 3), client: client);

    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'Community name'), 'Pottery club');
    });
    await drainAsync(tester);
    await tapAndSettle(tester, find.widgetWithText(ElevatedButton, 'Create community'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(adapter.requests.any((r) => r.method == 'POST' && r.uri.path == '/creators/me/communities'), isTrue);
  });

  testWidgets('adds a category to the community', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(),
      'POST /creators/me/communities/com1/categories': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioCommunityScreen(initialTabIndex: 3), client: client);

    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'New category name'), 'Glazing');
    });
    await drainAsync(tester);
    await tapAndSettle(tester, find.widgetWithText(ElevatedButton, 'Add category'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any((r) => r.method == 'POST' && r.uri.path == '/creators/me/communities/com1/categories'),
      isTrue,
    );
  });
}
