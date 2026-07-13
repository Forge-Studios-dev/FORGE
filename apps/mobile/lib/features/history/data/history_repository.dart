import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/local_cache.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/models/video.dart';

final historyRepositoryProvider = Provider<HistoryRepository>((ref) {
  return HistoryRepository(ref.read(apiClientProvider));
});

/// Incomplete / in-progress watches for continue watching (requires auth).
final continueWatchingProvider = FutureProvider.autoDispose<List<VideoModel>>((ref) async {
  try {
    return await ref.read(historyRepositoryProvider).getContinueWatching(limit: 12);
  } catch (_) {
    return [];
  }
});

String _encodeVideoList(List<VideoModel> videos) =>
    jsonEncode(videos.map((v) => v.toJson()).toList());

List<VideoModel> _decodeVideoList(String raw) =>
    (jsonDecode(raw) as List).map((v) => VideoModel.fromJson(v as Map<String, dynamic>)).toList();

class HistoryRepository {
  final ApiClient _apiClient;

  HistoryRepository(this._apiClient);

  static const _watchHistoryCacheKey = 'history:watch';
  static const _continueWatchingCacheKey = 'history:continue';

  Future<List<VideoModel>> getWatchHistory({int limit = 50}) async {
    try {
      final response = await _apiClient.dio.get(
        '/users/me/watch-history',
        queryParameters: {'limit': limit},
      );
      final envelope = response.data['data'] as Map<String, dynamic>;
      final list = envelope['data'] as List<dynamic>;
      final videos = list.map((e) => VideoModel.fromJson(e as Map<String, dynamic>)).toList();
      await LocalCache.write(_watchHistoryCacheKey, _encodeVideoList(videos));
      return videos;
    } catch (e) {
      final cached = LocalCache.read(_watchHistoryCacheKey);
      if (cached != null) return _decodeVideoList(cached);
      rethrow;
    }
  }

  Future<List<VideoModel>> getContinueWatching({int limit = 12}) async {
    try {
      final response = await _apiClient.dio.get(
        '/users/me/watch-history',
        queryParameters: {'limit': limit, 'incomplete': 'true'},
      );
      final envelope = response.data['data'] as Map<String, dynamic>;
      final list = envelope['data'] as List<dynamic>;
      final videos = list.map((e) => VideoModel.fromJson(e as Map<String, dynamic>)).toList();
      await LocalCache.write(_continueWatchingCacheKey, _encodeVideoList(videos));
      return videos;
    } catch (e) {
      final cached = LocalCache.read(_continueWatchingCacheKey);
      if (cached != null) return _decodeVideoList(cached);
      rethrow;
    }
  }
}
