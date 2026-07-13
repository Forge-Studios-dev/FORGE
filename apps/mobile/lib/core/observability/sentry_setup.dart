import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

/// Crash reporting (CRIT-02) — pass `--dart-define=SENTRY_DSN=...` to enable.
/// Debug builds and DSN-less runs skip Sentry but still install a fallback
/// FlutterError/PlatformDispatcher handler so crashes aren't silently lost.
Future<void> initForgeObservability(Future<void> Function() runApp) async {
  const dsn = String.fromEnvironment('SENTRY_DSN');
  if (dsn.isEmpty || kDebugMode) {
    _installFallbackErrorHandlers();
    await runApp();
    return;
  }

  await SentryFlutter.init(
    (options) {
      options.dsn = dsn;
      options.environment = const String.fromEnvironment(
        'SENTRY_ENVIRONMENT',
        defaultValue: 'production',
      );
      options.tracesSampleRate = 0.2;
    },
    appRunner: runApp,
  );
}

/// SentryFlutter.init already wires FlutterError/PlatformDispatcher capture
/// when active; this is only the fallback path for when Sentry is skipped.
void _installFallbackErrorHandlers() {
  final previousFlutterOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    previousFlutterOnError?.call(details);
    debugPrint('Unhandled FlutterError: ${details.exceptionAsString()}');
  };

  final previousPlatformOnError = PlatformDispatcher.instance.onError;
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('Unhandled PlatformDispatcher error: $error\n$stack');
    return previousPlatformOnError?.call(error, stack) ?? false;
  };
}
