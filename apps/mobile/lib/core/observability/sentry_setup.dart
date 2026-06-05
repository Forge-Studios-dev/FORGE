import 'package:flutter/foundation.dart';

/// Optional crash reporting — pass `--dart-define=SENTRY_DSN=...` to enable.
Future<void> initForgeObservability(Future<void> Function() runApp) async {
  const dsn = String.fromEnvironment('SENTRY_DSN');
  if (dsn.isEmpty || kDebugMode) {
    await runApp();
    return;
  }

  try {
    // sentry_flutter is optional until added to pubspec for production builds.
    // ignore: avoid_dynamic_calls
    final sentry = await _loadSentry();
    await sentry.init(
      (options) {
        options.dsn = dsn;
        options.environment = const String.fromEnvironment(
          'SENTRY_ENVIRONMENT',
          defaultValue: 'production',
        );
      },
      appRunner: runApp,
    );
  } catch (_) {
    await runApp();
  }
}

Future<dynamic> _loadSentry() async {
  throw UnsupportedError('Add sentry_flutter to pubspec.yaml for production crash reporting');
}
