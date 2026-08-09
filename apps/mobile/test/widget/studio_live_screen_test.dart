import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/studio/presentation/studio_live_screen.dart';

import 'test_support/widget_harness.dart';

ResponseBody _me({String id = 'creator-1'}) => jsonResponse({
      'data': {'id': id},
    });

ResponseBody _communities(List<Map<String, dynamic>> list) => jsonResponse({'data': list});

ResponseBody _recentStreams(List<Map<String, dynamic>> list) => jsonResponse({'data': list});

Map<String, ResponseBody Function(RequestOptions)> _baseHandlers({
  List<Map<String, dynamic>> communities = const [],
  List<Map<String, dynamic>> recent = const [],
}) =>
    {
      'GET /users/me': (_) => _me(),
      'GET /creators/creator-1/communities': (_) => _communities(communities),
      'GET /creators/me/streams/recent': (_) => _recentStreams(recent),
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

    expect(find.text('Could not start stream'), findsOneWidget);
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
    expect(find.text('Community live uses members-only visibility.'), findsOneWidget);
  });

  testWidgets('renders recent ended sessions', (tester) async {
    final client = fakeApiClient(
      _baseHandlers(recent: [
        {'id': 's1', 'title': 'Q&A session'},
      ]),
    );

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioLiveScreen(), client: client);

    expect(find.text('Recent sessions'), findsOneWidget);
    expect(find.text('Q&A session'), findsOneWidget);
  });
}
