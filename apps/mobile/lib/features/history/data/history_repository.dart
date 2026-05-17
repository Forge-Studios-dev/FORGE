import 'package:flutter_riverpod/flutter_riverpod.dart';

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

class HistoryRepository {
  final ApiClient _apiClient;

  HistoryRepository(this._apiClient);

  Future<List<VideoModel>> getWatchHistory({int limit = 50}) async {
    final response = await _apiClient.dio.get(
      '/users/me/watch-history',
      queryParameters: {'limit': limit},
    );
    final envelope = response.data['data'] as Map<String, dynamic>;
    final list = envelope['data'] as List<dynamic>;
    return list.map((e) => VideoModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<VideoModel>> getContinueWatching({int limit = 12}) async {
    final response = await _apiClient.dio.get(
      '/users/me/watch-history',
      queryParameters: {'limit': limit, 'incomplete': 'true'},
    );
    final envelope = response.data['data'] as Map<String, dynamic>;
    final list = envelope['data'] as List<dynamic>;
    return list.map((e) => VideoModel.fromJson(e as Map<String, dynamic>)).toList();
  }
}
