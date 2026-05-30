class AppConstants {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001/api/v1',
  );

  static const String accessTokenKey = 'forge_access_token';
  static const String refreshTokenKey = 'forge_refresh_token';
  static const String sessionIdKey = 'forge_session_id';
  static const String userKey = 'forge_user';

  static const Duration connectionTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);

  static const int feedPageSize = 15;
  static const int commentsPageSize = 20;
}
