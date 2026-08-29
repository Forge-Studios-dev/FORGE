import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final communityRepositoryProvider = Provider<CommunityRepository>((ref) {
  return CommunityRepository(ref.read(apiClientProvider));
});

class CommunityUpdatesPage {
  final List<dynamic> items;
  final String? nextCursor;
  final bool hasMore;

  const CommunityUpdatesPage({
    required this.items,
    this.nextCursor,
    required this.hasMore,
  });
}

class CommunityRepository {
  final ApiClient _api;

  CommunityRepository(this._api);

  /// Loads a single community by slug, or the creator's first community when
  /// [slug] is null. Returns null when the creator has no communities / no slug.
  Future<Map<String, dynamic>?> resolveCommunity({
    required String creatorId,
    String? slug,
  }) async {
    if (slug != null) {
      final res = await _api.dio.get('/creators/$creatorId/communities/$slug');
      return res.data['data'] as Map<String, dynamic>;
    }
    final listRes = await _api.dio.get('/creators/$creatorId/communities');
    final list = (listRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    if (list.isEmpty) return null;
    final firstSlug = list.first['slug'] as String?;
    if (firstSlug == null) return null;
    final res = await _api.dio.get('/creators/$creatorId/communities/$firstSlug');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getCommunityAccess({
    required String creatorId,
    required String slug,
  }) async {
    final res = await _api.dio.get('/creators/$creatorId/communities/$slug/access');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> requestJoin(String communityId) async {
    await _api.dio.post('/communities/$communityId/join-request');
  }

  Future<List<Map<String, dynamic>>> getPosts(String communityId) async {
    final response = await _api.dio.get('/communities/$communityId/posts');
    final data = response.data['data']['data'] as List;
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>?> getActivePoll(String communityId) async {
    final response = await _api.dio.get('/communities/$communityId/polls/active');
    return response.data['data'] as Map<String, dynamic>?;
  }

  Future<List<Map<String, dynamic>>> getLiveStreams(String communityId) async {
    final response = await _api.dio.get('/communities/$communityId/live');
    final data = response.data['data'] as List? ?? [];
    return data.cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> getPostComments(
    String communityId,
    String postId,
  ) async {
    final response =
        await _api.dio.get('/communities/$communityId/posts/$postId/comments');
    final data = response.data['data']['data'] as List? ?? [];
    return data.cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> getRooms(String communityId) async {
    final response = await _api.dio.get('/communities/$communityId/rooms');
    return (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<List<Map<String, dynamic>>> getEvents(String communityId) async {
    final response = await _api.dio.get('/communities/$communityId/events');
    final eventsPayload = response.data['data'];
    if (eventsPayload is List) {
      return eventsPayload.cast<Map<String, dynamic>>();
    }
    if (eventsPayload is Map && eventsPayload['data'] is List) {
      return (eventsPayload['data'] as List).cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<void> rsvpEvent(
    String communityId,
    String eventId, {
    String status = 'going',
  }) async {
    await _api.dio.post(
      '/communities/$communityId/events/$eventId/rsvp',
      data: {'status': status},
    );
  }

  Future<void> submitReport(
    String communityId,
    Map<String, dynamic> data,
  ) async {
    await _api.dio.post('/communities/$communityId/reports', data: data);
  }

  Future<void> votePoll(
    String communityId,
    String pollId, {
    required int optionIndex,
  }) async {
    await _api.dio.post(
      '/communities/$communityId/polls/$pollId/vote',
      data: {'optionIndex': optionIndex},
    );
  }

  Future<void> togglePostReaction(String communityId, String postId) async {
    await _api.dio.post('/communities/$communityId/posts/$postId/reactions');
  }

  Future<void> addPostComment(
    String communityId,
    String postId, {
    required String body,
    String? parentId,
  }) async {
    final payload = <String, dynamic>{'body': body};
    if (parentId != null) payload['parentId'] = parentId;
    await _api.dio.post(
      '/communities/$communityId/posts/$postId/comments',
      data: payload,
    );
  }

  Future<List<Map<String, dynamic>>> getFeaturedCommunities() async {
    final response = await _api.dio.get('/communities/discover/featured');
    final data = response.data['data'] as List? ?? [];
    return data.cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> searchCommunities(String q) async {
    final response = await _api.dio.get(
      '/communities/search',
      queryParameters: {'q': q},
    );
    final data = response.data['data'] as List? ?? [];
    return data.cast<Map<String, dynamic>>();
  }

  Future<CommunityUpdatesPage> getCommunityUpdates({
    String? cursor,
    int limit = 20,
  }) async {
    final params = <String, dynamic>{'limit': limit};
    if (cursor != null) params['cursor'] = cursor;
    final res = await _api.dio.get('/me/community-updates', queryParameters: params);
    final payload = res.data['data'] as Map<String, dynamic>;
    final data = payload['data'] as List<dynamic>? ?? [];
    final meta = payload['meta'] as Map<String, dynamic>? ?? {};
    return CommunityUpdatesPage(
      items: data,
      nextCursor: meta['cursor'] as String?,
      hasMore: meta['hasMore'] == true,
    );
  }

  Future<Map<String, dynamic>?> getRoom(String communityId, String roomId) async {
    final roomRes =
        await _api.dio.get('/communities/$communityId/rooms/$roomId');
    return roomRes.data['data'] as Map<String, dynamic>?;
  }

  Future<List<Map<String, dynamic>>> getRoomMessages(
    String communityId,
    String roomId,
  ) async {
    final msgRes =
        await _api.dio.get('/communities/$communityId/rooms/$roomId/messages');
    return (msgRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<String?> getCurrentUserId() async {
    final me = await _api.dio.get('/users/me');
    return me.data['data']?['id'] as String?;
  }

  Future<Map<String, dynamic>?> sendRoomMessage(
    String communityId,
    String roomId, {
    required String body,
    String? parentMessageId,
  }) async {
    final payload = <String, dynamic>{'body': body};
    if (parentMessageId != null) payload['parentMessageId'] = parentMessageId;
    final res = await _api.dio.post(
      '/communities/$communityId/rooms/$roomId/messages',
      data: payload,
    );
    return res.data['data'] as Map<String, dynamic>?;
  }

  Future<Map<String, dynamic>?> getVoiceRoomToken(
    String communityId,
    String roomId,
  ) async {
    final res = await _api.dio.post(
      '/communities/$communityId/rooms/$roomId/token',
    );
    return res.data['data'] as Map<String, dynamic>?;
  }

  Future<List<Map<String, dynamic>>> getRaisedHands(
    String communityId,
    String roomId,
  ) async {
    final res = await _api.dio.get(
      '/communities/$communityId/rooms/$roomId/raise-hands',
    );
    return (res.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<void> raiseHand(String communityId, String roomId) async {
    await _api.dio.post('/communities/$communityId/rooms/$roomId/raise-hand');
  }

  Future<void> lowerHand(String communityId, String roomId) async {
    await _api.dio.delete('/communities/$communityId/rooms/$roomId/raise-hand');
  }

  Future<void> approveSpeaker(
    String communityId,
    String roomId,
    String targetUserId,
  ) async {
    await _api.dio.post(
      '/communities/$communityId/rooms/$roomId/raise-hand/$targetUserId/approve',
    );
  }
}
