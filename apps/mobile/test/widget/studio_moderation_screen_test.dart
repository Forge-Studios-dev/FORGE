import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/studio/presentation/studio_moderation_screen.dart';

import 'test_support/widget_harness.dart';

ResponseBody _list(List<Map<String, dynamic>> items) => jsonResponse({'data': items});

ResponseBody _inbox({
  List<Map<String, dynamic>> items = const [],
  int total = 0,
  bool hasMore = false,
  String? cursor,
}) =>
    jsonResponse({
      'data': {
        'data': items,
        'meta': {
          'cursor': cursor,
          'hasMore': hasMore,
          'total': total,
        },
      },
    });

Map<String, ResponseBody Function(RequestOptions)> _baseHandlers({
  List<Map<String, dynamic>> communities = const [
    {'id': 'com1', 'name': 'Pottery club'},
  ],
  List<Map<String, dynamic>> reports = const [],
  List<Map<String, dynamic>> roles = const [],
  List<Map<String, dynamic>> bans = const [],
  List<Map<String, dynamic>> inbox = const [],
  int inboxTotal = 0,
}) =>
    {
      'GET /creators/me/moderated-communities': (_) => _list(communities),
      'GET /creators/me/communities/com1/reports': (_) => _list(reports),
      'GET /creators/me/communities/com1/roles': (_) => _list(roles),
      'GET /creators/me/communities/com1/bans': (_) => _list(bans),
      'GET /creators/me/moderation/inbox': (_) =>
          _inbox(items: inbox, total: inboxTotal == 0 ? inbox.length : inboxTotal),
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

  testWidgets('shows an empty state with no moderated communities', (tester) async {
    final client = fakeApiClient(_baseHandlers(communities: []));

    await pumpForgeScreen(tester, const StudioModerationScreen(), client: client);

    expect(find.text('No moderated communities assigned'), findsOneWidget);
  });

  testWidgets('renders nested API community shape and unified inbox', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(
        communities: [
          {
            'communityId': 'com1',
            'role': 'moderator',
            'community': {'id': 'com1', 'name': 'Pottery club', 'slug': 'pottery'},
          },
        ],
        reports: [
          {'id': 'rep1', 'reason': 'Spam', 'targetType': 'comment', 'status': 'open'},
        ],
        inbox: [
          {
            'id': 'rep1',
            'communityId': 'com1',
            'communityName': 'Pottery club',
            'targetType': 'comment',
            'reason': 'Spam',
            'status': 'open',
          },
        ],
        inboxTotal: 1,
      ),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioModerationScreen(), client: client);

    expect(find.textContaining('Open reports'), findsOneWidget);
    expect(find.text('Spam'), findsWidgets);
    expect(find.widgetWithText(TextButton, 'Review'), findsOneWidget);
  });

  testWidgets('renders and resolves an open report', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(reports: [
        {'id': 'rep1', 'reason': 'Spam', 'targetType': 'comment', 'status': 'open'},
      ]),
      'PATCH /creators/me/communities/com1/reports/rep1/resolve': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioModerationScreen(), client: client);

    expect(find.text('Spam'), findsOneWidget);
    expect(find.text('comment · open'), findsOneWidget);

    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Resolve'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any(
        (r) => r.method == 'PATCH' && r.uri.path == '/creators/me/communities/com1/reports/rep1/resolve',
      ),
      isTrue,
    );
  });

  testWidgets('assigns a role to a member', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(),
      'POST /creators/me/communities/com1/roles': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioModerationScreen(), client: client);

    await tapAndSettle(tester, find.widgetWithText(ChoiceChip, 'Roles'));
    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'User ID to assign role'), 'u1');
    });
    await drainAsync(tester);
    await tapAndSettle(tester, find.widgetWithText(ElevatedButton, 'Assign role'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any((r) => r.method == 'POST' && r.uri.path == '/creators/me/communities/com1/roles'),
      isTrue,
    );
  });

  testWidgets('bans and unbans a member', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(bans: [
        {'userId': 'u2', 'reason': 'Harassment'},
      ]),
      'POST /creators/me/communities/com1/bans': (_) => jsonResponse({'data': {}}),
      'POST /creators/me/communities/com1/bans/u2/remove': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioModerationScreen(), client: client);

    await tapAndSettle(tester, find.widgetWithText(ChoiceChip, 'Bans'));
    expect(find.text('u2'), findsOneWidget);
    expect(find.text('Harassment'), findsOneWidget);

    await tapAndSettle(tester, find.widgetWithText(TextButton, 'Unban'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any(
        (r) => r.method == 'POST' && r.uri.path == '/creators/me/communities/com1/bans/u2/remove',
      ),
      isTrue,
    );
  });
}
