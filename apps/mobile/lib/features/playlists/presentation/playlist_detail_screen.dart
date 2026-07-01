import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

/// Shows a single playlist and its lessons. Owners can remove items; tapping a
/// lesson opens the watch screen. Mirrors the web `/playlists/:id` page.
class PlaylistDetailScreen extends ConsumerStatefulWidget {
  final String playlistId;
  const PlaylistDetailScreen({super.key, required this.playlistId});

  @override
  ConsumerState<PlaylistDetailScreen> createState() => _PlaylistDetailScreenState();
}

class _PlaylistDetailScreenState extends ConsumerState<PlaylistDetailScreen> {
  Map<String, dynamic>? _playlist;
  bool _loading = true;
  bool _error = false;
  String? _currentUserId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      final results = await Future.wait([
        api.dio.get('/playlists/${widget.playlistId}'),
        api.dio.get('/users/me'),
      ]);
      if (!mounted) return;
      final me = results[1].data['data'] as Map<String, dynamic>?;
      setState(() {
        _playlist = results[0].data['data'] as Map<String, dynamic>?;
        _currentUserId = me?['id'] as String?;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() {
            _error = true;
            _loading = false;
          });
    }
  }

  Future<void> _removeVideo(String videoId) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.delete('/playlists/${widget.playlistId}/videos/$videoId');
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not remove lesson')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final playlist = _playlist;
    final isOwner = playlist != null && playlist['userId'] == _currentUserId;
    final items = (playlist?['items'] as List?) ?? [];

    return Scaffold(
      appBar: AppBar(title: Text(playlist?['title'] as String? ?? 'Playlist')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error || playlist == null
              ? const Center(
                  child: Text('Failed to load playlist',
                      style: TextStyle(color: ForgeTokens.onSurfaceVariant)),
                )
              : items.isEmpty
                  ? const Center(
                      child: Text('This playlist is empty.',
                          style: TextStyle(color: ForgeTokens.onSurfaceVariant)),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: items.length,
                      itemBuilder: (_, i) {
                        final item = items[i] as Map<String, dynamic>;
                        final video = item['video'] as Map<String, dynamic>?;
                        final videoId = item['videoId'] as String? ?? video?['id'] as String?;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: ForgeCard(
                            onTap: videoId == null ? null : () => context.push('/watch/$videoId'),
                            child: Row(
                              children: [
                                const Icon(Icons.play_circle_outline,
                                    color: ForgeTokens.primary, size: 28),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    video?['title'] as String? ?? 'Lesson',
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(color: ForgeTokens.onSurface),
                                  ),
                                ),
                                if (isOwner && videoId != null)
                                  IconButton(
                                    icon: const Icon(Icons.remove_circle_outline,
                                        size: 20, color: ForgeTokens.onSurfaceVariant),
                                    tooltip: 'Remove',
                                    onPressed: () => _removeVideo(videoId),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}
