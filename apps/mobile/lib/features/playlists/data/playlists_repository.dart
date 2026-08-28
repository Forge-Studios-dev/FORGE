import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../shared/models/video.dart';

final playlistsRepositoryProvider = Provider<PlaylistsRepository>((ref) {
  return PlaylistsRepository(ref.read(apiClientProvider));
});

typedef SystemPlaylistResult = ({List<VideoModel> videos, String? playlistId});

class PlaylistsRepository {
  final ApiClient _api;

  PlaylistsRepository(this._api);

  Future<List<dynamic>> listMine() async {
    final res = await _api.dio.get('/playlists/me');
    return res.data['data'] as List<dynamic>? ?? [];
  }

  Future<String?> create({
    required String title,
    required String visibility,
    String? description,
  }) async {
    final res = await _api.dio.post(
      '/playlists',
      data: {
        'title': title,
        'visibility': visibility,
        if (description != null && description.isNotEmpty) 'description': description,
      },
    );
    final data = res.data['data'];
    if (data is Map && data['id'] is String) return data['id'] as String;
    return null;
  }

  Future<Map<String, dynamic>?> getById(String playlistId) async {
    final res = await _api.dio.get('/playlists/$playlistId');
    return res.data['data'] as Map<String, dynamic>?;
  }

  Future<Map<String, dynamic>?> getMe() async {
    final res = await _api.dio.get('/users/me');
    return res.data['data'] as Map<String, dynamic>?;
  }

  Future<void> removeVideo({
    required String playlistId,
    required String videoId,
  }) async {
    await _api.dio.delete('/playlists/$playlistId/videos/$videoId');
  }

  Future<List<Map<String, dynamic>>> listStudioReadyVideos({int limit = 50}) async {
    final res = await _api.dio.get(
      '/videos/studio',
      queryParameters: {'limit': limit, 'status': 'ready'},
    );
    final data = res.data['data'] as Map<String, dynamic>?;
    final list = (data?['data'] as List?) ?? [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .where((v) => v['id'] is String && v['status'] == 'ready')
        .toList();
  }

  Future<void> addVideo({
    required String playlistId,
    required String videoId,
  }) async {
    await _api.dio.post(
      '/playlists/$playlistId/videos',
      data: {'videoId': videoId},
    );
  }

  Future<void> update({
    required String playlistId,
    required String title,
    String? description,
    required String visibility,
  }) async {
    await _api.dio.patch(
      '/playlists/$playlistId',
      data: {
        'title': title,
        'description': description,
        'visibility': visibility,
      },
    );
  }

  Future<void> delete(String playlistId) async {
    await _api.dio.delete('/playlists/$playlistId');
  }

  Future<void> reorder({
    required String playlistId,
    required List<String> videoIds,
  }) async {
    await _api.dio.put(
      '/playlists/$playlistId/reorder',
      data: {'videoIds': videoIds},
    );
  }

  Future<SystemPlaylistResult> getSystemPlaylist(String kind) async {
    final path =
        kind == 'liked' ? '/playlists/me/liked' : '/playlists/me/watch-later';
    final response = await _api.dio.get(path);
    final root = response.data['data'];
    String? playlistId;
    List list;
    if (root is Map && root['videos'] is List) {
      list = root['videos'] as List;
      playlistId = root['id'] as String?;
    } else if (root is Map && root['items'] is List) {
      list = root['items'] as List;
      playlistId = root['id'] as String?;
    } else if (root is Map && root['data'] is List) {
      list = root['data'] as List;
      playlistId = root['id'] as String?;
    } else if (root is List) {
      list = root;
    } else {
      list = const [];
    }
    final videos = <VideoModel>[];
    for (final item in list) {
      if (item is! Map<String, dynamic>) continue;
      final videoJson = item['video'] is Map<String, dynamic>
          ? item['video'] as Map<String, dynamic>
          : item;
      try {
        videos.add(VideoModel.fromJson(videoJson));
      } catch (_) {
        /* skip malformed */
      }
    }
    return (videos: videos, playlistId: playlistId);
  }

  Future<void> removeFromSystemPlaylist({
    required String kind,
    required String videoId,
  }) async {
    if (kind == 'liked') {
      await _api.dio.delete('/videos/$videoId/like');
    } else {
      await _api.dio.delete('/playlists/me/watch-later/videos/$videoId');
    }
  }

  Future<void> clearSystemPlaylist(String kind) async {
    if (kind == 'liked') {
      await _api.dio.delete('/playlists/me/liked/videos');
    } else {
      await _api.dio.delete('/playlists/me/watch-later/videos');
    }
  }
}
