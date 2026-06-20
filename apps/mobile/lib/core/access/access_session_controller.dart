import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/api_client.dart';

class AccessSessionController {
  AccessSessionController(this._client);

  final ApiClient _client;
  String? _sessionToken;
  Timer? _heartbeat;

  Future<bool> start({
    required String sessionType,
    required String resourceId,
    bool force = false,
  }) async {
    try {
      final res = await _client.dio.post('/access-sessions/start', data: {
        'sessionType': sessionType,
        'resourceId': resourceId,
        if (force) 'force': true,
      });
      final data = res.data['data'] as Map<String, dynamic>;
      _sessionToken = data['sessionToken'] as String?;
      final interval = (data['heartbeatIntervalSec'] as num?)?.toInt() ?? 45;
      _heartbeat?.cancel();
      if (_sessionToken != null) {
        _heartbeat = Timer.periodic(Duration(seconds: interval), (_) async {
          try {
            await _client.dio.post('/access-sessions/heartbeat', data: {
              'sessionToken': _sessionToken,
            });
          } catch (_) {}
        });
      }
      return true;
    } catch (e) {
      final code = _errorCode(e);
      if (code == 'concurrent_session' && !force) return false;
      if (force) {
        return start(sessionType: sessionType, resourceId: resourceId, force: true);
      }
      rethrow;
    }
  }

  String? _errorCode(Object e) {
    if (e is! Exception) return null;
    try {
      // DioException shape — best effort
      final dynamic err = e;
      return err.response?.data?['code'] as String?;
    } catch (_) {
      return null;
    }
  }

  Future<void> end() async {
    _heartbeat?.cancel();
    _heartbeat = null;
    final token = _sessionToken;
    _sessionToken = null;
    if (token != null) {
      try {
        await _client.dio.delete('/access-sessions/current', data: {'sessionToken': token});
      } catch (_) {}
    }
  }
}

final accessSessionControllerProvider = Provider<AccessSessionController>((ref) {
  return AccessSessionController(ref.read(apiClientProvider));
});
