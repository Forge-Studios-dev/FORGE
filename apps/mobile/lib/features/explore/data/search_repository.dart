import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../shared/models/video.dart';

final searchRepositoryProvider = Provider<SearchRepository>((ref) {
  return SearchRepository(ref.read(apiClientProvider));
});

class PlaylistSearchHit {
  final String id;
  final String title;
  final String? description;
  final String visibility;
  final int videoCount;
  final UserModel? owner;

  const PlaylistSearchHit({
    required this.id,
    required this.title,
    this.description,
    required this.visibility,
    required this.videoCount,
    this.owner,
  });

  factory PlaylistSearchHit.fromJson(Map<String, dynamic> json) => PlaylistSearchHit(
        id: json['id'] as String,
        title: json['title'] as String? ?? 'Playlist',
        description: json['description'] as String?,
        visibility: json['visibility'] as String? ?? 'public',
        videoCount: (json['videoCount'] as num?)?.toInt() ?? 0,
        owner: json['user'] is Map<String, dynamic>
            ? UserModel.fromJson(json['user'] as Map<String, dynamic>)
            : null,
      );
}

class SearchResults {
  final List<VideoModel> videos;
  final List<UserModel> users;
  final List<PlaylistSearchHit> playlists;
  final String query;

  const SearchResults({
    required this.videos,
    required this.users,
    required this.playlists,
    required this.query,
  });

  static SearchResults empty(String q) => SearchResults(
        videos: [],
        users: [],
        playlists: [],
        query: q.trim(),
      );
}

class SearchSuggestions {
  final List<String> titles;
  final List<({String username, String displayName})> channels;

  const SearchSuggestions({required this.titles, required this.channels});

  static const empty = SearchSuggestions(titles: [], channels: []);
}

class SearchRepository {
  final ApiClient _apiClient;

  SearchRepository(this._apiClient);

  Future<SearchSuggestions> suggestions(String q, {int limit = 8}) async {
    final term = q.trim();
    if (term.length < 2) return SearchSuggestions.empty;
    final response = await _apiClient.dio.get(
      '/search/suggestions',
      queryParameters: {'q': term, 'limit': limit},
    );
    final payload = response.data['data'] as Map<String, dynamic>? ??
        response.data as Map<String, dynamic>? ??
        {};
    final titles = (payload['titles'] as List<dynamic>? ?? []).whereType<String>().toList();
    final channels = (payload['channels'] as List<dynamic>? ?? [])
        .whereType<Map>()
        .map((e) {
          final m = Map<String, dynamic>.from(e);
          return (
            username: m['username'] as String? ?? '',
            displayName: m['displayName'] as String? ?? m['username'] as String? ?? '',
          );
        })
        .where((c) => c.username.isNotEmpty)
        .toList();
    return SearchSuggestions(titles: titles, channels: channels);
  }

  Future<SearchResults> search(
    String q, {
    int limit = 24,
    String sort = 'relevance',
    String kind = 'any',
    String duration = 'any',
    String uploaded = 'any',
    String captions = 'any',
    String watched = 'any',
    String type = 'all',
  }) async {
    final term = q.trim();
    if (term.length < 2) {
      return SearchResults.empty(term);
    }

    final params = <String, dynamic>{
      'q': term,
      'limit': limit,
      'sort': sort,
      'type': type,
    };
    if (kind != 'any') params['kind'] = kind;
    if (duration != 'any') params['duration'] = duration;
    if (uploaded != 'any') params['uploaded'] = uploaded;
    if (captions != 'any') params['captions'] = captions;
    if (watched != 'any') params['watched'] = watched;

    final response = await _apiClient.dio.get('/search', queryParameters: params);

    final payload = response.data['data'] as Map<String, dynamic>;
    final videos = (payload['videos'] as List<dynamic>? ?? [])
        .map((e) => VideoModel.fromJson(e as Map<String, dynamic>))
        .toList();
    final users = (payload['users'] as List<dynamic>? ?? [])
        .map((e) => UserModel.fromJson(e as Map<String, dynamic>))
        .toList();
    final playlists = (payload['playlists'] as List<dynamic>? ?? [])
        .whereType<Map>()
        .map((e) => PlaylistSearchHit.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final meta = payload['meta'] as Map<String, dynamic>?;
    final resolvedQ = (meta?['q'] as String?) ?? term;

    return SearchResults(
      videos: videos,
      users: users,
      playlists: playlists,
      query: resolvedQ,
    );
  }
}
