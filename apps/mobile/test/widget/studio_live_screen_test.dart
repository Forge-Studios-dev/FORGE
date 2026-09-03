import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/studio/presentation/studio_live_screen.dart';

import 'test_support/widget_harness.dart';

ResponseBody _me({
  String id = 'creator-1',
  String role = 'creator',
  String creatorStatus = 'approved',
  bool isVerified = true,
}) =>
    jsonResponse({
      'data': {
        'id': id,
        'role': role,
        'creatorStatus': creatorStatus,
        'isVerified': isVerified,
      },
    });

ResponseBody _list(List<Map<String, dynamic>> list) => jsonResponse({'data': list});

Map<String, ResponseBody Function(RequestOptions)> _baseHandlers({
  List<Map<String, dynamic>> communities = const [],
  List<Map<String, dynamic>> recent = const [],
  List<Map<String, dynamic>> tiers = const [],
  List<Map<String, dynamic>> categories = const [],
  List<Map<String, dynamic>> live = const [],
  List<Map<String, dynamic>> upcoming = const [],
  ResponseBody Function(RequestOptions)? me,
}) =>
    {
      'GET /users/me': me ?? (_) => _me(),
      'GET /creators/creator-1/communities': (_) => _list(communities),
      'GET /creators/creator-1/tiers': (_) => _list(tiers),
      'GET /categories': (_) => _list(categories),
      'GET /streams/live': (_) => _list(live),
      'GET /streams/upcoming': (_) => _list(upcoming),
      'GET /creators/me/streams/recent': (_) => _list(recent),
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

  testWidgets('renders the setup form with no communities', (tester) async {
    final client = fakeApiClient(_baseHandlers());

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioLiveScreen(), client: client);

    expect(find.text('Go live'), findsWidgets);
    expect(find.text('Chat enabled'), findsOneWidget);
    expect(find.text('DVR (rewind while live)'), findsOneWidget);
    expect(find.text('Browse live sessions'), findsOneWidget);
    expect(find.byType(DropdownButtonFormField<String?>), findsNothing);
  });

  testWidgets('does not start a stream when the title is too short', (tester) async {
    final client = fakeApiClient(_baseHandlers());

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioLiveScreen(), client: client);

    await tapAndSettle(tester, find.widgetWithText(ElevatedButton, 'Go live'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(adapter.requests.any((r) => r.uri.path == '/streams/start'), isFalse);
  });

  testWidgets('shows a snackbar when starting a stream fails', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(),
      'POST /streams/start': failWith('/streams/start'),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioLiveScreen(), client: client);

    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'Session title'), 'Live wheel throwing');
    });
    await drainAsync(tester);
    await tapAndSettle(tester, find.widgetWithText(ElevatedButton, 'Go live'));

    expect(
      find.textContaining('Could not start stream'),
      findsWidgets,
    );
  });

  testWidgets('links to a community when exactly one is available', (tester) async {
    final client = fakeApiClient(
      _baseHandlers(communities: [
        {'id': 'com1', 'name': 'Pottery club'},
      ]),
    );

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioLiveScreen(), client: client);

    expect(find.text('Pottery club'), findsOneWidget);
    expect(find.text('Community live uses members-only visibility.'), findsNothing);
  });

  testWidgets('shows apply CTA when creator is not approved', (tester) async {
    final client = fakeApiClient(
      _baseHandlers(
        me: (_) => _me(creatorStatus: 'pending', isVerified: false),
      ),
    );

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioLiveScreen(), client: client);

    expect(find.text('Creator approval required'), findsOneWidget);
    expect(find.text('Open Studio'), findsOneWidget);
    expect(find.text('Chat enabled'), findsNothing);
  });

  testWidgets('renders live now and recent ended sessions', (tester) async {
    final client = fakeApiClient(
      _baseHandlers(
        live: [
          {'id': 'live1', 'title': 'Throwing demo', 'viewerCount': 12},
        ],
        recent: [
          {
            'id': 's1',
            'title': 'Q&A session',
            'endedAt': '2026-09-01T12:00:00.000Z',
            'uniqueViewerCount': 40,
          },
        ],
      ),
    );

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioLiveScreen(), client: client);

    expect(find.text('Live now'), findsOneWidget);
    expect(find.text('Throwing demo'), findsOneWidget);
    expect(find.text('Recent sessions'), findsOneWidget);
    expect(find.text('Q&A session'), findsOneWidget);
    expect(find.textContaining('40 viewers'), findsOneWidget);
  });

  testWidgets('still renders go-live form when a secondary endpoint fails', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(),
      'GET /categories': failWith('/categories'),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioLiveScreen(), client: client);

    expect(find.text('Chat enabled'), findsOneWidget);
    expect(find.text('Go live'), findsWidgets);
  });
}
