import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/cache/local_cache.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/watch/data/watch_repository.dart';
import 'package:hive/hive.dart';

import 'test_support/fakes.dart';

Map<String, dynamic> _video(String id, {String title = 'A video'}) => {
      'id': id,
      'userId': 'u1',
      'title': title,
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

DioException _notFound(String path) => DioException(
      requestOptions: RequestOptions(path: path),
      type: DioExceptionType.connectionError,
    );

void main() {
  late Directory tmpDir;

  setUp(() async {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
    tmpDir = await Directory.systemTemp.createTemp('forge_watch_repo_test');
    Hive.init(tmpDir.path);
    final box = await Hive.openBox<String>('test_cache');
    await LocalCache.init(box: box);
  });

  tearDown(() async {
    await Hive.deleteFromDisk();
    if (await tmpDir.exists()) await tmpDir.delete(recursive: true);
  });

  WatchRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio()..httpClientAdapter = adapter;
    return WatchRepository(ApiClient(dio: dio));
  }

  group('WatchRepository.getVideo — offline-first (HIGH-07)', () {
    test('caches per video id on success and falls back to it when offline', () async {
      final onlineAdapter = QueuedAdapter([(_) => jsonResponseBody({'data': _video('v1')}, 200)]);
      final video = await buildRepository(onlineAdapter).getVideo('v1');
      expect(video.title, 'A video');

      final offlineRepo = buildRepository(QueuedAdapter([(_) => throw _notFound('/videos/v1')]));
      final cachedVideo = await offlineRepo.getVideo('v1');

      expect(cachedVideo.id, 'v1');
      expect(cachedVideo.title, 'A video');
    });

    test('rethrows when offline and this particular video was never cached', () async {
      // v1 is cached, but v2 never was — the cache is per-id, not a blanket fallback.
      final onlineAdapter = QueuedAdapter([(_) => jsonResponseBody({'data': _video('v1')}, 200)]);
      await buildRepository(onlineAdapter).getVideo('v1');

      final offlineRepo = buildRepository(QueuedAdapter([(_) => throw _notFound('/videos/v2')]));
      await expectLater(offlineRepo.getVideo('v2'), throwsA(isA<DioException>()));
    });
  });
}
