import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_envelope.dart';
import '../../../core/platform/platform_config.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

class DiscoverCoursesScreen extends ConsumerStatefulWidget {
  const DiscoverCoursesScreen({super.key});

  @override
  ConsumerState<DiscoverCoursesScreen> createState() => _DiscoverCoursesScreenState();
}

class _DiscoverCoursesScreenState extends ConsumerState<DiscoverCoursesScreen> {
  final _queryCtrl = TextEditingController();
  List<Map<String, dynamic>> _featured = [];
  List<Map<String, dynamic>> _results = [];
  String _searchTerm = '';
  bool _loadingFeatured = true;
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _loadFeatured();
  }

  @override
  void dispose() {
    _queryCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadFeatured() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/courses/discover/featured');
      setState(() {
        _featured = readApiList(res.data);
        _loadingFeatured = false;
      });
    } catch (_) {
      setState(() => _loadingFeatured = false);
    }
  }

  Future<void> _search() async {
    final term = _queryCtrl.text.trim();
    if (term.length < 2) return;
    setState(() {
      _searchTerm = term;
      _searching = true;
    });
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get(
        '/courses/discover',
        queryParameters: {'q': term},
      );
      setState(() {
        _results = readApiList(res.data);
        _searching = false;
      });
    } catch (_) {
      setState(() => _searching = false);
    }
  }

  Widget _courseTile(Map<String, dynamic> course) {
    final id = course['id'] as String? ?? '';
    final creator = course['creator'] as Map<String, dynamic>?;
    final username = creator?['username'] as String?;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: ForgeCard(
        onTap: () => context.push('/courses/$id'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              course['title'] as String? ?? 'Course',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            if ((course['description'] as String?)?.isNotEmpty == true)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  course['description'] as String,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: ForgeTokens.onSurfaceVariant),
                ),
              ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${course['lessonCount'] ?? 0} lessons'
                '${creator != null ? ' · ${creator['displayName'] ?? ''}' : ''}',
                style: const TextStyle(fontSize: 11, color: ForgeTokens.onSurfaceVariant),
              ),
            ),
            if (username != null)
              TextButton(
                onPressed: () => context.push('/profile/$username'),
                child: Text('@${username}'),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final platformConfig = ref.watch(platformConfigProvider).valueOrNull ?? {};
    if (!platformCoursesEnabled(platformConfig)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go('/explore');
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final showingSearch = _searchTerm.length >= 2;
    final list = showingSearch ? _results : _featured;

    return Scaffold(
      appBar: AppBar(title: const Text('Discover courses')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Find published creator courses on FORGE.',
            style: TextStyle(color: ForgeTokens.onSurfaceVariant),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _queryCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Search courses',
                    hintText: 'Min 2 characters',
                  ),
                  onSubmitted: (_) => _search(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(onPressed: _search, icon: const Icon(Icons.search)),
            ],
          ),
          const SizedBox(height: 16),
          if (_loadingFeatured || _searching)
            const Center(child: CircularProgressIndicator())
          else if (showingSearch && list.isEmpty)
            const Text('No courses found', style: TextStyle(color: ForgeTokens.onSurfaceVariant))
          else if (!showingSearch && list.isEmpty)
            const Text('No published courses yet', style: TextStyle(color: ForgeTokens.onSurfaceVariant))
          else ...[
            Text(
              showingSearch ? 'Search results' : 'Featured courses',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            ...list.map(_courseTile),
          ],
        ],
      ),
    );
  }
}
