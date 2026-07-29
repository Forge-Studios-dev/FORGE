import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';

class DiscoverCommunitiesScreen extends ConsumerStatefulWidget {
  const DiscoverCommunitiesScreen({super.key});

  @override
  ConsumerState<DiscoverCommunitiesScreen> createState() => _DiscoverCommunitiesScreenState();
}

class _DiscoverCommunitiesScreenState extends ConsumerState<DiscoverCommunitiesScreen> {
  final _queryCtrl = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  List<Map<String, dynamic>> _featured = [];
  bool _loading = false;

  Future<void> _loadFeatured() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/communities/discover/featured');
      final data = response.data['data'] as List? ?? [];
      setState(() => _featured = data.cast<Map<String, dynamic>>());
    } catch (_) {
      setState(() => _featured = []);
    }
  }

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
    _loadFeatured();
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
                IconButton(onPressed: () => _search(), tooltip: 'Search', icon: const Icon(Icons.search)),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          if (_featured.isNotEmpty && _queryCtrl.text.trim().isEmpty) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Featured', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ),
            SizedBox(
              height: 120,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: _featured.length,
                itemBuilder: (_, i) {
                  final c = _featured[i];
                  final creatorId = c['creatorId'] as String?;
                  final slug = c['slug'] as String?;
                  final isPaid = c['visibility'] == 'paid';
                  return SizedBox(
                    width: 200,
                    child: Card(
                      margin: const EdgeInsets.only(right: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(c['name'] as String? ?? '', maxLines: 2),
                              subtitle: Text(
                                [
                                  if (slug != null) '/$slug',
                                  if (isPaid) 'Paid community',
                                ].join(' · '),
                              ),
                              onTap: creatorId != null && slug != null
                                  ? () => context.push('/community/$creatorId/c/$slug')
                                  : null,
                            ),
                            if (isPaid && creatorId != null && slug != null)
                              TextButton(
                                onPressed: () => context.push('/community/$creatorId/c/$slug?subscribe=1'),
                                child: const Text('Membership options'),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
          Expanded(
            child: _results.isEmpty
                ? const Center(child: Text('No communities found'))
                : ListView.builder(
                    itemCount: _results.length,
                    itemBuilder: (_, i) {
                      final c = _results[i];
                      final creatorId = c['creatorId'] as String?;
                      final slug = c['slug'] as String?;
                      final isPaid = c['visibility'] == 'paid';
                      return ListTile(
                        title: Text(c['name'] as String? ?? ''),
                        subtitle: Text(
                          [
                            if ((c['creator'] as Map?)?['username'] != null)
                              '@${(c['creator'] as Map)['username']}',
                            if (slug != null) '/$slug',
                            if (isPaid) 'Paid community',
                          ].join(' · '),
                        ),
                        trailing: isPaid
                            ? TextButton(
                                onPressed: creatorId != null && slug != null
                                    ? () => context.push('/community/$creatorId/c/$slug?subscribe=1')
                                    : null,
                                child: const Text('Join'),
                              )
                            : Text(c['visibility'] as String? ?? 'public'),
                        onTap: creatorId != null && slug != null
                            ? () => context.push('/community/$creatorId/c/$slug')
                            : null,
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
