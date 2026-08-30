import 'package:dio/dio.dart';

import '../cache/local_cache.dart';

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

/// Local opt-out for product analytics (Settings → Privacy). Default on.
const analyticsOptInPrefKey = 'forge.analytics.optIn';

bool analyticsOptInGranted() {
  final raw = LocalCache.read(analyticsOptInPrefKey);
  // Unset → allowed (first-party product analytics); explicit '0' → off.
  return raw != '0';
}

Future<void> setAnalyticsOptIn(bool enabled) =>
    LocalCache.write(analyticsOptInPrefKey, enabled ? '1' : '0');

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
    if (!analyticsOptInGranted()) return;
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
