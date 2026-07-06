class AppConstants {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001/api/v1',
  );

  static const String webBaseUrl = String.fromEnvironment(
    'WEB_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  static const String accessTokenKey = 'forge_access_token';
  static const String refreshTokenKey = 'forge_refresh_token';
  static const String sessionIdKey = 'forge_session_id';
  static const String userKey = 'forge_user';
  static const String onboardingCompleteKey = 'forge_onboarding_complete';
  static const String onboardingInterestsKey = 'forge_onboarding_interests';
  static const String pendingUploadKey = 'forge_pending_upload';

  static const Duration connectionTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);

  static const int feedPageSize = 15;
  static const int commentsPageSize = 20;
}
