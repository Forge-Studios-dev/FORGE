import 'dart:convert';

import 'package:dio/dio.dart';
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

/// Data layer for the watch detail screen — pulled out of
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
    } on DioException catch (e) {
      // Blocked / forbidden — never serve a stale cached copy.
      if (e.response?.statusCode == 403) rethrow;
      final cached = LocalCache.readWatchedVideo(id);
      if (cached != null) return VideoModel.fromJson(jsonDecode(cached) as Map<String, dynamic>);
      rethrow;
    } catch (e) {
      final cached = LocalCache.readWatchedVideo(id);
      if (cached != null) return VideoModel.fromJson(jsonDecode(cached) as Map<String, dynamic>);
      rethrow;
    }
  }

  Future<void> setVideoLiked(String videoId, {required bool liked}) async {
    if (liked) {
      await _client.dio.post('/videos/$videoId/like');
    } else {
      await _client.dio.delete('/videos/$videoId/like');
    }
  }

  Future<void> setSubscribed(String creatorId, {required bool subscribed}) async {
    if (subscribed) {
      await _client.dio.post('/channels/$creatorId/subscribe');
    } else {
      await _client.dio.delete('/channels/$creatorId/subscribe');
    }
  }

  Future<void> setNotifyLevel(String creatorId, {required String notifyLevel}) async {
    await _client.dio.patch(
      '/channels/$creatorId/subscription/notify',
      data: {'notifyLevel': notifyLevel},
    );
  }

  Future<void> addToWatchLater(String videoId) async {
    await _client.dio.post('/playlists/me/watch-later/videos', data: {'videoId': videoId});
  }

  Future<void> removeFromWatchLater(String videoId) async {
    await _client.dio.delete('/playlists/me/watch-later/videos/$videoId');
  }

  Future<bool> isInWatchLater(String videoId) async {
    final res = await _client.dio.get('/playlists/me/watch-later/contains/$videoId');
    final data = res.data['data'] ?? res.data;
    if (data is Map) return data['inWatchLater'] == true;
    return false;
  }

  Future<void> markNotInterested(String videoId) async {
    await _client.dio.post('/videos/$videoId/not-interested');
  }

  Future<void> dontRecommendChannel(String videoId) async {
    await _client.dio.post('/videos/$videoId/dont-recommend-channel');
  }

  Future<List<Map<String, dynamic>>> listMyPlaylists() async {
    final res = await _client.dio.get('/playlists/me');
    final data = res.data['data'] ?? res.data;
    if (data is List) {
      return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  Future<Set<String>> playlistsContaining(String videoId) async {
    final res = await _client.dio.get('/playlists/me/containing/$videoId');
    final data = res.data['data'] ?? res.data;
    if (data is Map && data['playlistIds'] is List) {
      return (data['playlistIds'] as List).whereType<String>().toSet();
    }
    return {};
  }

  Future<void> addVideoToPlaylist({required String playlistId, required String videoId}) async {
    await _client.dio.post('/playlists/$playlistId/videos', data: {'videoId': videoId});
  }

  Future<void> removeVideoFromPlaylist({required String playlistId, required String videoId}) async {
    await _client.dio.delete('/playlists/$playlistId/videos/$videoId');
  }

  Future<Map<String, dynamic>> createPlaylist({
    required String title,
    String visibility = 'private',
    String? description,
  }) async {
    final res = await _client.dio.post(
      '/playlists',
      data: {
        'title': title,
        'visibility': visibility,
        if (description != null && description.trim().isNotEmpty)
          'description': description.trim(),
      },
    );
    final data = res.data['data'] ?? res.data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> sendSuperThanks({
    required String videoId,
    required int amountCents,
    String? body,
  }) async {
    final res = await _client.dio.post(
      '/billing/checkout/super-thanks',
      data: {
        'videoId': videoId,
        'amountCents': amountCents,
        if (body != null && body.isNotEmpty) 'body': body,
      },
    );
    final data = res.data;
    if (data is Map<String, dynamic>) {
      final nested = data['data'];
      if (nested is Map<String, dynamic>) return nested;
      return data;
    }
    return <String, dynamic>{};
  }

  Future<void> reportVideo({required String videoId, required String reason}) async {
    await _client.dio.post('/reports', data: {
      'targetType': 'video',
      'targetId': videoId,
      'reason': reason,
      'reasonCategory': reason,
    });
  }

  Future<void> reportUser({required String userId, required String reason}) async {
    await _client.dio.post('/reports', data: {
      'targetType': 'user',
      'targetId': userId,
      'reason': reason,
      'reasonCategory': reason,
    });
  }

  Future<List<dynamic>> getCommentReplies(
    String videoId,
    String commentId, {
    String? cursor,
    int limit = 20,
  }) async {
    final params = <String, dynamic>{'limit': limit};
    if (cursor != null) params['cursor'] = cursor;
    final res = await _client.dio.get(
      '/videos/$videoId/comments/$commentId/replies',
      queryParameters: params,
    );
    final payload = res.data['data'];
    if (payload is Map) {
      return (payload['data'] as List<dynamic>?) ?? [];
    }
    if (payload is List) return payload;
    return [];
  }

  Future<CommentsPage> getComments(
    String videoId, {
    String? cursor,
    int limit = 20,
    String sort = 'top',
  }) async {
    final params = <String, dynamic>{'limit': limit, 'sort': sort};
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

  Future<void> reportComment({required String commentId, required String reason}) async {
    await _client.dio.post('/reports', data: {
      'targetType': 'comment',
      'targetId': commentId,
      'reason': reason,
      'reasonCategory': reason,
    });
  }

  Future<List<Map<String, dynamic>>> listMutedChannels() async {
    final res = await _client.dio.get('/me/muted-channels');
    final data = res.data['data'] ?? res.data;
    if (data is List) {
      return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  Future<void> unmuteChannel(String channelId) async {
    await _client.dio.delete('/channels/$channelId/dont-recommend');
  }

  /// Fire-and-forget share tracking (creator analytics) — never throws.
  Future<void> recordShare(String videoId, {String channel = 'native'}) async {
    try {
      await _client.dio.post('/videos/$videoId/share', data: {'channel': channel});
    } catch (_) {
      // Best-effort — sharing itself already succeeded via the OS share sheet.
    }
  }

  Future<Map<String, dynamic>> getNotificationPreferences() async {
    final res = await _client.dio.get('/users/me/notification-preferences');
    final data = res.data['data'] ?? res.data;
    return data is Map ? Map<String, dynamic>.from(data) : {};
  }

  Future<void> setNotificationPreferences({
    required List<String> mutedCategories,
    required bool emailDigest,
  }) async {
    await _client.dio.put('/users/me/notification-preferences', data: {
      'mutedCategories': mutedCategories,
      'emailDigest': emailDigest,
    });
  }

  Future<List<Map<String, dynamic>>> listBlockedUsers() async {
    final res = await _client.dio.get('/me/blocked-users');
    final data = res.data['data'] ?? res.data;
    if (data is List) {
      return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  Future<void> blockUser(String userId) async {
    await _client.dio.post('/users/$userId/block');
  }

  Future<void> unblockUser(String userId) async {
    await _client.dio.delete('/users/$userId/block');
  }

  Future<void> postComment(String videoId, {required String content, String? parentId}) async {
    final body = <String, dynamic>{'content': content};
    if (parentId != null) body['parentId'] = parentId;
    await _client.dio.post('/videos/$videoId/comments', data: body);
  }

  Future<void> updateComment(String videoId, String commentId, {required String content}) async {
    await _client.dio.patch(
      '/videos/$videoId/comments/$commentId',
      data: {'content': content},
    );
  }

  Future<void> deleteComment(String videoId, String commentId) async {
    await _client.dio.delete('/videos/$videoId/comments/$commentId');
  }

  Future<Map<String, dynamic>?> getComment(String videoId, String commentId) async {
    final res = await _client.dio.get('/videos/$videoId/comments/$commentId');
    return res.data['data'] as Map<String, dynamic>?;
  }

  Future<void> setCommentLiked(String videoId, String commentId, {required bool liked}) async {
    if (liked) {
      await _client.dio.delete('/videos/$videoId/comments/$commentId/like');
    } else {
      await _client.dio.post('/videos/$videoId/comments/$commentId/like');
    }
  }

  Future<void> setCommentDisliked(String videoId, String commentId, {required bool disliked}) async {
    if (disliked) {
      await _client.dio.delete('/videos/$videoId/comments/$commentId/dislike');
    } else {
      await _client.dio.post('/videos/$videoId/comments/$commentId/dislike');
    }
  }

  Future<void> setCommentPinned(
    String videoId,
    String commentId, {
    required bool isPinned,
  }) async {
    await _client.dio.post(
      '/videos/$videoId/comments/$commentId/pin',
      data: {'isPinned': isPinned},
    );
  }

  Future<void> setCreatorHeart(
    String videoId,
    String commentId, {
    required bool creatorHearted,
  }) async {
    await _client.dio.post(
      '/videos/$videoId/comments/$commentId/creator-heart',
      data: {'creatorHearted': creatorHearted},
    );
  }

  /// Video owner releases a held (auto-flagged) comment back to public view.
  Future<void> approveComment(String videoId, String commentId) async {
    await _client.dio.post('/videos/$videoId/comments/$commentId/approve');
  }

  Future<void> setVideoDisliked(String videoId, {required bool disliked}) async {
    if (disliked) {
      await _client.dio.post('/videos/$videoId/dislike');
    } else {
      await _client.dio.delete('/videos/$videoId/dislike');
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

  /// Server-proxied WebVTT text for transcript UI (avoids CDN CORS on mobile).
  Future<String> getCaptionText(String videoId, {required String language}) async {
    final res = await _client.dio.get(
      '/videos/$videoId/captions',
      queryParameters: {'language': language},
    );
    final data = res.data['data'];
    if (data is Map && data['text'] is String) return data['text'] as String;
    return '';
  }
}
