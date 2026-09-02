import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_envelope.dart';
import '../../../core/platform/platform_config.dart';

final featuredCoursesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final config = await ref.watch(platformConfigProvider.future);
  if (!platformCoursesEnabled(config)) return [];

  try {
    final client = ref.read(apiClientProvider);
    final res = await client.dio.get('/courses/discover/featured');
    return readApiList(res.data);
  } catch (_) {
    return [];
  }
});
