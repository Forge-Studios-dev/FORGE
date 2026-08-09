import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/studio/presentation/studio_channel_posts_screen.dart';

import 'test_support/widget_harness.dart';

ResponseBody _me({String id = 'creator-1', String username = 'alice'}) => jsonResponse({
      'data': {'id': id, 'username': username},
    });

ResponseBody _posts(List<Map<String, dynamic>> posts) => jsonResponse({
      'data': {'data': posts},
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

  testWidgets('prompts sign-in when there is no stored creator', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': failWith('/users/me'),
    });

    await pumpForgeScreen(tester, const StudioChannelPostsScreen(), client: client);

    expect(find.text('Sign in as a creator to post updates.'), findsOneWidget);
  });

  testWidgets('loads the creator and shows the community panel empty state', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': (_) => _me(),
      'GET /creators/creator-1/channel-posts': (_) => _posts([]),
    });

    await pumpForgeScreen(tester, const StudioChannelPostsScreen(), client: client);

    expect(find.text('View channel'), findsOneWidget);
    expect(find.text('No community posts yet.'), findsOneWidget);
  });

  testWidgets('renders an existing post', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': (_) => _me(),
      'GET /creators/creator-1/channel-posts': (_) => _posts([
            {'id': 'p1', 'body': 'Hello subscribers'},
          ]),
    });

    await pumpForgeScreen(tester, const StudioChannelPostsScreen(), client: client);

    expect(find.text('Hello subscribers'), findsOneWidget);
  });
}
