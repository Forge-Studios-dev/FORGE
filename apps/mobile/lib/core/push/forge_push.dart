import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../network/api_client.dart';

/// Registers FCM token with API after Firebase is configured (`flutterfire configure`).
class ForgePush {
  ForgePush(this._apiClient);

  final ApiClient _apiClient;
  bool _started = false;
  String? _token;

  Future<void> registerIfConfigured() async {
    if (_started || kIsWeb) return;
    try {
      if (Firebase.apps.isEmpty) return;
      _started = true;
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token == null || token.isEmpty) return;
      _token = token;
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _apiClient.dio.post('/notifications/devices/register', data: {
        'platform': platform,
        'fcmToken': token,
      });
      messaging.onTokenRefresh.listen((newToken) async {
        try {
          _token = newToken;
          await _apiClient.dio.post('/notifications/devices/register', data: {
            'platform': platform,
            'fcmToken': newToken,
          });
        } catch (_) {}
      });
    } catch (_) {
      _started = false;
    }
  }

  /// Revoke this device's push token on sign-out so a logged-out (or re-assigned)
  /// device no longer receives the previous user's notifications. Best-effort:
  /// the server also prunes invalid tokens on send. Resets state so a subsequent
  /// login re-registers (otherwise `_started` would block re-registration).
  Future<void> deregister({bool allDevices = false}) async {
    if (kIsWeb) return;
    try {
      if (allDevices) {
        await _apiClient.dio.delete('/notifications/devices');
      } else {
        final token = _token ?? await _currentToken();
        if (token != null && token.isNotEmpty) {
          await _apiClient.dio
              .delete('/notifications/devices', queryParameters: {'fcmToken': token});
        }
      }
    } catch (_) {
      // best-effort
    } finally {
      _token = null;
      _started = false;
    }
  }

  Future<String?> _currentToken() async {
    try {
      if (Firebase.apps.isEmpty) return null;
      return await FirebaseMessaging.instance.getToken();
    } catch (_) {
      return null;
    }
  }
}
