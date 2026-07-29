import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

/// Captures a caught exception to Sentry (production) or debugPrint (debug).
///
/// Use this in catch blocks instead of silently swallowing errors:
/// ```dart
/// try { ... } catch (e, st) { captureError(e, st, hint: 'loadStream'); }
/// ```
void captureError(Object error, [StackTrace? stackTrace, String? hint]) {
  if (kDebugMode) {
    debugPrint('[FORGE${hint != null ? ':$hint' : ''}] $error');
    if (stackTrace != null) debugPrint('$stackTrace');
    return;
  }
  Sentry.captureException(
    error,
    stackTrace: stackTrace,
    hint: hint != null ? Hint.withMap({'context': hint}) : null,
  );
}
