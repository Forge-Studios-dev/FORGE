import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/cache/local_cache.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/history/data/history_repository.dart';
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

DioException _connectionError() => DioException(
      requestOptions: RequestOptions(path: '/users/me/watch-history'),
      type: DioExceptionType.connectionError,
    );

void main() {
  late Directory tmpDir;

  setUp(() async {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
    tmpDir = await Directory.systemTemp.createTemp('forge_history_repo_test');
    Hive.init(tmpDir.path);
    final box = await Hive.openBox<String>('test_cache');
    await LocalCache.init(box: box);
  });

  tearDown(() async {
    await Hive.deleteFromDisk();
    if (await tmpDir.exists()) await tmpDir.delete(recursive: true);
  });

  HistoryRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio()..httpClientAdapter = adapter;
    return HistoryRepository(ApiClient(dio: dio));
  }

  group('HistoryRepository.getWatchHistory — offline-first (HIGH-07)', () {
    test('caches on success and falls back to the cache when offline', () async {
      final onlineAdapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {
                'data': [_video('v1'), _video('v2')],
              },
            }, 200),
      ]);
      await buildRepository(onlineAdapter).getWatchHistory();

      final offlineRepo = buildRepository(QueuedAdapter([(_) => throw _connectionError()]));
      final history = await offlineRepo.getWatchHistory();

      expect(history.map((v) => v.id), ['v1', 'v2']);
    });

    test('rethrows when offline with nothing cached', () async {
      final repo = buildRepository(QueuedAdapter([(_) => throw _connectionError()]));

      await expectLater(repo.getWatchHistory(), throwsA(isA<DioException>()));
    });
  });

  group('HistoryRepository.getContinueWatching — offline-first (HIGH-07)', () {
    test('caches separately from watch history and falls back independently', () async {
      final onlineAdapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {
                'data': [_video('in-progress-1')],
              },
            }, 200),
      ]);
      await buildRepository(onlineAdapter).getContinueWatching();

      // getWatchHistory (a different cache key) has never been primed and must not
      // accidentally serve the continue-watching cache or vice versa.
      final offlineRepo = buildRepository(QueuedAdapter([(_) => throw _connectionError()]));
      await expectLater(offlineRepo.getWatchHistory(), throwsA(isA<DioException>()));

      final continueWatching = await buildRepository(
        QueuedAdapter([(_) => throw _connectionError()]),
      ).getContinueWatching();
      expect(continueWatching.map((v) => v.id), ['in-progress-1']);
    });
  });
}
