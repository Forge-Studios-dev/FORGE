import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/constants/app_constants.dart';
import '../../../shared/models/video.dart';

final feedRepositoryProvider = Provider<FeedRepository>((ref) {
  return FeedRepository(ref.read(apiClientProvider));
});

class FeedPage {
  final List<VideoModel> videos;
  final String? nextCursor;
  final bool hasMore;

  const FeedPage({required this.videos, this.nextCursor, required this.hasMore});
}

class FeedRepository {
  final ApiClient _apiClient;
  FeedRepository(this._apiClient);

  Future<FeedPage> getFeed({String? cursor, String? categoryId}) async {
    final params = <String, dynamic>{'limit': AppConstants.feedPageSize};
    if (cursor != null) params['cursor'] = cursor;
    if (categoryId != null) params['categoryId'] = categoryId;

    final response = await _apiClient.dio.get('/videos/feed', queryParameters: params);
    final data = response.data['data'] as Map<String, dynamic>;
    final videos = (data['data'] as List)
        .map((v) => VideoModel.fromJson(v as Map<String, dynamic>))
        .toList();
    final meta = data['meta'] as Map<String, dynamic>;

    return FeedPage(
      videos: videos,
      nextCursor: meta['cursor'] as String?,
      hasMore: meta['hasMore'] as bool,
    );
  }
}
