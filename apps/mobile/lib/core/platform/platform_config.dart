import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../constants/app_constants.dart';
import '../network/api_client.dart';

typedef PlatformConfig = Map<String, dynamic>;

final platformConfigProvider = FutureProvider<PlatformConfig>((ref) async {
  final client = ref.watch(apiClientProvider);
  final response = await client.dio.get('/platform/config');
  final data = response.data;
  if (data is Map && data['data'] is Map) {
    return Map<String, dynamic>.from(data['data'] as Map);
  }
  return {};
});

bool platformGoogleOAuthEnabled(PlatformConfig config) {
  final auth = config['auth'];
  if (auth is Map && auth['googleOAuth'] == true) return true;
  return false;
}

String googleOAuthStartUrl() {
  final base = AppConstants.apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
  // `platform=mobile` tells the API to redirect back to the app's custom
  // scheme instead of the web success URL (see oauth_deep_link_gate.dart).
  return '$base/auth/google?platform=mobile';
}
