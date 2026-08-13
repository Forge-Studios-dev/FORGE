import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/analytics/forge_analytics.dart';
import 'package:forge_mobile/core/constants/app_constants.dart';
import 'package:forge_mobile/core/network/api_client.dart';
import 'package:forge_mobile/core/push/forge_push.dart';
import 'package:forge_mobile/features/auth/data/auth_repository.dart';

import 'test_support/fakes.dart';

void main() {
  late Map<String, String> storageData;

  setUp(() {
    storageData = {};
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform(storageData);
  });

  AuthRepository buildRepository(QueuedAdapter adapter) {
    final dio = Dio(BaseOptions(baseUrl: AppConstants.apiBaseUrl))..httpClientAdapter = adapter;
    final apiClient = ApiClient(dio: dio, storage: const FlutterSecureStorage());
    return AuthRepository(apiClient, ForgeAnalytics(apiClient.dio), ForgePush(apiClient));
  }

  group('AuthRepository.login', () {
    test('persists access token, refresh token, session id, and user on success', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {
                'accessToken': 'access-1',
                'refreshToken': 'refresh-1',
                'sessionId': 'session-1',
                'user': {'id': 'u1', 'email': 'a@b.com'},
              },
            }, 200),
      ]);
      final repo = buildRepository(adapter);

      final result = await repo.login(email: 'a@b.com', password: 'pw');

      expect(result['accessToken'], 'access-1');
      expect(storageData[AppConstants.accessTokenKey], 'access-1');
      expect(storageData[AppConstants.refreshTokenKey], 'refresh-1');
      expect(storageData[AppConstants.sessionIdKey], 'session-1');
      expect(storageData[AppConstants.userKey], isNotNull);
    });

    test('returns the MFA challenge without persisting anything when the account has TOTP on', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {'mfaRequired': true, 'challengeToken': 'chal-1'},
            }, 200),
      ]);
      final repo = buildRepository(adapter);

      final result = await repo.login(email: 'a@b.com', password: 'pw');

      expect(result['mfaRequired'], true);
      expect(result['challengeToken'], 'chal-1');
      expect(storageData.containsKey(AppConstants.accessTokenKey), isFalse);
    });

    test('propagates the error and persists nothing when login fails', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({'message': 'invalid credentials'}, 401),
      ]);
      final repo = buildRepository(adapter);

      await expectLater(
        repo.login(email: 'a@b.com', password: 'wrong'),
        throwsA(isA<DioException>()),
      );

      expect(storageData.containsKey(AppConstants.accessTokenKey), isFalse);
    });
  });

  group('AuthRepository.completeMfaLogin', () {
    test('persists real tokens once the challenge code is verified', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {
                'accessToken': 'access-2',
                'refreshToken': 'refresh-2',
                'sessionId': 'session-2',
                'user': {'id': 'u1', 'email': 'a@b.com'},
              },
            }, 200),
      ]);
      final repo = buildRepository(adapter);

      final result = await repo.completeMfaLogin(challengeToken: 'chal-1', code: '123456');

      expect(result['accessToken'], 'access-2');
      expect(storageData[AppConstants.accessTokenKey], 'access-2');
    });

    test('propagates the error and persists nothing for an invalid code', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({'message': 'Invalid verification code'}, 401),
      ]);
      final repo = buildRepository(adapter);

      await expectLater(
        repo.completeMfaLogin(challengeToken: 'chal-1', code: '000000'),
        throwsA(isA<DioException>()),
      );
      expect(storageData.containsKey(AppConstants.accessTokenKey), isFalse);
    });
  });

  group('AuthRepository.getMfaStatus', () {
    test('reflects the enabled flag from the API', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({'data': {'enabled': true}}, 200),
      ]);
      final repo = buildRepository(adapter);

      expect(await repo.getMfaStatus(), isTrue);
    });
  });

  group('AuthRepository.logout', () {
    test('clears all stored auth state even when the API call fails', () async {
      storageData[AppConstants.accessTokenKey] = 'access-1';
      storageData[AppConstants.refreshTokenKey] = 'refresh-1';
      storageData[AppConstants.userKey] = '{"id":"u1"}';
      // No queued response — logout POST fails; AuthRepository swallows that (best-effort)
      // but must still clear local storage so the device ends up signed out.
      final adapter = QueuedAdapter([]);
      final repo = buildRepository(adapter);

      await repo.logout();

      expect(storageData, isEmpty);
    });
  });

  group('AuthRepository.isLoggedIn', () {
    test('is false with no stored token and true once one is stored', () async {
      final repo = buildRepository(QueuedAdapter([]));

      expect(await repo.isLoggedIn(), isFalse);

      storageData[AppConstants.accessTokenKey] = 'access-1';
      expect(await repo.isLoggedIn(), isTrue);
    });
  });

  group('AuthRepository.getStoredUser / persistUser', () {
    test('round-trips a user through storage', () async {
      final repo = buildRepository(QueuedAdapter([]));

      expect(await repo.getStoredUser(), isNull);

      await repo.persistUser({'id': 'u1', 'displayName': 'Ada'});
      final stored = await repo.getStoredUser();

      expect(stored?['id'], 'u1');
      expect(stored?['displayName'], 'Ada');
    });

    test('returns null instead of throwing on corrupted stored JSON', () async {
      storageData[AppConstants.userKey] = 'not-json{{{';
      final repo = buildRepository(QueuedAdapter([]));

      expect(await repo.getStoredUser(), isNull);
    });
  });

  group('AuthRepository.refreshStoredUser', () {
    test('persists and returns the fetched user on success', () async {
      final adapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {'id': 'u1', 'displayName': 'Ada Updated'},
            }, 200),
      ]);
      final repo = buildRepository(adapter);

      final user = await repo.refreshStoredUser();

      expect(user?['displayName'], 'Ada Updated');
      expect(storageData[AppConstants.userKey], contains('Ada Updated'));
    });

    test('returns null and leaves storage untouched when the request fails', () async {
      storageData[AppConstants.userKey] = '{"id":"stale"}';
      final adapter = QueuedAdapter([(_) => jsonResponseBody({'message': 'error'}, 500)]);
      final repo = buildRepository(adapter);

      final user = await repo.refreshStoredUser();

      expect(user, isNull);
      expect(storageData[AppConstants.userKey], contains('stale'));
    });
  });
}
