import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../constants/app_constants.dart';

const _storage = FlutterSecureStorage();

Future<Map<String, dynamic>?> readStoredUser() async {
  final raw = await _storage.read(key: AppConstants.userKey);
  if (raw == null || raw.isEmpty) return null;
  try {
    return jsonDecode(raw) as Map<String, dynamic>;
  } catch (_) {
    return null;
  }
}
