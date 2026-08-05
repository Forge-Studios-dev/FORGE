import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/analytics/forge_analytics.dart';
import '../../../core/app_check/forge_app_check.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/push/forge_push.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final api = ref.read(apiClientProvider);
  return AuthRepository(api, ForgeAnalytics(api.dio), ForgePush(api));
});

class AuthRepository {
  final ApiClient _apiClient;
  final ForgeAnalytics _analytics;
  final ForgePush _push;
  final _storage = const FlutterSecureStorage();

  AuthRepository(this._apiClient, this._analytics, this._push);

  Future<Map<String, dynamic>> login({required String email, required String password}) async {
    final appCheck = await getForgeAppCheckToken();
    final response = await _apiClient.dio.post(
      '/auth/login',
      data: {'email': email, 'password': password},
      options: appCheck != null
          ? Options(headers: {'X-Firebase-AppCheck': appCheck})
          : null,
    );
    final data = response.data['data'] as Map<String, dynamic>;
    await _saveTokens(data, analyticsEvent: 'auth.login', analyticsProps: {'method': 'email'});
    return data;
  }

  Future<Map<String, dynamic>> signup({
    required String email,
    required String username,
    required String displayName,
    required String password,
  }) async {
    final appCheck = await getForgeAppCheckToken();
    final response = await _apiClient.dio.post(
      '/auth/signup',
      data: {
        'email': email,
        'username': username,
        'displayName': displayName,
        'password': password,
      },
      options: appCheck != null
          ? Options(headers: {'X-Firebase-AppCheck': appCheck})
          : null,
    );
    final data = response.data['data'] as Map<String, dynamic>;
    await _saveTokens(data, analyticsEvent: 'auth.signup', analyticsProps: {'method': 'email'});
    return data;
  }

  Future<void> forgotPassword({required String email}) async {
    await _apiClient.dio.post('/auth/forgot-password', data: {
      'email': email.trim().toLowerCase(),
    });
  }

  Future<void> resetPassword({required String token, required String password}) async {
    await _apiClient.dio.post('/auth/reset-password', data: {
      'token': token,
      'password': password,
    });
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _apiClient.dio.post('/auth/change-password', data: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  Future<void> logout({bool allDevices = false}) async {
    // Revoke the push token while the access token is still valid (before the
    // session is invalidated server-side), so the device stops receiving pushes.
    await _push.deregister(allDevices: allDevices);
    try {
      await _apiClient.dio.post('/auth/logout', data: {'allDevices': allDevices});
    } catch (_) {}
    await _storage.deleteAll();
  }

  Future<bool> isLoggedIn() async {
    final token = await _storage.read(key: AppConstants.accessTokenKey);
    return token != null;
  }

  Future<void> resendVerificationEmail() async {
    await _apiClient.dio.post('/auth/verify-email/resend');
  }

  Future<Map<String, dynamic>> requestCreator({String? bio}) async {
    final response = await _apiClient.dio.post(
      '/users/me/request-creator',
      data: bio != null && bio.trim().isNotEmpty ? {'bio': bio.trim()} : {},
    );
    final userData = response.data['data'] as Map<String, dynamic>;
    await persistUser(userData);
    return userData;
  }

  Future<void> persistUser(Map<String, dynamic> user) async {
    await _storage.write(key: AppConstants.userKey, value: jsonEncode(user));
  }

  Future<Map<String, dynamic>?> refreshStoredUser() async {
    try {
      final response = await _apiClient.dio.get('/users/me');
      final userData = response.data['data'] as Map<String, dynamic>;
      await persistUser(userData);
      return userData;
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveTokens(
    Map<String, dynamic> data, {
    String? analyticsEvent,
    Map<String, dynamic>? analyticsProps,
  }) async {
    await _storage.write(key: AppConstants.accessTokenKey, value: data['accessToken'] as String);
    await _storage.write(key: AppConstants.refreshTokenKey, value: data['refreshToken'] as String);
    final sessionId = data['sessionId'];
    if (sessionId is String) {
      await _storage.write(key: AppConstants.sessionIdKey, value: sessionId);
    }
    final user = data['user'];
    if (user is Map<String, dynamic>) {
      await _storage.write(key: AppConstants.userKey, value: jsonEncode(user));
    }
    final accessToken = data['accessToken'] as String?;
    if (analyticsEvent != null) {
      await _analytics.track(
        analyticsEvent,
        properties: analyticsProps,
        accessToken: accessToken,
      );
    }
    await _push.registerIfConfigured();
  }

  Future<Map<String, dynamic>?> getStoredUser() async {
    final raw = await _storage.read(key: AppConstants.userKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }
}
