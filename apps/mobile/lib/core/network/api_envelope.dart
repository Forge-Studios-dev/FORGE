/// Helpers for NestJS `TransformInterceptor` envelopes (`{ success, data }`).
/// Some services wrap payloads again as `{ data: … }` before the interceptor runs.

List<Map<String, dynamic>> readApiList(dynamic responseBody) {
  if (responseBody is! Map) return const [];
  final layer1 = responseBody['data'];
  if (layer1 is List) {
    return layer1
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList();
  }
  if (layer1 is Map && layer1['data'] is List) {
    return (layer1['data'] as List)
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList();
  }
  return const [];
}

Map<String, dynamic>? readApiMap(dynamic responseBody) {
  if (responseBody is! Map) return null;
  final layer1 = responseBody['data'];
  if (layer1 is! Map) return null;
  if (layer1['data'] is Map && !layer1.containsKey('id')) {
    return Map<String, dynamic>.from(layer1['data'] as Map);
  }
  return Map<String, dynamic>.from(layer1);
}
