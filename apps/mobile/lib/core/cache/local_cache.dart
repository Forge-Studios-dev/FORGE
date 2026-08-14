import 'dart:convert';

import 'package:hive_flutter/hive_flutter.dart';

/// Offline-first local cache (HIGH-07) — a single Hive box of JSON strings.
/// No custom TypeAdapters/codegen: callers own their own JSON encoding via
/// each model's `toJson`/`fromJson`, this just persists the resulting string
/// keyed by cache key, surviving app restarts and network loss.
///
/// Must be initialized once via [init] before use — call from `main()`
/// alongside the other startup steps, before `runApp`.
class LocalCache {
  LocalCache._();

  static const _boxName = 'forge_offline_cache';
  static const _watchVideoIndexKey = '_watch_video_index';
  static const _maxCachedWatchedVideos = 30;

  static Box<String>? _box;

  /// [box] is a test seam (HIGH-07) — supply an already-open box (e.g. via
  /// `Hive.init(tempDir.path)` in a unit test) to skip `Hive.initFlutter()`,
  /// which needs a real platform channel unavailable under `flutter test`.
  /// Real callers never pass it.
  static Future<void> init({Box<String>? box}) async {
    if (box != null) {
      _box = box;
      return;
    }
    await Hive.initFlutter();
    _box = await Hive.openBox<String>(_boxName);
  }

  /// Raw JSON string for [key], or null if never cached (or [init] hasn't
  /// run yet — callers treat that identically to a cache miss).
  static String? read(String key) => _box?.get(key);

  static Future<void> write(String key, String json) async {
    await _box?.put(key, json);
  }

  /// Per-video-id cache for the watch detail screen. Bounded
  /// (LRU-evicted past [_maxCachedWatchedVideos]) so browsing many videos
  /// over time can't grow this without limit.
  static Future<void> writeWatchedVideo(String videoId, String json) async {
    final box = _box;
    if (box == null) return;

    final index = _readWatchIndex(box);
    index.remove(videoId);
    index.add(videoId);
    while (index.length > _maxCachedWatchedVideos) {
      final evicted = index.removeAt(0);
      await box.delete(_watchVideoKey(evicted));
    }
    await box.put(_watchVideoIndexKey, jsonEncode(index));
    await box.put(_watchVideoKey(videoId), json);
  }

  static String? readWatchedVideo(String videoId) => _box?.get(_watchVideoKey(videoId));

  static List<String> _readWatchIndex(Box<String> box) {
    final raw = box.get(_watchVideoIndexKey);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List).cast<String>();
    } catch (_) {
      return [];
    }
  }

  static String _watchVideoKey(String videoId) => 'watch:video:$videoId';
}
