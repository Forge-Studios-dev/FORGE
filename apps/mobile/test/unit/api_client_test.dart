import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/constants/app_constants.dart';
import 'package:forge_mobile/core/network/api_client.dart';

import 'test_support/fakes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Map<String, String> storageData;
  late FlutterSecureStorage storage;

  setUp(() {
    storageData = {};
    FlutterSecureStoragePlatform.instance = FakeSecureStoragePlatform(storageData);
    storage = const FlutterSecureStorage();
  });

  ApiClient buildClient({
    required QueuedAdapter mainAdapter,
    QueuedAdapter? refreshAdapter,
  }) {
    final dio = Dio(BaseOptions(baseUrl: AppConstants.apiBaseUrl))..httpClientAdapter = mainAdapter;
    return ApiClient(
      dio: dio,
      storage: storage,
      createRefreshDio: () {
        final refreshDio = Dio();
        if (refreshAdapter != null) refreshDio.httpClientAdapter = refreshAdapter;
        return refreshDio;
      },
    );
  }

  group('ApiClient', () {
    test('attaches the stored access token as a Bearer header', () async {
      storageData[AppConstants.accessTokenKey] = 'initial-token';
      final mainAdapter = QueuedAdapter([(_) => jsonResponseBody({'ok': true}, 200)]);
      final client = buildClient(mainAdapter: mainAdapter);

      await client.dio.get('/videos');

      expect(mainAdapter.requests, hasLength(1));
      expect(mainAdapter.requests.single.headers['Authorization'], 'Bearer initial-token');
    });

    test('sends no Authorization header when no token is stored', () async {
      final mainAdapter = QueuedAdapter([(_) => jsonResponseBody({'ok': true}, 200)]);
      final client = buildClient(mainAdapter: mainAdapter);

      await client.dio.get('/videos');

      expect(mainAdapter.requests.single.headers.containsKey('Authorization'), isFalse);
    });

    test('on 401, refreshes tokens and retries the original request with the new token', () async {
      storageData[AppConstants.accessTokenKey] = 'old-token';
      storageData[AppConstants.refreshTokenKey] = 'refresh-1';

      final mainAdapter = QueuedAdapter([
        (_) => jsonResponseBody({'message': 'unauthorized'}, 401),
        (_) => jsonResponseBody({'ok': true}, 200),
      ]);
      final refreshAdapter = QueuedAdapter([
        (_) => jsonResponseBody({
              'data': {
                'accessToken': 'new-token',
                'refreshToken': 'new-refresh',
                'user': {'id': 'u1'},
              },
            }, 200),
      ]);
      final client = buildClient(mainAdapter: mainAdapter, refreshAdapter: refreshAdapter);

      final response = await client.dio.get('/videos');

      expect(response.statusCode, 200);
      expect(mainAdapter.requests, hasLength(2));
      expect(mainAdapter.requests[1].headers['Authorization'], 'Bearer new-token');
      expect(refreshAdapter.requests.single.path, '${AppConstants.apiBaseUrl}/auth/refresh');
      expect(storageData[AppConstants.accessTokenKey], 'new-token');
      expect(storageData[AppConstants.refreshTokenKey], 'new-refresh');
    });

    test('when refresh itself fails, clears stored tokens and propagates the original 401', () async {
      storageData[AppConstants.accessTokenKey] = 'old-token';
      storageData[AppConstants.refreshTokenKey] = 'bad-refresh';

      final mainAdapter = QueuedAdapter([
        (_) => jsonResponseBody({'message': 'unauthorized'}, 401),
      ]);
      final refreshAdapter = QueuedAdapter([
        (_) => jsonResponseBody({'message': 'invalid refresh token'}, 401),
      ]);
      final client = buildClient(mainAdapter: mainAdapter, refreshAdapter: refreshAdapter);

      await expectLater(
        client.dio.get('/videos'),
        throwsA(isA<DioException>().having((e) => e.response?.statusCode, 'statusCode', 401)),
      );

      // Only the original request went through — no retry after a failed refresh.
      expect(mainAdapter.requests, hasLength(1));
      expect(storageData.containsKey(AppConstants.accessTokenKey), isFalse);
      expect(storageData.containsKey(AppConstants.refreshTokenKey), isFalse);
    });

    test('when no refresh token is stored, does not call the refresh endpoint', () async {
      storageData[AppConstants.accessTokenKey] = 'old-token';

      final mainAdapter = QueuedAdapter([
        (_) => jsonResponseBody({'message': 'unauthorized'}, 401),
      ]);
      final refreshAdapter = QueuedAdapter([]);
      final client = buildClient(mainAdapter: mainAdapter, refreshAdapter: refreshAdapter);

      await expectLater(client.dio.get('/videos'), throwsA(isA<DioException>()));

      expect(refreshAdapter.requests, isEmpty);
    });
  });
}
