import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/router/app_router.dart';

void main() {
  // Exercises the REAL protectedRoutes list from app_router.dart (HIGH-09) —
  // unlike the old version of this test, removing a route here now makes
  // this test fail instead of silently passing against a stale local copy.
  test('protected routes include library and the profile settings sub-path', () {
    expect(protectedRoutes, contains('/library'));
    expect(protectedRoutes, contains('/profile/settings'));
  });

  group('resolveRedirect', () {
    test('sends an unauthenticated user to /login with a next= redirect for a protected route', () async {
      final result = await resolveRedirect(
        path: '/library',
        hasSession: false,
        onboardingDone: true,
      );
      expect(result, '/login?next=%2Flibrary');
    });

    test('lets an unauthenticated user through to a public route', () async {
      final result = await resolveRedirect(
        path: '/feed',
        hasSession: false,
        onboardingDone: true,
      );
      expect(result, isNull);
    });

    test('sends a signed-in user who has not onboarded to /onboarding', () async {
      final result = await resolveRedirect(
        path: '/feed',
        hasSession: true,
        onboardingDone: false,
      );
      expect(result, '/onboarding');
    });

    test('does not force onboarding on onboarding-exempt routes even without completing it', () async {
      final result = await resolveRedirect(
        path: '/verify-email',
        hasSession: true,
        onboardingDone: false,
      );
      expect(result, isNull);
    });

    test('lets a signed-in, onboarded user through to a protected route', () async {
      final result = await resolveRedirect(
        path: '/history',
        hasSession: true,
        onboardingDone: true,
      );
      expect(result, isNull);
    });

    test('matches protected routes by prefix (nested paths), not exact match only', () async {
      final result = await resolveRedirect(
        path: '/profile/settings/notifications',
        hasSession: false,
        onboardingDone: true,
      );
      expect(result, isNotNull);
      expect(result, startsWith('/login'));
    });

    test('lets an unauthenticated user view a public channel page (parity with web)', () async {
      final result = await resolveRedirect(
        path: '/profile/some-creator',
        hasSession: false,
        onboardingDone: true,
      );
      expect(result, isNull);
    });

    test('lets an unauthenticated user view a public playlist by id (parity with web)', () async {
      final result = await resolveRedirect(
        path: '/playlists/abc-123',
        hasSession: false,
        onboardingDone: true,
      );
      expect(result, isNull);
    });

    test('sends an unauthenticated user to /login for their own playlists home (exact match)', () async {
      final result = await resolveRedirect(
        path: '/playlists',
        hasSession: false,
        onboardingDone: true,
      );
      expect(result, isNotNull);
      expect(result, startsWith('/login'));
    });

    test('sends an unauthenticated user to /login for owned system playlists', () async {
      final result = await resolveRedirect(
        path: '/playlists/me/liked',
        hasSession: false,
        onboardingDone: true,
      );
      expect(result, isNotNull);
      expect(result, startsWith('/login'));
    });
  });
}
