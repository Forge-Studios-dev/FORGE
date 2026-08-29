import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/playlists/data/playlists_repository.dart';

import 'test_support/fakes.dart';

void main() {
  setUp(() {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
  });

  PlaylistsRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio()..httpClientAdapter = adapter;
    return PlaylistsRepository(ApiClient(dio: dio));
  }

  Map<String, dynamic> videoJson({
    required String id,
    String title = 'Vid',
  }) =>
      {
        'id': id,
        'userId': 'u1',
        'title': title,
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
      };

  group('PlaylistsRepository', () {
    test('listMine returns envelope list', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/playlists/me');
          return jsonResponseBody({
            'data': [
              {'id': 'p1', 'title': 'Favorites', 'systemType': null},
            ],
          }, 200);
        },
      ]);

      final list = await buildRepository(adapter).listMine();

      expect(list, hasLength(1));
      expect((list.first as Map)['id'], 'p1');
    });

    test('create posts title visibility description and returns id', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/playlists');
          expect(opts.data['title'], 'My list');
          expect(opts.data['visibility'], 'private');
          expect(opts.data['description'], 'notes');
          return jsonResponseBody({
            'data': {'id': 'p9', 'title': 'My list'},
          }, 200);
        },
      ]);

      final id = await buildRepository(adapter).create(
        title: 'My list',
        visibility: 'private',
        description: 'notes',
      );

      expect(id, 'p9');
    });

    test('getById getMe removeVideo addVideo hit expected paths', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/playlists/p1');
          return jsonResponseBody({
            'data': {'id': 'p1', 'title': 'P'},
          }, 200);
        },
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/users/me');
          return jsonResponseBody({
            'data': {'id': 'u1', 'username': 'me'},
          }, 200);
        },
        (opts) {
          expect(opts.method, 'DELETE');
          expect(opts.path, '/playlists/p1/videos/v1');
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'POST');
          expect(opts.path, '/playlists/p1/videos');
          expect(opts.data['videoId'], 'v2');
          return jsonResponseBody({'data': null}, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      expect((await repo.getById('p1'))?['id'], 'p1');
      expect((await repo.getMe())?['id'], 'u1');
      await repo.removeVideo(playlistId: 'p1', videoId: 'v1');
      await repo.addVideo(playlistId: 'p1', videoId: 'v2');
      expect(adapter.requests, hasLength(4));
    });

    test('listStudioReadyVideos filters ready maps from nested envelope', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/videos/studio');
          expect(opts.queryParameters['limit'], 50);
          expect(opts.queryParameters['status'], 'ready');
          return jsonResponseBody({
            'data': {
              'data': [
                {'id': 'v1', 'title': 'A', 'status': 'ready'},
                {'id': 'v2', 'title': 'B', 'status': 'processing'},
                {'title': 'no-id', 'status': 'ready'},
              ],
            },
          }, 200);
        },
      ]);

      final videos = await buildRepository(adapter).listStudioReadyVideos();

      expect(videos, hasLength(1));
      expect(videos.first['id'], 'v1');
    });

    test('update delete reorder hit expected paths', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'PATCH');
          expect(opts.path, '/playlists/p1');
          expect(opts.data['title'], 'New');
          expect(opts.data['description'], null);
          expect(opts.data['visibility'], 'unlisted');
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'PUT');
          expect(opts.path, '/playlists/p1/reorder');
          expect(opts.data['videoIds'], ['v2', 'v1']);
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'DELETE');
          expect(opts.path, '/playlists/p1');
          return jsonResponseBody({'data': null}, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      await repo.update(
        playlistId: 'p1',
        title: 'New',
        description: null,
        visibility: 'unlisted',
      );
      await repo.reorder(playlistId: 'p1', videoIds: ['v2', 'v1']);
      await repo.delete('p1');
      expect(adapter.requests, hasLength(3));
    });

    test('getSystemPlaylist parses items envelope for liked', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'GET');
          expect(opts.path, '/playlists/me/liked');
          return jsonResponseBody({
            'data': {
              'id': 'sys1',
              'items': [
                {'video': videoJson(id: 'v1', title: 'Liked')},
              ],
            },
          }, 200);
        },
      ]);

      final result = await buildRepository(adapter).getSystemPlaylist('liked');

      expect(result.playlistId, 'sys1');
      expect(result.videos, hasLength(1));
      expect(result.videos.first.id, 'v1');
      expect(result.videos.first.title, 'Liked');
    });

    test('removeFromSystemPlaylist and clearSystemPlaylist branch by kind', () async {
      final adapter = QueuedAdapter([
        (opts) {
          expect(opts.method, 'DELETE');
          expect(opts.path, '/videos/v1/like');
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'DELETE');
          expect(opts.path, '/playlists/me/watch-later/videos/v2');
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'DELETE');
          expect(opts.path, '/playlists/me/liked/videos');
          return jsonResponseBody({'data': null}, 200);
        },
        (opts) {
          expect(opts.method, 'DELETE');
          expect(opts.path, '/playlists/me/watch-later/videos');
          return jsonResponseBody({'data': null}, 200);
        },
      ]);

      final repo = buildRepository(adapter);
      await repo.removeFromSystemPlaylist(kind: 'liked', videoId: 'v1');
      await repo.removeFromSystemPlaylist(kind: 'watch-later', videoId: 'v2');
      await repo.clearSystemPlaylist('liked');
      await repo.clearSystemPlaylist('watch-later');
      expect(adapter.requests, hasLength(4));
    });
  });
}
