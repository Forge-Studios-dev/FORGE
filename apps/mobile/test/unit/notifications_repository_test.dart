import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/notifications/data/notifications_repository.dart';

import 'test_support/fakes.dart';

void main() {
  setUp(() {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
  });

  NotificationsRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio()..httpClientAdapter = adapter;
    return NotificationsRepository(ApiClient(dio: dio));
  }

  group('NotificationsRepository', () {
    test('list parses cursor page', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/notifications');
          expect(opts.queryParameters['limit'], 30);
          expect(opts.queryParameters['cursor'], 'c1');
          return jsonResponseBody({
            'data': {
              'data': [
                {'id': 'n1', 'type': 'new_follower', 'title': 'Hi'},
              ],
              'meta': {'cursor': 'c2', 'hasMore': true},
            },
          }, 200);
        },
      ]);

      final page = await buildRepository(adapter).list(cursor: 'c1');

      expect(page.items, hasLength(1));
      expect((page.items.first as Map)['id'], 'n1');
      expect(page.nextCursor, 'c2');
      expect(page.hasMore, isTrue);
    });

    test('markRead and markAllRead hit expected paths', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/notifications/n1/read');
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/notifications/read-all');
          return jsonResponseBody({'data': null}, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      await repo.markRead('n1');
      await repo.markAllRead();
      expect(adapter.requests, hasLength(2));
    });

    test('getUnreadCount reads count from envelope', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {'count': 7},
            }, 200),
      ]);

      expect(await buildRepository(adapter).getUnreadCount(), 7);
    });
  });
}
