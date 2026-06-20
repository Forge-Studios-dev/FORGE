import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

class DiscoverCommunitiesScreen extends ConsumerStatefulWidget {
  const DiscoverCommunitiesScreen({super.key});

  @override
  ConsumerState<DiscoverCommunitiesScreen> createState() => _DiscoverCommunitiesScreenState();
}

class _DiscoverCommunitiesScreenState extends ConsumerState<DiscoverCommunitiesScreen> {
  final _queryCtrl = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  bool _loading = false;

  Future<void> _search([String? q]) async {
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      final query = (q ?? _queryCtrl.text).trim();
      final response = await client.dio.get('/communities/search', queryParameters: {'q': query});
      final data = response.data['data'] as List? ?? [];
      setState(() => _results = data.cast<Map<String, dynamic>>());
    } catch (_) {
      setState(() => _results = []);
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _queryCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Discover communities')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _queryCtrl,
                    decoration: const InputDecoration(hintText: 'Search communities…', isDense: true),
                    onSubmitted: _search,
                  ),
                ),
                IconButton(onPressed: () => _search(), icon: const Icon(Icons.search)),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: _results.isEmpty
                ? const Center(child: Text('No communities found'))
                : ListView.builder(
                    itemCount: _results.length,
                    itemBuilder: (_, i) {
                      final c = _results[i];
                      return ListTile(
                        title: Text(c['name'] as String? ?? ''),
                        subtitle: Text(c['slug'] as String? ?? ''),
                        trailing: Text(c['visibility'] as String? ?? 'public'),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
