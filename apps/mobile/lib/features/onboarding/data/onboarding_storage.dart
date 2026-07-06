import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/constants/app_constants.dart';

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

/// Persists the user's chosen interest categories locally so the choice
/// survives app restarts.
///
/// TODO(backend): no client-side "user preferences" endpoint exists yet
/// (checked lib/features/**/data for anything preference-related) — wire
/// this to a real preferences endpoint once the API exposes one, instead of
/// only local storage.
Future<void> saveOnboardingInterests(List<String> interestIds) async {
  await _storage.write(
    key: AppConstants.onboardingInterestsKey,
    value: jsonEncode(interestIds),
  );
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
