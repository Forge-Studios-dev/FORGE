import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../shared/models/video.dart';
import '../data/playlists_repository.dart';

/// System playlists: Watch later / Liked (YouTube Library shelves).
class SystemPlaylistScreen extends ConsumerStatefulWidget {
  final String kind; // watch-later | liked

  const SystemPlaylistScreen({super.key, required this.kind});

  @override
  ConsumerState<SystemPlaylistScreen> createState() => _SystemPlaylistScreenState();
}

class _SystemPlaylistScreenState extends ConsumerState<SystemPlaylistScreen> {
  List<VideoModel> _videos = [];
  String? _playlistId;
  bool _loading = true;
  bool _error = false;
  bool _clearing = false;
  String _itemQuery = '';
  final _itemSearchCtrl = TextEditingController();

  String get _title => widget.kind == 'liked' ? 'Liked videos' : 'Watch later';

  PlaylistsRepository get _repo => ref.read(playlistsRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _itemSearchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final result = await _repo.getSystemPlaylist(widget.kind);
      if (!mounted) return;
      setState(() {
        _videos = result.videos;
        _playlistId = result.playlistId;
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  Future<bool> _confirmRemove(VideoModel video) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove video?'),
        content: Text('Remove this video from $_title?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return false;
    await _remove(video);
    return false;
  }

  Future<void> _remove(VideoModel video) async {
    try {
      await _repo.removeFromSystemPlaylist(kind: widget.kind, videoId: video.id);
      if (!mounted) return;
      setState(() {
        _videos = _videos.where((v) => v.id != video.id).toList();
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not remove video')),
      );
    }
  }

  Future<void> _clearAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Clear $_title?'),
        content: Text('Remove all videos from $_title?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Clear all')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _clearing = true);
    try {
      await _repo.clearSystemPlaylist(widget.kind);
      if (!mounted) return;
      setState(() {
        _videos = [];
        _clearing = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _clearing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not clear list')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _itemQuery.trim().toLowerCase();
    final filtered = q.isEmpty
        ? _videos
        : _videos
            .where(
              (v) =>
                  v.title.toLowerCase().contains(q) ||
                  v.user.displayName.toLowerCase().contains(q) ||
                  v.user.username.toLowerCase().contains(q),
            )
            .toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        actions: [
          if (_videos.isNotEmpty)
            TextButton(
              onPressed: _clearing ? null : _clearAll,
              child: Text(_clearing ? 'Clearing…' : 'Clear all'),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error
              ? ForgeEmptyState(
                  icon: Icons.error_outline,
                  title: 'Couldn’t load $_title',
                  description: 'Sign in and try again.',
                  actionLabel: 'Retry',
                  onAction: _load,
                )
              : _videos.isEmpty
                  ? ForgeEmptyState(
                      icon: widget.kind == 'liked'
                          ? Icons.thumb_up_outlined
                          : Icons.watch_later_outlined,
                      title: 'Nothing here yet',
                      description: widget.kind == 'liked'
                          ? 'Videos you like will show up in this list.'
                          : 'Save videos to Watch later from the watch page.',
                    )
                  : Column(
                      children: [
                        if (_videos.isNotEmpty && _playlistId != null)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                            child: Row(
                              children: [
                                FilledButton.icon(
                                  onPressed: () => context.push(
                                    '/watch/${_videos.first.id}?list=$_playlistId',
                                  ),
                                  icon: const Icon(Icons.play_arrow),
                                  label: const Text('Play all'),
                                ),
                                const SizedBox(width: 8),
                                OutlinedButton.icon(
                                  onPressed: () => context.push(
                                    '/watch/${_videos.first.id}?list=$_playlistId&shuffle=1',
                                  ),
                                  icon: const Icon(Icons.shuffle),
                                  label: const Text('Shuffle'),
                                ),
                              ],
                            ),
                          ),
                        if (_videos.length > 3)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                            child: TextField(
                              controller: _itemSearchCtrl,
                              onChanged: (v) => setState(() => _itemQuery = v),
                              decoration: InputDecoration(
                                hintText: 'Search this playlist',
                                prefixIcon: const Icon(Icons.search),
                                suffixIcon: _itemQuery.isEmpty
                                    ? null
                                    : IconButton(
                                        icon: const Icon(Icons.clear),
                                        onPressed: () {
                                          _itemSearchCtrl.clear();
                                          setState(() => _itemQuery = '');
                                        },
                                      ),
                                isDense: true,
                              ),
                            ),
                          ),
                        Expanded(
                          child: filtered.isEmpty
                              ? Center(
                                  child: Text(
                                    'No matching videos',
                                    style: TextStyle(
                                      color: ForgeTokens.of(context).onSurfaceVariant,
                                    ),
                                  ),
                                )
                              : ListView.builder(
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final video = filtered[index];
                        final listId = _playlistId;
                        return Dismissible(
                          key: ValueKey(video.id),
                          direction: DismissDirection.endToStart,
                          background: Container(
                            alignment: Alignment.centerRight,
                            padding: const EdgeInsets.only(right: 20),
                            color: ForgeTokens.of(context).error.withValues(alpha: 0.15),
                            child: Icon(Icons.delete_outline, color: ForgeTokens.of(context).error),
                          ),
                          confirmDismiss: (_) => _confirmRemove(video),
                          child: ListTile(
                            onTap: () => context.push(
                              listId != null
                                  ? '/watch/${video.id}?list=$listId'
                                  : '/watch/${video.id}',
                            ),
                            leading: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: SizedBox(
                                width: 96,
                                height: 54,
                                child: video.thumbnailUrl != null
                                    ? CachedNetworkImage(
                                        imageUrl: video.thumbnailUrl!,
                                        fit: BoxFit.cover,
                                      )
                                    : ColoredBox(
                                        color: ForgeTokens.of(context).surfaceContainerHigh,
                                        child: Icon(
                                          Icons.play_arrow,
                                          color: ForgeTokens.of(context).onSurfaceVariant,
                                        ),
                                      ),
                              ),
                            ),
                            title: Text(
                              video.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(video.user.displayName),
                            trailing: IconButton(
                              tooltip: 'Remove',
                              icon: const Icon(Icons.close),
                              onPressed: () => _confirmRemove(video),
                            ),
                          ),
                        );
                      },
                    ),
                        ),
                      ],
                    ),
    );
  }
}
