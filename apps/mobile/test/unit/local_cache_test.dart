import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/cache/local_cache.dart';
import 'package:hive/hive.dart';

void main() {
  late Directory tmpDir;

  setUp(() async {
    tmpDir = await Directory.systemTemp.createTemp('forge_local_cache_test');
    Hive.init(tmpDir.path);
    final box = await Hive.openBox<String>('test_cache');
    await LocalCache.init(box: box);
  });

  tearDown(() async {
    await Hive.deleteFromDisk();
    if (await tmpDir.exists()) await tmpDir.delete(recursive: true);
  });

  group('LocalCache.read/write', () {
    test('round-trips an arbitrary key', () async {
      expect(LocalCache.read('feed:default'), isNull);

      await LocalCache.write('feed:default', '{"videos":[]}');

      expect(LocalCache.read('feed:default'), '{"videos":[]}');
    });

    test('a later write overwrites the earlier value for the same key', () async {
      await LocalCache.write('history:watch', 'first');
      await LocalCache.write('history:watch', 'second');

      expect(LocalCache.read('history:watch'), 'second');
    });
  });

  group('LocalCache.writeWatchedVideo / readWatchedVideo', () {
    test('round-trips per video id', () async {
      await LocalCache.writeWatchedVideo('v1', '{"id":"v1"}');
      await LocalCache.writeWatchedVideo('v2', '{"id":"v2"}');

      expect(LocalCache.readWatchedVideo('v1'), '{"id":"v1"}');
      expect(LocalCache.readWatchedVideo('v2'), '{"id":"v2"}');
      expect(LocalCache.readWatchedVideo('v3'), isNull);
    });

    test('evicts the oldest entry once past the bound, keeping the most recent 30', () async {
      // Write 31 distinct videos — one more than the cap.
      for (var i = 1; i <= 31; i++) {
        await LocalCache.writeWatchedVideo('v$i', '{"id":"v$i"}');
      }

      expect(LocalCache.readWatchedVideo('v1'), isNull, reason: 'oldest entry should be evicted');
      expect(LocalCache.readWatchedVideo('v2'), isNotNull);
      expect(LocalCache.readWatchedVideo('v31'), isNotNull, reason: 'newest entry must survive');
    });

    test('re-writing an existing video id refreshes its recency instead of duplicating it', () async {
      for (var i = 1; i <= 30; i++) {
        await LocalCache.writeWatchedVideo('v$i', '{"id":"v$i"}');
      }
      // Touch v1 again — it should now be the most-recently-used, not the next evicted.
      await LocalCache.writeWatchedVideo('v1', '{"id":"v1","updated":true}');
      // One more new video pushes the cache one over the bound.
      await LocalCache.writeWatchedVideo('v31', '{"id":"v31"}');

      expect(LocalCache.readWatchedVideo('v1'), isNotNull, reason: 'was refreshed, should not be evicted');
      expect(LocalCache.readWatchedVideo('v2'), isNull, reason: 'v2 is now the least-recently-used');
    });
  });
}
