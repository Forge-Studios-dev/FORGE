import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/library/data/library_repository.dart';

import 'test_support/fakes.dart';

void main() {
  setUp(() {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
  });

  LibraryRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio()..httpClientAdapter = adapter;
    return LibraryRepository(ApiClient(dio: dio));
  }

  group('LibraryRepository', () {
    test('getPlaylistCounts maps system and custom playlists', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/playlists/me');
          return jsonResponseBody({
            'data': [
              {'systemType': 'watch_later', 'videoCount': 3},
              {'systemType': 'liked', 'videoCount': 11},
              {'systemType': null, 'videoCount': 2},
              {'systemType': null, 'videoCount': 1},
            ],
          }, 200);
        },
      ]);

      final counts = await buildRepository(adapter).getPlaylistCounts();

      expect(counts.watchLater, 3);
      expect(counts.liked, 11);
      expect(counts.playlists, 2);
    });

    test('getDislikedVideos parses nested envelope', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/me/disliked-videos');
          expect(opts.queryParameters['limit'], 50);
          return jsonResponseBody({
            'data': {
              'data': [
                {
                  'id': 'v1',
                  'userId': 'u1',
                  'title': 'Nope',
                  'status': 'ready',
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
                },
              ],
            },
          }, 200);
        },
      ]);

      final videos = await buildRepository(adapter).getDislikedVideos(limit: 50);

      expect(videos, hasLength(1));
      expect(videos.first.id, 'v1');
      expect(videos.first.title, 'Nope');
    });

    test('removeDislike and clearDislikedVideos hit expected paths', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'DELETE');
          expect(opts.path, '/videos/v1/dislike');
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'DELETE');
          expect(opts.path, '/me/disliked-videos');
          return jsonResponseBody({'data': null}, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      await repo.removeDislike('v1');
      await repo.clearDislikedVideos();
      expect(adapter.requests, hasLength(2));
    });
  });
}
