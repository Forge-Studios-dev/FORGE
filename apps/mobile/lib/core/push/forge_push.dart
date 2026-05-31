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

  Future<void> registerIfConfigured() async {
    if (_started || kIsWeb) return;
    try {
      if (Firebase.apps.isEmpty) return;
      _started = true;
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token == null || token.isEmpty) return;
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _apiClient.dio.post('/notifications/devices/register', data: {
        'platform': platform,
        'fcmToken': token,
      });
      messaging.onTokenRefresh.listen((newToken) async {
        try {
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
}
