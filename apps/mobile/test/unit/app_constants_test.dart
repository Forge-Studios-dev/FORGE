import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/constants/app_constants.dart';

void main() {
  group('AppConstants', () {
    test('storage keys are unique', () {
      final keys = {
        AppConstants.accessTokenKey,
        AppConstants.refreshTokenKey,
        AppConstants.sessionIdKey,
        AppConstants.userKey,
      };
      expect(keys.length, 4);
    });

    test('storage keys are non-empty', () {
      expect(AppConstants.accessTokenKey, isNotEmpty);
      expect(AppConstants.refreshTokenKey, isNotEmpty);
      expect(AppConstants.sessionIdKey, isNotEmpty);
      expect(AppConstants.userKey, isNotEmpty);
    });

    test('feedPageSize is reasonable', () {
      expect(AppConstants.feedPageSize, greaterThan(0));
      expect(AppConstants.feedPageSize, lessThanOrEqualTo(50));
    });

    test('commentsPageSize is reasonable', () {
      expect(AppConstants.commentsPageSize, greaterThan(0));
      expect(AppConstants.commentsPageSize, lessThanOrEqualTo(100));
    });

    test('default apiBaseUrl points to localhost', () {
      expect(AppConstants.apiBaseUrl, contains('localhost'));
    });

    test('connection timeouts are positive', () {
      expect(AppConstants.connectionTimeout.inSeconds, greaterThan(0));
      expect(AppConstants.receiveTimeout.inSeconds, greaterThan(0));
    });

    // kReleaseMode is always false under `flutter test`, so this only exercises
    // the debug-mode no-op path; the release-mode throw (LOW-13) is exercised
    // by actually building with --release and a non-https API_BASE_URL.
    test('assertValidForRelease is a no-op outside release mode', () {
      expect(AppConstants.assertValidForRelease, returnsNormally);
    });
  });
}
