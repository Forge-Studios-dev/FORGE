import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/cache/local_cache.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/feed/data/feed_repository.dart';
import 'package:hive/hive.dart';

import 'test_support/fakes.dart';

Map<String, dynamic> _video(String id) => {
      'id': id,
      'userId': 'u1',
      'title': 'Video $id',
      'status': 'published',
      'viewCount': 0,
      'likeCount': 0,
      'commentCount': 0,
      'user': {
        'id': 'u1',
        'username': 'creator',
        'displayName': 'Creator',
        'role': 'creator',
        'followerCount': 0,
        'followingCount': 0,
        'videoCount': 0,
      },
      'createdAt': '2026-01-01T00:00:00.000Z',
    };

void main() {
  late Directory tmpDir;

  setUp(() async {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
    tmpDir = await Directory.systemTemp.createTemp('forge_feed_repo_test');
    Hive.init(tmpDir.path);
    final box = await Hive.openBox<String>('test_cache');
    await LocalCache.init(box: box);
  });

  tearDown(() async {
    await Hive.deleteFromDisk();
    if (await tmpDir.exists()) await tmpDir.delete(recursive: true);
  });

  FeedRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio()..httpClientAdapter = adapter;
    return FeedRepository(ApiClient(dio: dio));
  }

  group('FeedRepository.getFeed — offline-first (HIGH-07)', () {
    test('caches the first page of the default feed on a successful fetch', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {
                'data': [_video('v1'), _video('v2')],
                'meta': {'cursor': 'c2', 'hasMore': true},
              },
            }, 200),
      ]);
      final repo = buildRepository(adapter);

      final page = await repo.getFeed();

      expect(page.videos.map((v) => v.id), ['v1', 'v2']);
      expect(page.isFromCache, isFalse);
      expect(LocalCache.read('feed:default'), isNotNull);
    });

    test('falls back to the cached first page when the network call fails', () async {
      // Prime the cache as if a prior successful load had happened.
      final primingAdapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {
                'data': [_video('v1')],
                'meta': {'cursor': null, 'hasMore': false},
              },
            }, 200),
      ]);
      await buildRepository(primingAdapter).getFeed();

      // Now the network is down.
      final offlineAdapter = QueuedAdapter([(_) => throw DioException(
            requestOptions: RequestOptions(path: '/videos/feed'),
            type: DioExceptionType.connectionError,
          )]);
      final repo = buildRepository(offlineAdapter);

      final page = await repo.getFeed();

      expect(page.videos.map((v) => v.id), ['v1']);
      expect(page.isFromCache, isTrue);
      expect(page.hasMore, isFalse, reason: 'a cached page cannot paginate further offline');
    });

    test('rethrows when the network fails and there is nothing cached yet', () async {
      final adapter = QueuedAdapter([(_) => throw DioException(
            requestOptions: RequestOptions(path: '/videos/feed'),
            type: DioExceptionType.connectionError,
          )]);
      final repo = buildRepository(adapter);

      await expectLater(repo.getFeed(), throwsA(isA<DioException>()));
    });

    test('does not use the cache for a paginated (non-first) page request', () async {
      // Primed cache is irrelevant here — a cursor-bearing request never
      // consults it, so its exact contents don't matter for this test.
      await LocalCache.write('feed:default', 'irrelevant');

      final adapter = QueuedAdapter([(_) => throw DioException(
            requestOptions: RequestOptions(path: '/videos/feed'),
            type: DioExceptionType.connectionError,
          )]);
      final repo = buildRepository(adapter);

      // cursor != null → not eligible for the cache fallback, should just fail.
      await expectLater(repo.getFeed(cursor: 'c2'), throwsA(isA<DioException>()));
    });
  });
}
