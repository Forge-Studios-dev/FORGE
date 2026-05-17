import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/models/video.dart';

final studioRepositoryProvider = Provider<StudioRepository>((ref) {
  return StudioRepository(ref.read(apiClientProvider));
});

class StudioRepository {
  final ApiClient _api;
  StudioRepository(this._api);

  Future<String> _myUserId() async {
    final meRes = await _api.dio.get('/users/me');
    return meRes.data['data']['id'] as String;
  }

  Future<List<VideoModel>> getMyVideos() async {
    final userId = await _myUserId();
    final videosRes = await _api.dio.get('/users/$userId/videos', queryParameters: {'limit': 50});
    final data = videosRes.data['data'] as Map<String, dynamic>;
    final list = data['data'] as List;
    return list.map((v) => VideoModel.fromJson(v as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> getMe() async {
    final res = await _api.dio.get('/users/me');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getRecentComments() async {
    final videos = await getMyVideos();
    final comments = <Map<String, dynamic>>[];
    for (final v in videos.take(6)) {
      try {
        final res = await _api.dio.get('/videos/${v.id}/comments', queryParameters: {'limit': 5});
        final list = res.data['data']['data'] as List;
        for (final c in list) {
          final m = Map<String, dynamic>.from(c as Map);
          m['videoTitle'] = v.title;
          m['videoId'] = v.id;
          comments.add(m);
        }
      } catch (_) {}
    }
    comments.sort((a, b) {
      final ad = DateTime.tryParse(a['createdAt'] as String? ?? '') ?? DateTime(1970);
      final bd = DateTime.tryParse(b['createdAt'] as String? ?? '') ?? DateTime(1970);
      return bd.compareTo(ad);
    });
    return comments.take(25).toList();
  }
}
