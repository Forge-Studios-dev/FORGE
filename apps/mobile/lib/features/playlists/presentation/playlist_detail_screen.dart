import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

/// Shows a single playlist and its videos. Owners can remove items; tapping a
/// video opens the watch screen. Mirrors the web `/playlists/:id` page.
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
          const SnackBar(content: Text('Could not remove video')),
        );
      }
    }
  }

  Future<void> _editDetails() async {
    final playlist = _playlist;
    if (playlist == null) return;
    final titleCtrl = TextEditingController(text: playlist['title'] as String? ?? '');
    final descCtrl = TextEditingController(text: playlist['description'] as String? ?? '');
    var visibility = playlist['visibility'] as String? ?? 'public';

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          title: const Text('Edit playlist'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(labelText: 'Title'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: visibility,
                  decoration: const InputDecoration(labelText: 'Visibility'),
                  items: const [
                    DropdownMenuItem(value: 'public', child: Text('Public')),
                    DropdownMenuItem(value: 'unlisted', child: Text('Unlisted')),
                    DropdownMenuItem(value: 'private', child: Text('Private')),
                  ],
                  onChanged: (v) {
                    if (v != null) setDialog(() => visibility = v);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
          ],
        ),
      ),
    );
    final title = titleCtrl.text.trim();
    final description = descCtrl.text.trim();
    titleCtrl.dispose();
    descCtrl.dispose();
    if (saved != true || title.isEmpty) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.patch(
        '/playlists/${widget.playlistId}',
        data: {
          'title': title,
          'description': description.isEmpty ? null : description,
          'visibility': visibility,
        },
      );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update playlist')),
        );
      }
    }
  }

  Future<void> _moveItem(int index, int delta) async {
    final playlist = _playlist;
    if (playlist == null) return;
    final items = List<Map<String, dynamic>>.from(
      ((playlist['items'] as List?) ?? []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)),
    );
    final next = index + delta;
    if (next < 0 || next >= items.length) return;
    final tmp = items[index];
    items[index] = items[next];
    items[next] = tmp;
    final orderedIds = items
        .map((e) => e['videoId'] as String? ?? (e['video'] as Map?)?['id'] as String?)
        .whereType<String>()
        .toList();
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.put(
        '/playlists/${widget.playlistId}/reorder',
        data: {'videoIds': orderedIds},
      );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not reorder')),
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
      appBar: AppBar(
        title: Text(playlist?['title'] as String? ?? 'Playlist'),
        actions: [
          if (isOwner)
            IconButton(
              tooltip: 'Edit details',
              icon: const Icon(Icons.edit_outlined),
              onPressed: _editDetails,
            ),
          if (playlist != null)
            IconButton(
              tooltip: 'Share',
              icon: const Icon(Icons.share_outlined),
              onPressed: () {
                final url = '${AppConstants.webBaseUrl}/playlists/${widget.playlistId}';
                final title = playlist['title'] as String? ?? 'Playlist';
                Share.share('$title\n$url');
              },
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error || playlist == null
              ? Center(
                  child: Text('Failed to load playlist',
                      style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant)),
                )
              : items.isEmpty
                  ? Center(
                      child: Text('This playlist is empty.',
                          style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant)),
                    )
                  : Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                FilledButton.icon(
                                  onPressed: () {
                                    final first = items.first as Map<String, dynamic>;
                                    final video = first['video'] as Map<String, dynamic>?;
                                    final videoId =
                                        first['videoId'] as String? ?? video?['id'] as String?;
                                    if (videoId == null) return;
                                    context.push('/watch/$videoId?list=${widget.playlistId}');
                                  },
                                  icon: const Icon(Icons.play_arrow),
                                  label: const Text('Play all'),
                                ),
                                OutlinedButton.icon(
                                  onPressed: () {
                                    final first = items.first as Map<String, dynamic>;
                                    final video = first['video'] as Map<String, dynamic>?;
                                    final videoId =
                                        first['videoId'] as String? ?? video?['id'] as String?;
                                    if (videoId == null) return;
                                    context.push(
                                      '/watch/$videoId?list=${widget.playlistId}&shuffle=1',
                                    );
                                  },
                                  icon: const Icon(Icons.shuffle),
                                  label: const Text('Shuffle'),
                                ),
                              ],
                            ),
                          ),
                        ),
                        Expanded(
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: items.length,
                            itemBuilder: (_, i) {
                              final item = items[i] as Map<String, dynamic>;
                              final video = item['video'] as Map<String, dynamic>?;
                              final videoId =
                                  item['videoId'] as String? ?? video?['id'] as String?;
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: ForgeCard(
                                  onTap: videoId == null
                                      ? null
                                      : () => context.push(
                                            '/watch/$videoId?list=${widget.playlistId}',
                                          ),
                                  child: Row(
                                    children: [
                                      Icon(Icons.play_circle_outline,
                                          color: ForgeTokens.of(context).primary, size: 28),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Text(
                                          video?['title'] as String? ?? 'Video',
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(color: ForgeTokens.of(context).onSurface),
                                        ),
                                      ),
                                      if (isOwner) ...[
                                        IconButton(
                                          icon: Icon(Icons.arrow_upward, size: 18),
                                          tooltip: 'Move up',
                                          onPressed: i == 0 ? null : () => _moveItem(i, -1),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.arrow_downward, size: 18),
                                          tooltip: 'Move down',
                                          onPressed: i >= items.length - 1 ? null : () => _moveItem(i, 1),
                                        ),
                                      ],
                                      if (isOwner && videoId != null)
                                        IconButton(
                                          icon: Icon(Icons.remove_circle_outline,
                                              size: 20, color: ForgeTokens.of(context).onSurfaceVariant),
                                          tooltip: 'Remove',
                                          onPressed: () => _removeVideo(videoId),
                                        ),
                                    ],
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
