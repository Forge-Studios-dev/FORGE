import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/local_cache.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/models/video.dart';

final watchRepositoryProvider = Provider<WatchRepository>((ref) {
  return WatchRepository(ref.read(apiClientProvider));
});

class CommentsPage {
  final List<dynamic> comments;
  final String? nextCursor;
  final bool hasMore;

  const CommentsPage({
    required this.comments,
    this.nextCursor,
    required this.hasMore,
  });
}

/// Data layer for the watch/lesson-detail screen — pulled out of
/// `watch_screen.dart` (which previously called `client.dio.get/post/delete`
/// directly in widget code) so the feature follows the same
/// `data/` + `presentation/` split used elsewhere (e.g. `feed`, `upload`).
/// Behavior is unchanged from the inline calls it replaces.
class WatchRepository {
  final ApiClient _client;
  WatchRepository(this._client);

  /// Cache-then-network (HIGH-07): a previously-viewed video's metadata still
  /// renders when offline instead of an error screen. Playback itself still
  /// needs a live HLS connection — this only covers the detail/metadata view.
  Future<VideoModel> getVideo(String id) async {
    try {
      final response = await _client.dio.get('/videos/$id');
      final payload = response.data['data'] as Map<String, dynamic>;
      final video = VideoModel.fromJson(payload);
      await LocalCache.writeWatchedVideo(id, jsonEncode(video.toJson()));
      return video;
    } catch (e) {
      final cached = LocalCache.readWatchedVideo(id);
      if (cached != null) return VideoModel.fromJson(jsonDecode(cached) as Map<String, dynamic>);
      rethrow;
    }
  }

  Future<void> reportVideo({required String videoId, required String reason}) async {
    await _client.dio.post('/reports', data: {
      'targetType': 'video',
      'targetId': videoId,
      'reason': reason,
    });
  }

  Future<CommentsPage> getComments(String videoId, {String? cursor, int limit = 20}) async {
    final params = <String, dynamic>{'limit': limit};
    if (cursor != null) params['cursor'] = cursor;
    final res = await _client.dio.get('/videos/$videoId/comments', queryParameters: params);
    final payload = res.data['data'] as Map<String, dynamic>;
    final data = payload['data'] as List<dynamic>? ?? [];
    final meta = payload['meta'] as Map<String, dynamic>? ?? {};
    return CommentsPage(
      comments: data,
      nextCursor: meta['cursor'] as String?,
      hasMore: meta['hasMore'] == true,
    );
  }

  Future<void> postComment(String videoId, {required String content, String? parentId}) async {
    final body = <String, dynamic>{'content': content};
    if (parentId != null) body['parentId'] = parentId;
    await _client.dio.post('/videos/$videoId/comments', data: body);
  }

  Future<void> setCommentLiked(String videoId, String commentId, {required bool liked}) async {
    if (liked) {
      await _client.dio.delete('/videos/$videoId/comments/$commentId/like');
    } else {
      await _client.dio.post('/videos/$videoId/comments/$commentId/like');
    }
  }

  Future<void> recordWatch(String videoId, {required int progressSeconds}) async {
    await _client.dio.post(
      '/videos/$videoId/watch',
      data: {'progressSeconds': progressSeconds},
    );
  }

  Future<List<dynamic>> getRelated(String videoId, {int limit = 8}) async {
    final res = await _client.dio.get(
      '/videos/$videoId/related',
      queryParameters: {'limit': limit},
    );
    final payload = res.data['data'] as Map<String, dynamic>;
    return payload['data'] as List<dynamic>? ?? [];
  }
}
