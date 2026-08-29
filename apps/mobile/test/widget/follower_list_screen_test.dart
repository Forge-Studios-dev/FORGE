import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/features/profile/presentation/follower_list_screen.dart';

import 'test_support/widget_harness.dart';

ResponseBody _userByUsername({String id = 'owner-1', String username = 'creator'}) =>
    jsonResponse({
      'data': {'id': id, 'username': username},
    });

ResponseBody _me({String id = 'viewer-1'}) => jsonResponse({
      'data': {'id': id},
    });

ResponseBody _listPage(List<Map<String, dynamic>> items) => jsonResponse({
      'data': {
        'data': items,
        'meta': {'cursor': null, 'hasMore': false},
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

  testWidgets('shows privacy message when subscriber list returns 403', (tester) async {
    final client = fakeApiClient({
      'GET /users/by-username/creator': (_) => _userByUsername(),
      'GET /users/me': (_) => _me(),
      'GET /channels/owner-1/subscribers': (_) => throw DioException(
            requestOptions: RequestOptions(path: '/channels/owner-1/subscribers'),
            response: Response(
              requestOptions: RequestOptions(path: '/channels/owner-1/subscribers'),
              statusCode: 403,
              data: {
                'statusCode': 403,
                'message': 'Subscriber list is private',
                'error': 'Forbidden',
              },
            ),
            type: DioExceptionType.badResponse,
          ),
    });

    await pumpForgeScreen(
      tester,
      const FollowerListScreen(username: 'creator', following: false),
      client: client,
    );

    expect(find.text("This channel's subscriber list is private."), findsOneWidget);
    expect(find.text('No subscribers yet'), findsNothing);
  });

  testWidgets('owner can still see their own subscribers', (tester) async {
    final client = fakeApiClient({
      'GET /users/by-username/creator': (_) => _userByUsername(id: 'owner-1'),
      'GET /users/me': (_) => _me(id: 'owner-1'),
      'GET /channels/owner-1/subscribers': (_) => _listPage([
            {
              'id': 'sub-1',
              'username': 'bob',
              'displayName': 'Bob',
            },
          ]),
    });

    await pumpForgeScreen(
      tester,
      const FollowerListScreen(username: 'creator', following: false),
      client: client,
    );

    expect(find.text('Bob'), findsOneWidget);
    expect(find.text('@bob'), findsOneWidget);
    expect(find.text("This channel's subscriber list is private."), findsNothing);
  });

  testWidgets('subscriptions list still shows empty state on failure (no privacy gate)',
      (tester) async {
    final client = fakeApiClient({
      'GET /users/by-username/creator': (_) => _userByUsername(),
      'GET /users/me': (_) => _me(),
      'GET /channels/owner-1/subscriptions': (_) => throw DioException(
            requestOptions: RequestOptions(path: '/channels/owner-1/subscriptions'),
            response: Response(
              requestOptions: RequestOptions(path: '/channels/owner-1/subscriptions'),
              statusCode: 403,
              data: {'message': 'Forbidden'},
            ),
            type: DioExceptionType.badResponse,
          ),
    });

    await pumpForgeScreen(
      tester,
      const FollowerListScreen(username: 'creator', following: true),
      client: client,
    );

    // Following/subscriptions has no privacy gate — fall through to empty, not private copy.
    expect(find.text("This channel's subscriber list is private."), findsNothing);
    expect(find.text('No subscriptions yet'), findsOneWidget);
  });
}
