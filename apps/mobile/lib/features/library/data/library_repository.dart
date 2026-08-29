import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../shared/models/video.dart';

final libraryRepositoryProvider = Provider<LibraryRepository>((ref) {
  return LibraryRepository(ref.read(apiClientProvider));
});

typedef LibraryPlaylistCounts = ({int? watchLater, int? liked, int? playlists});

class LibraryRepository {
  final ApiClient _api;

  LibraryRepository(this._api);

  /// System + custom playlist shelf counts for Library (You / Library home).
  Future<LibraryPlaylistCounts> getPlaylistCounts() async {
    final res = await _api.dio.get('/playlists/me');
    final list = res.data['data'];
    if (list is! List) return (watchLater: null, liked: null, playlists: null);
    int? watchLater;
    int? liked;
    var custom = 0;
    for (final raw in list) {
      if (raw is! Map) continue;
      final p = Map<String, dynamic>.from(raw);
      final system = p['systemType'] as String?;
      final count = (p['videoCount'] as num?)?.toInt();
      if (system == 'watch_later') {
        watchLater = count;
      } else if (system == 'liked') {
        liked = count;
      } else if (system == null) {
        custom += 1;
      }
    }
    return (watchLater: watchLater, liked: liked, playlists: custom);
  }

  Future<List<VideoModel>> getDislikedVideos({int limit = 100}) async {
    final response = await _api.dio.get(
      '/me/disliked-videos',
      queryParameters: {'limit': limit},
    );
    final root = response.data['data'];
    List list;
    if (root is Map && root['data'] is List) {
      list = root['data'] as List;
    } else if (root is List) {
      list = root;
    } else {
      list = const [];
    }
    final videos = <VideoModel>[];
    for (final item in list) {
      if (item is! Map<String, dynamic>) continue;
      try {
        videos.add(VideoModel.fromJson(item));
      } catch (_) {
        /* skip malformed */
      }
    }
    return videos;
  }

  Future<void> removeDislike(String videoId) async {
    await _api.dio.delete('/videos/$videoId/dislike');
  }

  Future<void> clearDislikedVideos() async {
    await _api.dio.delete('/me/disliked-videos');
  }
}
