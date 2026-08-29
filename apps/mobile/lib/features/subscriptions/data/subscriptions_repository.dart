import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final subscriptionsRepositoryProvider = Provider<SubscriptionsRepository>((ref) {
  return SubscriptionsRepository(ref.read(apiClientProvider));
});

class SubscriptionChannelsPage {
  final String? username;
  final List<Map<String, dynamic>> channels;

  const SubscriptionChannelsPage({
    this.username,
    required this.channels,
  });
}

class SubscriptionsRepository {
  final ApiClient _api;

  SubscriptionsRepository(this._api);

  /// Current user's subscribed channels (for the Subscriptions shelf chips).
  /// Returns null when `/users/me` has no id (same early-exit as before).
  Future<SubscriptionChannelsPage?> listMySubscriptionChannels({
    int limit = 40,
  }) async {
    final me = await _api.dio.get('/users/me');
    final meData = me.data['data'] as Map?;
    final meId = meData?['id'] as String?;
    final username = meData?['username'] as String?;
    if (meId == null) return null;
    final res = await _api.dio.get(
      '/channels/$meId/subscriptions',
      queryParameters: {'limit': limit},
    );
    final payload = res.data['data'];
    final list = payload is Map
        ? (payload['data'] as List? ?? [])
        : (payload is List ? payload : []);
    return SubscriptionChannelsPage(
      username: username,
      channels: list
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList(),
    );
  }
}
