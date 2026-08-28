import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final messagesRepositoryProvider = Provider<MessagesRepository>((ref) {
  return MessagesRepository(ref.read(apiClientProvider));
});

class MessagesRepository {
  final ApiClient _api;

  MessagesRepository(this._api);

  Future<List<dynamic>> listConversations() async {
    final res = await _api.dio.get('/messages/conversations');
    return res.data['data'] as List<dynamic>? ?? [];
  }

  Future<List<dynamic>> getMessages(String conversationId, {int limit = 50}) async {
    final res = await _api.dio.get(
      '/messages/conversations/$conversationId',
      queryParameters: {'limit': limit},
    );
    return res.data['data']['data'] as List<dynamic>? ?? [];
  }

  Future<void> markRead(String conversationId) async {
    await _api.dio.post('/messages/conversations/$conversationId/read');
  }

  Future<Map<String, dynamic>> sendMessage({
    required String recipientId,
    required String content,
  }) async {
    final res = await _api.dio.post('/messages', data: {
      'recipientId': recipientId,
      'content': content,
    });
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> searchUsers({
    required String q,
    int limit = 5,
  }) async {
    final res = await _api.dio.get(
      '/users/search',
      queryParameters: {'q': q, 'limit': limit},
    );
    final list = (res.data['data'] as List?) ?? [];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}
