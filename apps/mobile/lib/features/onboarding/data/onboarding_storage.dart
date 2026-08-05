import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';

/// Reuses the same [FlutterSecureStorage] instance/pattern as the rest of the
/// app (see `core/network/api_client.dart`, `core/router/auth_redirect_storage.dart`)
/// instead of adding a new local-storage dependency for a single flag.
const _storage = FlutterSecureStorage();

Future<bool> isOnboardingComplete() async {
  final value = await _storage.read(key: AppConstants.onboardingCompleteKey);
  return value == 'true';
}

Future<void> markOnboardingComplete() async {
  await _storage.write(key: AppConstants.onboardingCompleteKey, value: 'true');
}

/// Persists chosen interest category UUIDs locally and syncs to
/// `PUT /users/me/interests` when the user is authenticated.
Future<void> saveOnboardingInterests(
  List<String> categoryIds, {
  ApiClient? apiClient,
}) async {
  final cleaned = categoryIds.where((id) => id.trim().isNotEmpty).toList();
  await _storage.write(
    key: AppConstants.onboardingInterestsKey,
    value: jsonEncode(cleaned),
  );
  if (cleaned.isEmpty) return;
  final client = apiClient ?? ApiClient();
  try {
    await client.dio.put('/users/me/interests', data: {'categoryIds': cleaned});
  } catch (_) {
    // Local cache still saved; feed personalization can catch up later.
  }
}

Future<List<String>> getOnboardingInterests() async {
  final raw = await _storage.read(key: AppConstants.onboardingInterestsKey);
  if (raw == null || raw.isEmpty) return const [];
  try {
    return (jsonDecode(raw) as List).cast<String>();
  } catch (_) {
    return const [];
  }
}
