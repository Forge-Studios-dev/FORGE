import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import '../constants/app_constants.dart';
import '../router/navigation_key.dart';
import '../socket/forge_socket.dart';
import 'certificate_pinning.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

class ApiClient {
  late final Dio _dio;
  final FlutterSecureStorage _storage;
  final Dio Function() _createRefreshDio;
  Future<bool>? _refreshInFlight;

  /// [dio], [storage], and [createRefreshDio] are test seams (HIGH-09) — real
  /// callers never pass them, so production behavior is unchanged.
  ApiClient({Dio? dio, FlutterSecureStorage? storage, Dio Function()? createRefreshDio})
      : _storage = storage ?? const FlutterSecureStorage(),
        _createRefreshDio = createRefreshDio ?? (() => Dio()) {
    _dio = dio ??
        Dio(
          BaseOptions(
            baseUrl: AppConstants.apiBaseUrl,
            connectTimeout: AppConstants.connectionTimeout,
            receiveTimeout: AppConstants.receiveTimeout,
            headers: {'Content-Type': 'application/json'},
          ),
        );
    applyCertificatePinning(_dio);

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: AppConstants.accessTokenKey);
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            final refreshed = await _refreshTokens();
            if (refreshed) {
              final token = await _storage.read(key: AppConstants.accessTokenKey);
              error.requestOptions.headers['Authorization'] = 'Bearer $token';
              final retryResponse = await _dio.fetch(error.requestOptions);
              return handler.resolve(retryResponse);
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  /// Multiple requests can 401 at once (e.g. app resumes with an expired
  /// access token and several screens fire calls together). The backend's
  /// refresh tokens are single-use with reuse-detection that revokes *every*
  /// session on the account — so if each request independently posted the
  /// same refresh token, only the first would succeed and every other would
  /// look like theft, force-logging the user out everywhere. Collapsing
  /// concurrent callers onto one in-flight refresh keeps that from happening.
  Future<bool> _refreshTokens() {
    return _refreshInFlight ??= _performRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<bool> _performRefresh() async {
    try {
      final refreshToken = await _storage.read(key: AppConstants.refreshTokenKey);
      if (refreshToken == null) return false;

      // Deliberately a separate Dio instance (not _dio): reusing _dio here
      // would let a 401 on /auth/refresh itself re-trigger this same
      // interceptor recursively. Still pinned — this call carries the
      // refresh token, so it needs the same TLS protection as everything else.
      final refreshDio = _createRefreshDio();
      applyCertificatePinning(refreshDio);
      final response = await refreshDio.post(
        '${AppConstants.apiBaseUrl}/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = response.data['data'] as Map<String, dynamic>;
      await _storage.write(key: AppConstants.accessTokenKey, value: data['accessToken'] as String);
      await _storage.write(key: AppConstants.refreshTokenKey, value: data['refreshToken'] as String);
      final user = data['user'];
      if (user is Map<String, dynamic>) {
        await _storage.write(key: AppConstants.userKey, value: jsonEncode(user));
      }
      return true;
    } catch (_) {
      await _storage.deleteAll();
      // Forced logout bypasses AuthRepository.logout() — the realtime socket
      // must be torn down here too, or a same-process login as a different
      // user would reuse it still handshake-authenticated as this session.
      ForgeSocket.disconnect();
      final ctx = rootNavigatorKey.currentContext;
      if (ctx != null && ctx.mounted) {
        GoRouter.of(ctx).go('/login');
      }
      return false;
    }
  }

  Dio get dio => _dio;
}
