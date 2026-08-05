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

  @override
  void initState() {
    super.initState();
    _load();
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Playlists'),
        actions: [
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
          : _items.isEmpty
              ? ForgeEmptyState(
                  icon: Icons.playlist_play,
                  title: 'No playlists yet',
                  description: 'Create a playlist to organize videos you love.',
                  actionLabel: 'New playlist',
                  onAction: _createPlaylist,
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _items.length,
                    itemBuilder: (_, i) {
                      final p = _items[i] as Map<String, dynamic>;
                      final visibility = p['visibility'] as String? ?? 'public';
                      final visibilityLabel = switch (visibility) {
                        'private' => 'Private',
                        'unlisted' => 'Unlisted',
                        _ => 'Public',
                      };
                      final count = p['videoCount'] ?? p['itemCount'];
                      final meta = count != null ? '$visibilityLabel · $count videos' : visibilityLabel;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ForgeCard(
                          onTap: () => context.push('/playlists/${p['id']}'),
                          child: Row(
                            children: [
                              Icon(Icons.playlist_play, color: ForgeTokens.of(context).primary, size: 28),
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
                                    visibility == 'private' ? Icons.lock_outline : Icons.link,
                                    size: 16,
                                    color: ForgeTokens.of(context).onSurfaceVariant,
                                  ),
                                ),
                              Icon(Icons.chevron_right, color: ForgeTokens.of(context).outline),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
