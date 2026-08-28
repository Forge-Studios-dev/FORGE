import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/messages/data/messages_repository.dart';

import 'test_support/fakes.dart';

void main() {
  setUp(() {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
  });

  MessagesRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio()..httpClientAdapter = adapter;
    return MessagesRepository(ApiClient(dio: dio));
  }

  group('MessagesRepository', () {
    test('listConversations parses envelope list', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/messages/conversations');
          return jsonResponseBody({
            'data': [
              {
                'conversationId': 'c1',
                'participants': [
                  {'id': 'u2', 'username': 'bob', 'displayName': 'Bob'},
                ],
              },
            ],
          }, 200);
        },
      ]);

      final list = await buildRepository(adapter).listConversations();

      expect(list, hasLength(1));
      expect((list.first as Map)['conversationId'], 'c1');
    });

    test('getMessages and markRead hit expected paths', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/messages/conversations/c1');
          expect(opts.queryParameters['limit'], 50);
          return jsonResponseBody({
            'data': {
              'data': [
                {'id': 'm1', 'content': 'hi', 'senderId': 'u1'},
              ],
            },
          }, 200);
        },
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/messages/conversations/c1/read');
          return jsonResponseBody({'data': null}, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      final messages = await repo.getMessages('c1');
      expect(messages, hasLength(1));
      expect((messages.first as Map)['id'], 'm1');

      await repo.markRead('c1');
      expect(adapter.requests, hasLength(2));
    });

    test('sendMessage posts recipient and content', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/messages');
          expect(opts.data['recipientId'], 'u2');
          expect(opts.data['content'], 'hello');
          return jsonResponseBody({
            'data': {
              'id': 'm2',
              'conversationId': 'c9',
              'content': 'hello',
            },
          }, 200);
        },
      ]);

      final msg = await buildRepository(adapter).sendMessage(
        recipientId: 'u2',
        content: 'hello',
      );

      expect(msg['conversationId'], 'c9');
      expect(msg['id'], 'm2');
    });

    test('searchUsers returns maps from envelope', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/users/search');
          expect(opts.queryParameters['q'], 'bo');
          expect(opts.queryParameters['limit'], 5);
          return jsonResponseBody({
            'data': [
              {'id': 'u2', 'username': 'bob', 'displayName': 'Bob'},
            ],
          }, 200);
        },
      ]);

      final users = await buildRepository(adapter).searchUsers(q: 'bo');

      expect(users, hasLength(1));
      expect(users.first['username'], 'bob');
    });
  });
}
