import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/network/api_client.dart';
import '../../../core/constants/app_constants.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.read(apiClientProvider));
});

class AuthRepository {
  final ApiClient _apiClient;
  final _storage = const FlutterSecureStorage();

  AuthRepository(this._apiClient);

  Future<Map<String, dynamic>> login({required String email, required String password}) async {
    final response = await _apiClient.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    final data = response.data['data'] as Map<String, dynamic>;
    await _saveTokens(data);
    return data;
  }

  Future<Map<String, dynamic>> signup({
    required String email,
    required String username,
    required String displayName,
    required String password,
  }) async {
    final response = await _apiClient.dio.post('/auth/signup', data: {
      'email': email,
      'username': username,
      'displayName': displayName,
      'password': password,
    });
    final data = response.data['data'] as Map<String, dynamic>;
    await _saveTokens(data);
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

  Future<void> logout() async {
    try {
      await _apiClient.dio.post('/auth/logout');
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

  Future<void> _saveTokens(Map<String, dynamic> data) async {
    await _storage.write(key: AppConstants.accessTokenKey, value: data['accessToken'] as String);
    await _storage.write(key: AppConstants.refreshTokenKey, value: data['refreshToken'] as String);
    final user = data['user'];
    if (user is Map<String, dynamic>) {
      await _storage.write(key: AppConstants.userKey, value: jsonEncode(user));
    }
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
