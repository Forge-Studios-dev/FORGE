import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/community/data/community_repository.dart';

import 'test_support/fakes.dart';

void main() {
  setUp(() {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
  });

  CommunityRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio()..httpClientAdapter = adapter;
    return CommunityRepository(ApiClient(dio: dio));
  }

  group('CommunityRepository', () {
    test('resolveCommunity by slug returns envelope data', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/creators/u1/communities/forge');
          return jsonResponseBody({
            'data': {
              'community': {'id': 'c1', 'name': 'Forge', 'slug': 'forge'},
            },
          }, 200);
        },
      ]);

      final data = await buildRepository(adapter).resolveCommunity(
        creatorId: 'u1',
        slug: 'forge',
      );

      expect(data, isNotNull);
      expect((data!['community'] as Map)['id'], 'c1');
    });

    test('resolveCommunity without slug loads first community', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/creators/u1/communities');
          return jsonResponseBody({
            'data': [
              {'id': 'c1', 'slug': 'first'},
            ],
          }, 200);
        },
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/creators/u1/communities/first');
          return jsonResponseBody({
            'data': {
              'community': {'id': 'c1', 'slug': 'first'},
            },
          }, 200);
        },
      ]);

      final data = await buildRepository(adapter).resolveCommunity(creatorId: 'u1');

      expect((data!['community'] as Map)['slug'], 'first');
      expect(adapter.requests, hasLength(2));
    });

    test('getPosts parses nested list', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/communities/c1/posts');
          return jsonResponseBody({
            'data': {
              'data': [
                {'id': 'p1', 'body': 'hello'},
              ],
            },
          }, 200);
        },
      ]);

      final posts = await buildRepository(adapter).getPosts('c1');

      expect(posts, hasLength(1));
      expect(posts.first['id'], 'p1');
    });

    test('getCommunityUpdates parses cursor page', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/me/community-updates');
          expect(opts.queryParameters['limit'], 20);
          expect(opts.queryParameters['cursor'], 'c1');
          return jsonResponseBody({
            'data': {
              'data': [
                {'id': 'u1', 'body': 'announce'},
              ],
              'meta': {'cursor': 'c2', 'hasMore': true},
            },
          }, 200);
        },
      ]);

      final page = await buildRepository(adapter).getCommunityUpdates(cursor: 'c1');

      expect(page.items, hasLength(1));
      expect(page.nextCursor, 'c2');
      expect(page.hasMore, isTrue);
    });

    test('raiseHand and lowerHand hit expected paths', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/communities/c1/rooms/r1/raise-hand');
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'DELETE');
          expect(opts.path, '/communities/c1/rooms/r1/raise-hand');
          return jsonResponseBody({'data': null}, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      await repo.raiseHand('c1', 'r1');
      await repo.lowerHand('c1', 'r1');
      expect(adapter.requests, hasLength(2));
    });

    test('searchCommunities returns maps from envelope', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/communities/search');
          expect(opts.queryParameters['q'], 'forge');
          return jsonResponseBody({
            'data': [
              {'id': 'c1', 'name': 'Forge', 'slug': 'forge'},
            ],
          }, 200);
        },
      ]);

      final list = await buildRepository(adapter).searchCommunities('forge');

      expect(list, hasLength(1));
      expect(list.first['slug'], 'forge');
    });
  });
}
