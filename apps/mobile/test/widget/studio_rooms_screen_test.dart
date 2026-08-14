import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/studio/presentation/studio_rooms_screen.dart';

import 'test_support/widget_harness.dart';

ResponseBody _me({String id = 'creator-1'}) => jsonResponse({
      'data': {'id': id},
    });

ResponseBody _list(List<Map<String, dynamic>> items) => jsonResponse({'data': items});

Map<String, ResponseBody Function(RequestOptions)> _baseHandlers({
  List<Map<String, dynamic>> communities = const [
    {'id': 'com1', 'name': 'Pottery club'},
  ],
  List<Map<String, dynamic>> rooms = const [],
}) =>
    {
      'GET /users/me': (_) => _me(),
      'GET /creators/creator-1/communities': (_) => _list(communities),
      'GET /communities/com1/rooms': (_) => _list(rooms),
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

  testWidgets('embedded mode prompts to create a community first', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': (_) => _me(),
      'GET /creators/creator-1/communities': (_) => _list([]),
    });

    await pumpForgeScreen(
      tester,
      const StudioRoomsScreen(embedded: true),
      client: client,
    );

    expect(find.text('Create a community in Settings first'), findsOneWidget);
  });

  testWidgets('renders existing rooms', (tester) async {
    final client = fakeApiClient(_baseHandlers(rooms: [
      {'id': 'r1', 'name': 'General', 'roomType': 'text'},
    ]));

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioRoomsScreen(), client: client);

    expect(find.text('General'), findsOneWidget);
    expect(find.text('text'), findsOneWidget);
  });

  testWidgets('creates a room', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(),
      'POST /creators/me/communities/com1/rooms': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioRoomsScreen(), client: client);

    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'Room name'), 'Announcements');
    });
    await drainAsync(tester);
    await tapAndSettle(tester, find.widgetWithText(FilledButton, 'Create room'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any(
        (r) => r.method == 'POST' && r.uri.path == '/creators/me/communities/com1/rooms',
      ),
      isTrue,
    );
    expect(find.text('Room created'), findsOneWidget);
  });

  testWidgets('deactivates a room', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(rooms: [
        {'id': 'r1', 'name': 'General', 'roomType': 'text'},
      ]),
      'DELETE /creators/me/communities/com1/rooms/r1': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioRoomsScreen(), client: client);

    await tapAndSettle(tester, find.byIcon(Icons.delete_outline));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any(
        (r) => r.method == 'DELETE' && r.uri.path == '/creators/me/communities/com1/rooms/r1',
      ),
      isTrue,
    );
  });

  testWidgets('loads and grants room permissions', (tester) async {
    final client = fakeApiClient({
      ..._baseHandlers(rooms: [
        {'id': 'r1', 'name': 'General', 'roomType': 'text'},
      ]),
      'GET /creators/me/communities/com1/rooms/r1/permissions': (_) => _list([]),
      'POST /creators/me/communities/com1/rooms/r1/permissions': (_) => jsonResponse({'data': {}}),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioRoomsScreen(), client: client);

    await tapAndSettle(tester, find.byIcon(Icons.admin_panel_settings_outlined));

    expect(find.text('Grant permission'), findsOneWidget);

    await tester.runAsync(() async {
      await tester.enterText(find.widgetWithText(TextField, 'User ID'), 'u9');
    });
    await drainAsync(tester);
    await tapAndSettle(tester, find.widgetWithText(FilledButton, 'Grant permission'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any(
        (r) => r.method == 'POST' && r.uri.path == '/creators/me/communities/com1/rooms/r1/permissions',
      ),
      isTrue,
    );
  });
}
