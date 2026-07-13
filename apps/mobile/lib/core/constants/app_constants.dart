import 'package:flutter/foundation.dart';

class AppConstants {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001/api/v1',
  );

  static const String webBaseUrl = String.fromEnvironment(
    'WEB_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  /// Fail closed instead of silently shipping a release build pointed at
  /// localhost (LOW-13). Call once, at the very top of main(), before
  /// anything else touches the network.
  static void assertValidForRelease() {
    if (!kReleaseMode) return;
    if (!apiBaseUrl.startsWith('https://')) {
      throw StateError(
        'AppConstants.apiBaseUrl is "$apiBaseUrl" in a release build — '
        'build with --dart-define=API_BASE_URL=https://<production-api> instead.',
      );
    }
  }

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
