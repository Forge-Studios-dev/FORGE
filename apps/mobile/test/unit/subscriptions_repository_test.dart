import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/subscriptions/data/subscriptions_repository.dart';

import 'test_support/fakes.dart';

void main() {
  setUp(() {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
  });

  SubscriptionsRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio()..httpClientAdapter = adapter;
    return SubscriptionsRepository(ApiClient(dio: dio));
  }

  group('SubscriptionsRepository', () {
    test('listMySubscriptionChannels loads me then nested channel list', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/users/me');
          return jsonResponseBody({
            'data': {'id': 'u1', 'username': 'alice'},
          }, 200);
        },
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/channels/u1/subscriptions');
          expect(opts.queryParameters['limit'], 40);
          return jsonResponseBody({
            'data': {
              'data': [
                {
                  'id': 'c1',
                  'displayName': 'Creator',
                  'avatarUrl': 'https://example.com/a.png',
                },
              ],
            },
          }, 200);
        },
      ]);

      final page = await buildRepository(adapter).listMySubscriptionChannels();

      expect(page, isNotNull);
      expect(page!.username, 'alice');
      expect(page.channels, hasLength(1));
      expect(page.channels.first['id'], 'c1');
      expect(page.channels.first['displayName'], 'Creator');
    });

    test('listMySubscriptionChannels accepts bare list payload', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {'id': 'u1', 'username': 'bob'},
            }, 200),
        (_) => jsonResponseBody({
              'data': [
                {'id': 'c2', 'displayName': 'Other'},
              ],
            }, 200),
      ]);

      final page = await buildRepository(adapter).listMySubscriptionChannels(limit: 10);

      expect(page!.channels.single['id'], 'c2');
      expect(adapter.requests.last.queryParameters['limit'], 10);
    });

    test('listMySubscriptionChannels returns null when me has no id', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {'username': 'ghost'},
            }, 200),
      ]);

      final page = await buildRepository(adapter).listMySubscriptionChannels();

      expect(page, isNull);
      expect(adapter.requests, hasLength(1));
    });
  });
}
