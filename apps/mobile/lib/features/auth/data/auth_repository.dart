import 'package:dio/dio.dart';
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

  Future<void> _saveTokens(Map<String, dynamic> data) async {
    await _storage.write(key: AppConstants.accessTokenKey, value: data['accessToken'] as String);
    await _storage.write(key: AppConstants.refreshTokenKey, value: data['refreshToken'] as String);
  }
}
