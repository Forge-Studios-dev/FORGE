import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/cache/local_cache.dart';
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
  /// True when this page was served from the offline cache rather than the
  /// network (HIGH-07) — callers can use this to show a subtle "offline"
  /// indicator instead of the default network-loading UI.
  final bool isFromCache;

  const FeedPage({
    required this.videos,
    this.nextCursor,
    required this.hasMore,
    this.isFromCache = false,
  });

  Map<String, dynamic> toJson() => {
        'videos': videos.map((v) => v.toJson()).toList(),
        'nextCursor': nextCursor,
      };

  factory FeedPage.fromCachedJson(String raw) {
    final json = jsonDecode(raw) as Map<String, dynamic>;
    return FeedPage(
      videos: (json['videos'] as List)
          .map((v) => VideoModel.fromJson(v as Map<String, dynamic>))
          .toList(),
      // A cached page is a first-page snapshot only — pagination requires
      // network, so don't offer a "load more" that can't be fulfilled offline.
      nextCursor: null,
      hasMore: false,
      isFromCache: true,
    );
  }
}

class FeedRepository {
  final ApiClient _apiClient;
  FeedRepository(this._apiClient);

  Future<FeedPage> getFeed({String? cursor, String? categoryId}) async {
    // Only the first page of the unfiltered feed is worth persisting offline —
    // matches what a user actually sees on cold start with no connectivity.
    final cacheKey = (cursor == null && categoryId == null) ? 'feed:default' : null;

    final params = <String, dynamic>{'limit': AppConstants.feedPageSize};
    if (cursor != null) params['cursor'] = cursor;
    if (categoryId != null) params['categoryId'] = categoryId;

    try {
      final response = await _apiClient.dio.get('/videos/feed', queryParameters: params);
      final data = response.data['data'] as Map<String, dynamic>;
      final videos = (data['data'] as List)
          .map((v) => VideoModel.fromJson(v as Map<String, dynamic>))
          .toList();
      final meta = data['meta'] as Map<String, dynamic>;

      final page = FeedPage(
        videos: videos,
        nextCursor: meta['cursor'] as String?,
        hasMore: meta['hasMore'] as bool,
      );
      if (cacheKey != null) {
        await LocalCache.write(cacheKey, jsonEncode(page.toJson()));
      }
      return page;
    } catch (e) {
      final cached = cacheKey != null ? LocalCache.read(cacheKey) : null;
      if (cached != null) return FeedPage.fromCachedJson(cached);
      rethrow;
    }
  }

  Future<FeedPage> getFollowingFeed({String? cursor}) async {
    final cacheKey = cursor == null ? 'feed:following' : null;
    final params = <String, dynamic>{'limit': AppConstants.feedPageSize};
    if (cursor != null) params['cursor'] = cursor;

    try {
      final response = await _apiClient.dio.get('/videos/feed/following', queryParameters: params);
      final data = response.data['data'] as Map<String, dynamic>;
      final videos = (data['data'] as List)
          .map((v) => VideoModel.fromJson(v as Map<String, dynamic>))
          .toList();
      final meta = data['meta'] as Map<String, dynamic>;

      final page = FeedPage(
        videos: videos,
        nextCursor: meta['cursor'] as String?,
        hasMore: meta['hasMore'] as bool,
      );
      if (cacheKey != null) {
        await LocalCache.write(cacheKey, jsonEncode(page.toJson()));
      }
      return page;
    } catch (e) {
      final cached = cacheKey != null ? LocalCache.read(cacheKey) : null;
      if (cached != null) return FeedPage.fromCachedJson(cached);
      rethrow;
    }
  }
}
