import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../core/widgets/forge_empty_state.dart';
import 'create_playlist_dialog.dart';

/// Lists the current user's playlists (public + private) and allows creating
/// new ones. Mirrors the web `/playlists` experience.
class PlaylistsScreen extends ConsumerStatefulWidget {
  const PlaylistsScreen({super.key});

  @override
  ConsumerState<PlaylistsScreen> createState() => _PlaylistsScreenState();
}

class _PlaylistsScreenState extends ConsumerState<PlaylistsScreen> {
  List<dynamic> _items = [];
  bool _loading = true;
  bool _creating = false;
  String _sort = 'recent'; // recent | az | za
  String _visibility = ''; // '' | public | unlisted | private
  String _query = '';
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.get('/playlists/me');
      if (!mounted) return;
      setState(() {
        _items = res.data['data'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _sortedItems {
    var list = _items
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .where((p) => p['systemType'] == null)
        .toList();
    if (_visibility.isNotEmpty) {
      list = list.where((p) => (p['visibility'] as String?) == _visibility).toList();
    }
    final q = _query.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list.where((p) {
        final title = ((p['title'] as String?) ?? '').toLowerCase();
        final desc = ((p['description'] as String?) ?? '').toLowerCase();
        return title.contains(q) || desc.contains(q);
      }).toList();
    }
    if (_sort == 'az') {
      list.sort((a, b) => ((a['title'] as String?) ?? '')
          .toLowerCase()
          .compareTo(((b['title'] as String?) ?? '').toLowerCase()));
    } else if (_sort == 'za') {
      list.sort((a, b) => ((b['title'] as String?) ?? '')
          .toLowerCase()
          .compareTo(((a['title'] as String?) ?? '').toLowerCase()));
    }
    return list;
  }

  Future<void> _createPlaylist() async {
    setState(() => _creating = true);
    try {
      final id = await showCreatePlaylistDialog(context, ref);
      if (!mounted) return;
      if (id != null) {
        await _load();
        if (mounted) context.push('/playlists/$id');
      }
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final display = _sortedItems;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Playlists'),
        actions: [
          if (display.length > 1)
            PopupMenuButton<String>(
              tooltip: 'Sort playlists',
              initialValue: _sort,
              onSelected: (v) => setState(() => _sort = v),
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'recent', child: Text('Recently added')),
                PopupMenuItem(value: 'az', child: Text('A–Z')),
                PopupMenuItem(value: 'za', child: Text('Z–A')),
              ],
              icon: const Icon(Icons.sort),
            ),
          IconButton(
            onPressed: _creating ? null : _createPlaylist,
            icon: _creating
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.add),
            tooltip: 'New playlist',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: (v) => setState(() => _query = v),
                    decoration: InputDecoration(
                      hintText: 'Search playlists',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _query.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.clear),
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _query = '');
                              },
                            ),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                  child: Row(
                    children: [
                      for (final f in const [
                        ('', 'All'),
                        ('public', 'Public'),
                        ('unlisted', 'Unlisted'),
                        ('private', 'Private'),
                      ]) ...[
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text(f.$2),
                            selected: _visibility == f.$1,
                            onSelected: (_) => setState(() => _visibility = f.$1),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Expanded(
                  child: display.isEmpty
                      ? ForgeEmptyState(
                          icon: Icons.playlist_play,
                          title: _query.isNotEmpty || _visibility.isNotEmpty
                              ? 'No playlists match'
                              : 'No playlists yet',
                          description: _query.isNotEmpty || _visibility.isNotEmpty
                              ? 'Try a different search or visibility filter.'
                              : 'Create a playlist to organize videos you love.',
                          actionLabel: 'New playlist',
                          onAction: _createPlaylist,
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: display.length,
                            itemBuilder: (_, i) {
                              final p = display[i];
                              final visibility = p['visibility'] as String? ?? 'public';
                              final visibilityLabel = switch (visibility) {
                                'private' => 'Private',
                                'unlisted' => 'Unlisted',
                                _ => 'Public',
                              };
                              final count = p['videoCount'] ?? p['itemCount'];
                              final meta =
                                  count != null ? '$visibilityLabel · $count videos' : visibilityLabel;
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: ForgeCard(
                                  onTap: () => context.push('/playlists/${p['id']}'),
                                  child: Row(
                                    children: [
                                      Icon(Icons.playlist_play,
                                          color: ForgeTokens.of(context).primary, size: 28),
                                      const SizedBox(width: 16),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              p['title'] as String? ?? 'Playlist',
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                fontWeight: FontWeight.w600,
                                                color: ForgeTokens.of(context).onSurface,
                                              ),
                                            ),
                                            Text(
                                              meta,
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: ForgeTokens.of(context).onSurfaceVariant,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      if (visibility == 'private' || visibility == 'unlisted')
                                        Padding(
                                          padding: const EdgeInsets.only(right: 8),
                                          child: Icon(
                                            visibility == 'private'
                                                ? Icons.lock_outline
                                                : Icons.link,
                                            size: 16,
                                            color: ForgeTokens.of(context).onSurfaceVariant,
                                          ),
                                        ),
                                      Icon(Icons.chevron_right,
                                          color: ForgeTokens.of(context).outline),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                ),
              ],
            ),
    );
  }
}
