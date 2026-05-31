import 'package:dio/dio.dart';

/// Allowlisted analytics events (keep in sync with @forge/shared-types).
const allowedAnalyticsEvents = {
  'auth.signup',
  'auth.login',
  'watch.progress',
  'watch.complete',
  'watch.startup_ms',
  'search.query',
  'navigation.page',
  'studio.publish',
};

class ForgeAnalytics {
  ForgeAnalytics(this._dio);

  final Dio _dio;

  Future<void> track(
    String eventName, {
    Map<String, dynamic>? properties,
    String? videoId,
    String? accessToken,
    String? appCheckToken,
  }) async {
    if (!allowedAnalyticsEvents.contains(eventName)) return;
    try {
      await _dio.post(
        '/analytics/events',
        data: {
          'eventName': eventName,
          if (properties != null) 'properties': properties,
          if (videoId != null) 'videoId': videoId,
        },
        options: Options(
          headers: {
            if (accessToken != null) 'Authorization': 'Bearer $accessToken',
            if (appCheckToken != null) 'X-Firebase-AppCheck': appCheckToken,
          },
          validateStatus: (s) => s != null && s < 500,
        ),
      );
    } catch (_) {
      /* non-blocking */
    }
  }
}
