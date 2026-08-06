import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../network/api_client.dart';
import '../notifications/notification_href.dart';
import '../router/navigation_key.dart';

/// Route to open when a push notification is tapped, based on the `data.type`
/// the backend sends (see apps/api notifications.listener.ts). Falls back to
/// the notifications list for types with no dedicated screen.
String _routeForMessage(RemoteMessage message) {
  final data = message.data;
  final type = data['type']?.toString();
  final href = notificationHref(type, Map<String, dynamic>.from(data));
  return href ?? '/notifications';
}

void _handleNotificationTap(RemoteMessage message) {
  final ctx = rootNavigatorKey.currentContext;
  if (ctx == null || !ctx.mounted) return;
  GoRouter.of(ctx).push(_routeForMessage(message));
}

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
      _bindMessageHandlers();
    } catch (_) {
      _started = false;
    }
  }

  bool _handlersBound = false;

  /// Foreground messages don't auto-display a system banner (only
  /// background/terminated ones do) — show an in-app SnackBar instead, and
  /// wire tap-to-navigate for both the foreground and cold-start cases.
  void _bindMessageHandlers() {
    if (_handlersBound) return;
    _handlersBound = true;

    FirebaseMessaging.onMessage.listen((message) {
      final title = message.notification?.title;
      final body = message.notification?.body;
      if (title == null && body == null) return;
      final ctx = rootNavigatorKey.currentContext;
      if (ctx == null || !ctx.mounted) return;
      ScaffoldMessenger.of(ctx).showSnackBar(
        SnackBar(
          content: Text([title, body].whereType<String>().join(': ')),
          action: SnackBarAction(label: 'View', onPressed: () => _handleNotificationTap(message)),
        ),
      );
    });

    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message != null) _handleNotificationTap(message);
    });
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

/// Background/terminated-state message handler. Must be a top-level function
/// (Dart isolate entry-point requirement) and is registered in main.dart
/// before runApp. No UI work here — the OS already shows the system
/// notification for messages with a `notification` payload; this isolate is
/// only for data-only background processing, which FORGE doesn't need yet.
@pragma('vm:entry-point')
Future<void> forgePushBackgroundHandler(RemoteMessage message) async {}
