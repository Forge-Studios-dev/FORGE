import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/studio/presentation/studio_settings_screen.dart';

import 'test_support/widget_harness.dart';

ResponseBody _me({String? displayName, String? username, String? email}) => jsonResponse({
      'data': {
        if (displayName != null) 'displayName': displayName,
        if (username != null) 'username': username,
        if (email != null) 'email': email,
      },
    });

void main() {
  late TestCache cache;

  setUp(() async {
    installFakeSecureStorage();
    cache = await TestCache.open();
  });

  tearDown(() async {
    await cache.dispose();
  });

  testWidgets('shows an error state when the profile fails to load', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': failWith('/users/me'),
    });

    await pumpForgeScreen(tester, const StudioSettingsScreen(), client: client);

    expect(find.text('Failed to load profile'), findsOneWidget);
  });

  testWidgets('renders profile fields and shortcuts', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': (_) => _me(displayName: 'Alice Creator', username: 'alice', email: 'alice@example.com'),
    });

    useTallViewport(tester);
    addTearDown(tester.view.resetPhysicalSize);
    await pumpForgeScreen(tester, const StudioSettingsScreen(), client: client);

    expect(find.text('Alice Creator'), findsOneWidget);
    expect(find.text('@alice'), findsOneWidget);
    expect(find.text('alice@example.com'), findsOneWidget);
    expect(find.text('View public channel'), findsOneWidget);
    expect(find.text('Customize channel'), findsOneWidget);
    expect(find.text('Community posts'), findsOneWidget);
    expect(find.text('Attention queue'), findsOneWidget);
  });

  testWidgets('hides the public channel link when there is no username', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': (_) => _me(displayName: 'Alice Creator'),
    });

    await pumpForgeScreen(tester, const StudioSettingsScreen(), client: client);

    expect(find.text('View public channel'), findsNothing);
  });
}
