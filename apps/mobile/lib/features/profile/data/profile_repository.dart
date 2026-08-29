import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/s3_upload_client.dart';
import '../../../shared/models/video.dart';

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(ref.read(apiClientProvider));
});

class ProfileCursorPage {
  final List<dynamic> items;
  final String? nextCursor;
  final bool hasMore;

  const ProfileCursorPage({
    required this.items,
    this.nextCursor,
    required this.hasMore,
  });
}

class ProfileRepository {
  final ApiClient _api;

  ProfileRepository(this._api);

  // ── Profile / users ───────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getMe() async {
    final res = await _api.dio.get('/users/me');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getByUsername(String username) async {
    final res = await _api.dio.get('/users/by-username/$username');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<UserModel> getUserProfile(String username) async {
    final data = username == 'me' ? await getMe() : await getByUsername(username);
    return UserModel.fromJson(data);
  }

  Future<Map<String, dynamic>> updateProfile(
    String userId, {
    String? username,
    required String displayName,
    String? bio,
    String? websiteUrl,
    required List<Map<String, String>> channelLinks,
  }) async {
    final res = await _api.dio.put('/users/$userId', data: {
      if (username != null) 'username': username,
      'displayName': displayName,
      'bio': bio,
      'websiteUrl': websiteUrl,
      'channelLinks': channelLinks,
    });
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<VideoModel>> getUserVideos(
    String userId, {
    required String type,
    String sort = 'newest',
    int limit = 30,
  }) async {
    final response = await _api.dio.get(
      '/users/$userId/videos',
      queryParameters: {
        'limit': limit,
        'type': type,
        if (sort != 'newest') 'sort': sort,
      },
    );
    final list = response.data['data']['data'] as List<dynamic>? ?? [];
    return list.map((e) => VideoModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Map<String, dynamic>>> getUserPlaylists(String userId) async {
    final response = await _api.dio.get('/users/$userId/playlists');
    final data = response.data['data'];
    if (data is List) {
      return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    if (data is Map && data['data'] is List) {
      return (data['data'] as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return [];
  }

  // ── Privacy ───────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>?> getPrivacy() async {
    final privacy = await _api.dio.get('/users/me/privacy');
    return privacy.data['data'] as Map<String, dynamic>?;
  }

  Future<void> updatePrivacy({required bool watchHistoryPaused}) async {
    await _api.dio.put('/users/me/privacy', data: {'watchHistoryPaused': watchHistoryPaused});
  }

  // ── Channel image (avatar / banner) ───────────────────────────────────────

  /// Presign → PUT bytes → complete. Returns the public URL.
  Future<String> uploadChannelImage({
    required String userId,
    required bool banner,
    required String contentType,
    required Uint8List bytes,
  }) async {
    final path = banner ? 'banner-upload-url' : 'avatar-upload-url';
    final presign = await _api.dio.post(
      '/users/$userId/$path',
      data: {'contentType': contentType, 'fileSizeBytes': bytes.length},
    );
    final data = presign.data['data'] as Map<String, dynamic>;
    final uploadUrl = data['uploadUrl'] as String;
    final publicUrl = data['publicUrl'] as String;
    final key = data['key'] as String;
    await _api.dio.put(
      uploadUrl,
      data: bytes,
      options: Options(
        headers: {'Content-Type': contentType},
        contentType: contentType,
      ),
    );
    final completePath = banner ? 'banner-upload-complete' : 'avatar-upload-complete';
    await _api.dio.post('/users/$userId/$completePath', data: {'key': key});
    return publicUrl;
  }

  // ── Followers / subscriptions ─────────────────────────────────────────────

  Future<ProfileCursorPage> listChannelFollowGraph(
    String userId, {
    required bool following,
    String? cursor,
    int limit = 30,
  }) async {
    final path = following ? '/channels/$userId/subscriptions' : '/channels/$userId/subscribers';
    final params = <String, dynamic>{'limit': limit};
    if (cursor != null) params['cursor'] = cursor;
    final res = await _api.dio.get(path, queryParameters: params);
    final payload = res.data['data'] as Map<String, dynamic>;
    final data = payload['data'] as List<dynamic>? ?? [];
    final meta = payload['meta'] as Map<String, dynamic>? ?? {};
    return ProfileCursorPage(
      items: data,
      nextCursor: meta['cursor'] as String?,
      hasMore: meta['hasMore'] == true,
    );
  }

  Future<String> getSubscriptionNotifyLevel(String channelId) async {
    final res = await _api.dio.get('/channels/$channelId/subscription');
    return res.data['data']?['notifyLevel'] as String? ?? 'all';
  }

  Future<void> setSubscriptionNotifyLevel(String channelId, String level) async {
    await _api.dio.patch(
      '/channels/$channelId/subscription/notify',
      data: {'notifyLevel': level},
    );
  }

  Future<void> subscribe(String channelId) async {
    await _api.dio.post('/channels/$channelId/subscribe');
  }

  Future<void> unsubscribe(String channelId) async {
    await _api.dio.delete('/channels/$channelId/subscribe');
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> listSessions() async {
    final res = await _api.dio.get('/auth/sessions');
    return (res.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<void> revokeSession(String sessionId) async {
    await _api.dio.delete('/auth/sessions/$sessionId');
  }

  // ── Interests ─────────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> listCategories() async {
    final res = await _api.dio.get('/categories');
    final cats = (res.data['data'] as List?) ?? [];
    return cats.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<List<String>> getInterestCategoryIds() async {
    final res = await _api.dio.get('/users/me/interests');
    final payload = res.data['data'];
    if (payload is Map) {
      return ((payload['categoryIds'] as List?) ?? []).whereType<String>().toList();
    }
    return [];
  }

  Future<void> setInterests(List<String> categoryIds) async {
    await _api.dio.put('/users/me/interests', data: {'categoryIds': categoryIds});
  }

  // ── Memberships / billing ─────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> listMySubscriptions() async {
    final response = await _api.dio.get('/subscriptions/me');
    return (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<List<Map<String, dynamic>>> getCreatorTiers(String creatorId) async {
    final response = await _api.dio.get('/creators/$creatorId/tiers');
    return (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<Map<String, dynamic>?> getMyMembership(String creatorId) async {
    final response = await _api.dio.get('/creators/$creatorId/membership/me');
    return response.data['data'] as Map<String, dynamic>?;
  }

  Future<String?> createBillingPortal({required String returnUrl}) async {
    final response = await _api.dio.post('/billing/portal', data: {
      'returnUrl': returnUrl,
    });
    return response.data['data']?['url'] as String?;
  }

  Future<void> cancelSubscription(
    String creatorId, {
    bool cancelAtPeriodEnd = false,
  }) async {
    await _api.dio.delete(
      '/subscriptions/me/$creatorId',
      queryParameters: cancelAtPeriodEnd ? {'cancelAtPeriodEnd': true} : null,
    );
  }

  Future<void> changeSubscriptionTier({
    required String creatorId,
    required String tierId,
  }) async {
    await _api.dio.post('/billing/subscriptions/change-tier', data: {
      'creatorId': creatorId,
      'tierId': tierId,
    });
  }

  Future<String?> createCheckout({
    required String creatorId,
    required String tierId,
    String? communityId,
    required String successUrl,
    required String cancelUrl,
  }) async {
    final response = await _api.dio.post('/billing/checkout', data: {
      'creatorId': creatorId,
      'tierId': tierId,
      if (communityId != null) 'communityId': communityId,
      'successUrl': successUrl,
      'cancelUrl': cancelUrl,
    });
    return response.data['data']?['checkoutUrl'] as String?;
  }

  Future<void> mockJoinSubscription({
    required String creatorId,
    required String tierId,
  }) async {
    await _api.dio.post('/subscriptions/mock', data: {
      'creatorId': creatorId,
      'tierId': tierId,
    });
  }

  // ── Channel community posts ───────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> listChannelPosts(
    String creatorId, {
    int limit = 20,
  }) async {
    final res = await _api.dio.get(
      '/creators/$creatorId/channel-posts',
      queryParameters: {'limit': limit},
    );
    final root = res.data['data'];
    final list = root is Map ? root['data'] : root;
    if (list is! List) return [];
    return list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<String> uploadChannelPostMedia({
    required String filePath,
    required String contentType,
  }) async {
    final presign = await _api.dio.post(
      '/creators/me/channel-posts/media-upload-url',
      queryParameters: {'contentType': contentType},
    );
    final data = presign.data['data'] as Map<String, dynamic>;
    final uploadUrl = data['uploadUrl'] as String;
    final publicUrl = data['publicUrl'] as String;
    final put = await createS3UploadDio().put(
      uploadUrl,
      data: await File(filePath).readAsBytes(),
      options: Options(
        headers: {'Content-Type': contentType},
        sendTimeout: const Duration(minutes: 2),
        receiveTimeout: const Duration(minutes: 2),
      ),
    );
    if (put.statusCode == null || put.statusCode! < 200 || put.statusCode! >= 300) {
      throw StateError('Upload failed');
    }
    return publicUrl;
  }

  Future<void> createChannelPost({
    required String body,
    List<String>? mediaUrls,
  }) async {
    await _api.dio.post('/creators/me/channel-posts', data: {
      'body': body,
      if (mediaUrls != null && mediaUrls.isNotEmpty) 'mediaUrls': mediaUrls,
    });
  }

  Future<void> togglePostReaction({
    required String communityId,
    required String postId,
  }) async {
    await _api.dio.post('/communities/$communityId/posts/$postId/reactions');
  }

  Future<void> pinChannelPost({
    required String communityId,
    required String postId,
    required bool isPinned,
  }) async {
    await _api.dio.post(
      '/creators/me/communities/$communityId/posts/$postId/pin',
      data: {'isPinned': isPinned},
    );
  }

  Future<void> deleteChannelPost({
    required String communityId,
    required String postId,
  }) async {
    await _api.dio.delete('/creators/me/communities/$communityId/posts/$postId');
  }

  Future<List<Map<String, dynamic>>> listPostComments({
    required String communityId,
    required String postId,
  }) async {
    final res = await _api.dio.get(
      '/communities/$communityId/posts/$postId/comments',
    );
    final root = res.data['data'];
    final list = root is Map ? root['data'] : root;
    if (list is! List) return [];
    return list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<void> createPostComment({
    required String communityId,
    required String postId,
    required String body,
    String? parentId,
  }) async {
    await _api.dio.post(
      '/communities/$communityId/posts/$postId/comments',
      data: {
        'body': body,
        if (parentId != null) 'parentId': parentId,
      },
    );
  }

  // ── Strikes / copyright ───────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getMyStrikes() async {
    final res = await _api.dio.get('/users/me/strikes');
    final data = res.data['data'];
    if (data is List) {
      return data.cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<Map<String, dynamic>> getCopyrightNotice(String noticeId) async {
    final res = await _api.dio.get('/copyright/notices/$noticeId');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> appealStrike(String strikeId, String reason) async {
    await _api.dio.post('/account-strikes/$strikeId/appeal', data: {'reason': reason});
  }

  Future<void> fileCounterNotice(
    String noticeId, {
    required String contactInfo,
    required bool goodFaith,
    required bool jurisdiction,
    required String signature,
  }) async {
    await _api.dio.post(
      '/copyright/notices/$noticeId/counter-notice',
      data: {
        'contactInfo': contactInfo,
        'goodFaithMistakeStatement': goodFaith,
        'consentToJurisdiction': jurisdiction,
        'signature': signature,
      },
    );
  }
}
