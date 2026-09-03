import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/observability/capture_error.dart';

final liveRepositoryProvider = Provider<LiveRepository>((ref) {
  return LiveRepository(ref.read(apiClientProvider));
});

/// Repository for live stream data. Presentation files should use this instead
/// of calling `apiClientProvider.dio` directly. This serves as the extraction
/// template for H-M1 (repo-pattern adoption across mobile features).
class LiveRepository {
  final ApiClient _api;
  LiveRepository(this._api);

  Future<Map<String, dynamic>> getStream(String streamId) async {
    final res = await _api.dio.get('/streams/$streamId');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>?> getReplay(String streamId) async {
    try {
      final res = await _api.dio.get('/streams/$streamId/replay');
      return res.data['data'] as Map<String, dynamic>?;
    } catch (e, st) {
      captureError(e, st, 'getReplay');
      return null;
    }
  }

  Future<Map<String, dynamic>?> getRsvp(String streamId) async {
    try {
      final res = await _api.dio.get('/streams/$streamId/rsvp');
      return res.data['data'] as Map<String, dynamic>?;
    } catch (e, st) {
      captureError(e, st, 'getRsvp');
      return null;
    }
  }

  Future<Map<String, dynamic>?> getStreamHealth(String streamId) async {
    try {
      final res = await _api.dio.get('/creators/me/streams/$streamId/health');
      return res.data['data'] as Map<String, dynamic>?;
    } catch (e, st) {
      captureError(e, st, 'getStreamHealth');
      return null;
    }
  }

  Future<Map<String, dynamic>> getReactionCounts(String streamId) async {
    try {
      final res = await _api.dio.get('/streams/$streamId/reactions');
      return (res.data['data'] as Map<String, dynamic>?) ?? {};
    } catch (e, st) {
      captureError(e, st, 'getReactionCounts');
      return {};
    }
  }

  Future<Map<String, dynamic>> getMe() async {
    final res = await _api.dio.get('/users/me');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> endStream(String streamId) async {
    await _api.dio.post('/streams/$streamId/end');
  }

  Future<List<Map<String, dynamic>>> listClips(String streamId) async {
    final res = await _api.dio.get('/streams/$streamId/clips');
    final data = res.data['data'];
    if (data is List) {
      return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  /// Mark a ~30s highlight at the current live moment (empty body = server offset).
  Future<Map<String, dynamic>> createClip(String streamId, {String? title}) async {
    final res = await _api.dio.post(
      '/streams/$streamId/clips',
      data: {
        if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
      },
    );
    return (res.data['data'] as Map<String, dynamic>?) ?? {};
  }

  /// Host: toggle chat on/off and who may send messages.
  Future<Map<String, dynamic>> updateChatSettings(
    String streamId, {
    bool? chatEnabled,
    String? chatMode,
  }) async {
    final res = await _api.dio.patch(
      '/streams/$streamId/chat/settings',
      data: {
        if (chatEnabled != null) 'chatEnabled': chatEnabled,
        if (chatMode != null) 'chatMode': chatMode,
      },
    );
    return (res.data['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<List<Map<String, dynamic>>> listModerators(String streamId) async {
    final res = await _api.dio.get('/streams/$streamId/moderators');
    final data = res.data['data'];
    if (data is List) {
      return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  Future<void> addModerator(String streamId, {required String username}) async {
    await _api.dio.post('/streams/$streamId/moderators', data: {'username': username});
  }

  Future<void> removeModerator(String streamId, String userId) async {
    await _api.dio.post('/streams/$streamId/moderators/$userId/remove');
  }

  /// Host: grant a viewer access to a paid event stream by username.
  Future<void> grantEventAccess(
    String streamId, {
    required String username,
    String? note,
  }) async {
    await _api.dio.post(
      '/streams/$streamId/grant-access',
      data: {
        'username': username,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
  }

  Future<void> raiseHand(String streamId) async {
    await _api.dio.post('/streams/$streamId/raise-hand');
  }

  Future<void> lowerHand(String streamId) async {
    await _api.dio.delete('/streams/$streamId/raise-hand');
  }

  Future<void> acknowledgeAge() async {
    await _api.dio.post('/users/me/mature-content/acknowledge');
  }

  Future<void> rsvp(String streamId) async {
    await _api.dio.post('/streams/$streamId/rsvp');
  }

  Future<void> cancelRsvp(String streamId) async {
    await _api.dio.post('/streams/$streamId/rsvp/cancel');
  }

  Future<List<Map<String, dynamic>>> getLiveStreams({String? creatorId}) async {
    final res = await _api.dio.get(
      '/streams/live',
      queryParameters: {
        if (creatorId != null && creatorId.isNotEmpty) 'creatorId': creatorId,
      },
    );
    final data = res.data['data'];
    if (data is List) {
      return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getUpcomingStreams({String? creatorId}) async {
    final res = await _api.dio.get(
      '/streams/upcoming',
      queryParameters: {
        if (creatorId != null && creatorId.isNotEmpty) 'creatorId': creatorId,
      },
    );
    final data = res.data['data'];
    if (data is List) {
      return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  /// Creator: start or schedule a live session (`POST /streams/start`).
  Future<Map<String, dynamic>> startStream(Map<String, dynamic> body) async {
    final res = await _api.dio.post('/streams/start', data: body);
    return (res.data['data'] as Map<String, dynamic>?) ?? {};
  }
}
