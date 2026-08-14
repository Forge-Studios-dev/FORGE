import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:forge_mobile/features/subscriptions/presentation/subscriptions_screen.dart';

import 'test_support/widget_harness.dart';

Map<String, dynamic> _video(
  String id, {
  String title = 'A video',
  String username = 'creator',
}) =>
    {
      'id': id,
      'userId': 'creator-1',
      'title': title,
      'status': 'ready',
      'viewCount': 0,
      'likeCount': 0,
      'commentCount': 0,
      'user': {
        'id': 'creator-1',
        'username': username,
        'displayName': 'Creator',
        'role': 'creator',
        'followerCount': 0,
        'followingCount': 0,
        'videoCount': 0,
      },
      'createdAt': '2026-01-01T00:00:00.000Z',
    };

ResponseBody _feedPage(List<Map<String, dynamic>> videos, {bool hasMore = false, String? cursor}) =>
    jsonResponse({
      'data': {
        'data': videos,
        'meta': {'cursor': cursor, 'hasMore': hasMore},
      },
    });

ResponseBody _me({String id = 'u1', String username = 'me'}) => jsonResponse({
      'data': {'id': id, 'username': username},
    });

ResponseBody _channels(List<Map<String, dynamic>> channels) => jsonResponse({
      'data': {'data': channels},
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

  testWidgets('shows an empty state with no subscriptions', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': (_) => _me(),
      'GET /channels/u1/subscriptions': (_) => _channels([]),
      'GET /videos/feed/following': (_) => _feedPage([]),
    });

    await pumpForgeScreen(tester, const SubscriptionsScreen(), client: client);

    expect(find.text('No subscriptions yet'), findsOneWidget);
  });

  testWidgets('shows an error state when the feed fails to load', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': (_) => _me(),
      'GET /channels/u1/subscriptions': (_) => _channels([]),
      'GET /videos/feed/following': failWith('/videos/feed/following'),
    });

    await pumpForgeScreen(tester, const SubscriptionsScreen(), client: client);

    expect(find.text('Couldn’t load subscriptions'), findsOneWidget);
  });

  testWidgets('renders videos and channel chips', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': (_) => _me(),
      'GET /channels/u1/subscriptions': (_) => _channels([
            {'id': 'c1', 'displayName': 'Alice'},
          ]),
      'GET /videos/feed/following': (_) => _feedPage([_video('v1', title: 'Intro to FORGE')]),
    });

    await pumpForgeScreen(tester, const SubscriptionsScreen(), client: client);

    expect(find.text('Intro to FORGE'), findsOneWidget);
    expect(find.text('Alice'), findsOneWidget);
    expect(find.text('All'), findsOneWidget);
  });

  testWidgets('filters by channel when a chip is tapped', (tester) async {
    final client = fakeApiClient({
      'GET /users/me': (_) => _me(),
      'GET /channels/u1/subscriptions': (_) => _channels([
            {'id': 'c1', 'displayName': 'Alice'},
          ]),
      'GET /videos/feed/following': (_) => _feedPage([_video('v1', title: 'Intro to FORGE')]),
    });

    await pumpForgeScreen(tester, const SubscriptionsScreen(), client: client);
    expect(find.text('Intro to FORGE'), findsOneWidget);

    await tapAndSettle(tester, find.text('Alice'));

    final adapter = client.dio.httpClientAdapter as MapHttpAdapter;
    expect(
      adapter.requests.any(
        (r) => r.method == 'GET' && r.uri.path == '/videos/feed/following' && r.queryParameters['channelId'] == 'c1',
      ),
      isTrue,
    );
  });
}
