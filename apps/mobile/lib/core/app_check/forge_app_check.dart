import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Returns App Check token when Firebase is configured; null otherwise.
Future<String?> getForgeAppCheckToken() async {
  if (kIsWeb || Firebase.apps.isEmpty) return null;
  try {
    await FirebaseAppCheck.instance.activate(
      androidProvider: AndroidProvider.playIntegrity,
      appleProvider: AppleProvider.deviceCheck,
    );
    final token = await FirebaseAppCheck.instance.getToken();
    return token;
  } catch (_) {
    return null;
  }
}
