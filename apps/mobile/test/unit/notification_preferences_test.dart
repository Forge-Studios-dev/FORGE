import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/cache/local_cache.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/features/watch/data/watch_repository.dart';
import 'package:hive/hive.dart';

import 'test_support/fakes.dart';

void main() {
  late Directory tmpDir;

  setUp(() async {
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform({});
    tmpDir = await Directory.systemTemp.createTemp('forge_notif_prefs_test');
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

  group('WatchRepository notification preferences', () {
    test('getNotificationPreferences returns the muted categories and digest flag', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {
                'mutedCategories': ['billing', 'reward'],
                'emailDigest': true,
              },
            }, 200),
      ]);

      final prefs = await buildRepository(adapter).getNotificationPreferences();

      expect(prefs['mutedCategories'], ['billing', 'reward']);
      expect(prefs['emailDigest'], true);
    });

    test('setNotificationPreferences PUTs the expected body', () async {
      final adapter = QueuedAdapter([(_) => jsonResponseBody({'data': {'ok': true}}, 200)]);
      final repo = buildRepository(adapter);

      await repo.setNotificationPreferences(
        mutedCategories: ['social'],
        emailDigest: false,
      );

      expect(adapter.requests, hasLength(1));
      final req = adapter.requests.single;
      expect(req.method, 'PUT');
      expect(req.path, contains('/users/me/notification-preferences'));
      expect(req.data, {'mutedCategories': ['social'], 'emailDigest': false});
    });
  });
}
