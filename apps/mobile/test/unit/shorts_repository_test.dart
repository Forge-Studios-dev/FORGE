import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/shorts/data/shorts_repository.dart';

import 'test_support/fakes.dart';

void main() {
  setUp(() {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
  });

  ShortsRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio()..httpClientAdapter = adapter;
    return ShortsRepository(ApiClient(dio: dio));
  }

  Map<String, dynamic> shortVideoJson({
    required String id,
    String title = 'Short',
  }) =>
      {
        'id': id,
        'userId': 'u1',
        'title': title,
        'status': 'ready',
        'videoType': 'short',
        'viewCount': 0,
        'likeCount': 0,
        'commentCount': 0,
        'createdAt': '2024-01-01T00:00:00.000Z',
        'user': {
          'id': 'u1',
          'username': 'creator',
          'displayName': 'Creator',
          'role': 'user',
          'followerCount': 0,
          'followingCount': 0,
          'videoCount': 0,
        },
      };

  group('ShortsRepository', () {
    test('getFeed parses videos and nextCursor', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/videos/shorts');
          expect(opts.queryParameters.containsKey('limit'), isTrue);
          expect(opts.queryParameters.containsKey('cursor'), isFalse);
          return jsonResponseBody({
            'data': {
              'data': [shortVideoJson(id: 's1', title: 'First')],
              'nextCursor': 'c2',
            },
          }, 200);
        },
      ]);

      final page = await buildRepository(adapter).getFeed();

      expect(page.videos, hasLength(1));
      expect(page.videos.first.id, 's1');
      expect(page.nextCursor, 'c2');
      expect(page.hasMore, isTrue);
    });

    test('getFeed passes cursor and reads meta.hasMore', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/videos/shorts');
          expect(opts.queryParameters['cursor'], 'c1');
          return jsonResponseBody({
            'data': {
              'data': [shortVideoJson(id: 's2')],
              'meta': {'hasMore': true, 'cursor': 'c3'},
            },
          }, 200);
        },
      ]);

      final page = await buildRepository(adapter).getFeed(cursor: 'c1');

      expect(page.videos.single.id, 's2');
      expect(page.nextCursor, 'c3');
      expect(page.hasMore, isTrue);
    });

    test('getFeed returns empty page when data list missing', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': <String, dynamic>{},
            }, 200),
      ]);

      final page = await buildRepository(adapter).getFeed();

      expect(page.videos, isEmpty);
      expect(page.nextCursor, isNull);
      expect(page.hasMore, isFalse);
    });
  });
}
