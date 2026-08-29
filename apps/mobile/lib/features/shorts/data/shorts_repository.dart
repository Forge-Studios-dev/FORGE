import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/models/video.dart';
import '../../feed/data/feed_repository.dart';

final shortsRepositoryProvider = Provider<ShortsRepository>((ref) {
  return ShortsRepository(ref.read(apiClientProvider));
});

class ShortsRepository {
  final ApiClient _api;

  ShortsRepository(this._api);

  Future<FeedPage> getFeed({String? cursor}) async {
    final params = <String, dynamic>{'limit': AppConstants.feedPageSize};
    if (cursor != null) params['cursor'] = cursor;
    final response = await _api.dio.get('/videos/shorts', queryParameters: params);
    final data = response.data['data'] as Map<String, dynamic>;
    final list = data['data'] as List? ?? const [];
    final videos = list.map((v) => VideoModel.fromJson(v as Map<String, dynamic>)).toList();
    final next = data['nextCursor'] as String? ??
        (data['meta'] is Map ? (data['meta'] as Map)['cursor'] as String? : null);
    final hasMore = next != null ||
        (data['meta'] is Map ? (data['meta'] as Map)['hasMore'] == true : false);
    return FeedPage(videos: videos, nextCursor: next, hasMore: hasMore);
  }
}
