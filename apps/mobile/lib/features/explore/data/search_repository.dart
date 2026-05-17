import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../shared/models/video.dart';

final searchRepositoryProvider = Provider<SearchRepository>((ref) {
  return SearchRepository(ref.read(apiClientProvider));
});

class SearchResults {
  final List<VideoModel> videos;
  final List<UserModel> users;
  final String query;

  const SearchResults({required this.videos, required this.users, required this.query});

  static SearchResults empty(String q) => SearchResults(videos: [], users: [], query: q.trim());
}

class SearchRepository {
  final ApiClient _apiClient;

  SearchRepository(this._apiClient);

  Future<SearchResults> search(String q, {int limit = 24}) async {
    final term = q.trim();
    if (term.length < 2) {
      return SearchResults.empty(term);
    }

    final response = await _apiClient.dio.get(
      '/search',
      queryParameters: {'q': term, 'limit': limit},
    );

    final payload = response.data['data'] as Map<String, dynamic>;
    final videos = (payload['videos'] as List<dynamic>)
        .map((e) => VideoModel.fromJson(e as Map<String, dynamic>))
        .toList();
    final users = (payload['users'] as List<dynamic>)
        .map((e) => UserModel.fromJson(e as Map<String, dynamic>))
        .toList();
    final meta = payload['meta'] as Map<String, dynamic>?;
    final resolvedQ = (meta?['q'] as String?) ?? term;

    return SearchResults(videos: videos, users: users, query: resolvedQ);
  }
}
