import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/cache/local_cache.dart';
import 'package:forge_mobile/features/explore/data/search_history_storage.dart';
import 'package:hive/hive.dart';

void main() {
  late Directory tmpDir;

  setUp(() async {
    tmpDir = await Directory.systemTemp.createTemp('forge_search_history_test');
    Hive.init(tmpDir.path);
    final box = await Hive.openBox<String>('test_search_history');
    await LocalCache.init(box: box);
  });

  tearDown(() async {
    await clearSearchHistory();
    await Hive.deleteFromDisk();
    if (await tmpDir.exists()) await tmpDir.delete(recursive: true);
  });

  test('stores newest first and dedupes case-insensitively', () async {
    await pushSearchHistory('React');
    await pushSearchHistory('Flutter');
    await pushSearchHistory('react');
    expect(await readSearchHistory(), ['react', 'Flutter']);
  });

  test('caps at 8 entries', () async {
    for (var i = 0; i < 12; i++) {
      await pushSearchHistory('q$i');
    }
    final history = await readSearchHistory();
    expect(history, hasLength(8));
    expect(history.first, 'q11');
  });

  test('clear removes all', () async {
    await pushSearchHistory('hello');
    await clearSearchHistory();
    expect(await readSearchHistory(), isEmpty);
  });
}
