import 'dart:convert';

import '../../../core/cache/local_cache.dart';

const _storageKey = 'forge.searchHistory';
const _maxItems = 8;

/// Local recent search queries (mirrors web `search-history.ts`).
Future<List<String>> readSearchHistory() async {
  final raw = LocalCache.read(_storageKey);
  if (raw == null || raw.isEmpty) return const [];
  try {
    return (jsonDecode(raw) as List)
        .whereType<String>()
        .map((q) => q.trim())
        .where((q) => q.isNotEmpty)
        .take(_maxItems)
        .toList();
  } catch (_) {
    return const [];
  }
}

Future<List<String>> pushSearchHistory(String query) async {
  final term = query.trim();
  if (term.isEmpty) return readSearchHistory();
  final existing = await readSearchHistory();
  final next = [
    term,
    ...existing.where((q) => q.toLowerCase() != term.toLowerCase()),
  ].take(_maxItems).toList();
  await LocalCache.write(_storageKey, jsonEncode(next));
  return next;
}

Future<void> clearSearchHistory() async {
  await LocalCache.write(_storageKey, jsonEncode(const <String>[]));
}
