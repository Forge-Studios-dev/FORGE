import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) {
  return NotificationsRepository(ref.read(apiClientProvider));
});

class NotificationsPage {
  final List<dynamic> items;
  final String? nextCursor;
  final bool hasMore;

  const NotificationsPage({
    required this.items,
    this.nextCursor,
    required this.hasMore,
  });
}

class NotificationsRepository {
  final ApiClient _api;

  NotificationsRepository(this._api);

  Future<NotificationsPage> list({String? cursor, int limit = 30}) async {
    final params = <String, dynamic>{'limit': limit};
    if (cursor != null) params['cursor'] = cursor;
    final res = await _api.dio.get('/notifications', queryParameters: params);
    final payload = res.data['data'] as Map<String, dynamic>;
    final data = payload['data'] as List<dynamic>? ?? [];
    final meta = payload['meta'] as Map<String, dynamic>? ?? {};
    return NotificationsPage(
      items: data,
      nextCursor: meta['cursor'] as String?,
      hasMore: meta['hasMore'] == true,
    );
  }

  Future<void> markRead(String id) async {
    await _api.dio.post('/notifications/$id/read');
  }

  Future<void> markAllRead() async {
    await _api.dio.post('/notifications/read-all');
  }

  Future<int> getUnreadCount() async {
    final res = await _api.dio.get('/notifications/unread-count');
    final data = res.data['data'];
    if (data is Map) return (data['count'] as num?)?.toInt() ?? 0;
    if (data is num) return data.toInt();
    return 0;
  }
}
