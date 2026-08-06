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
  String _itemQuery = '';
  final _itemSearchCtrl = TextEditingController();

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

  Future<void> _addVideos() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.get('/videos/studio', queryParameters: {'limit': 50, 'status': 'ready'});
      final data = res.data['data'] as Map<String, dynamic>?;
      final list = (data?['data'] as List?) ?? [];
      final studioVideos = list
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((v) => v['id'] is String && v['status'] == 'ready')
          .toList();

      final existing = <String>{};
      for (final raw in (_playlist?['items'] as List?) ?? []) {
        final item = raw as Map<String, dynamic>;
        final video = item['video'] as Map<String, dynamic>?;
        final id = item['videoId'] as String? ?? video?['id'] as String?;
        if (id != null) existing.add(id);
      }
      final candidates = studioVideos.where((v) => !existing.contains(v['id'])).toList();
      if (!mounted) return;
      if (candidates.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No more ready videos to add')),
        );
        return;
      }

      final selected = await showModalBottomSheet<Set<String>>(
        context: context,
        isScrollControlled: true,
        builder: (ctx) {
          final picked = <String>{};
          return StatefulBuilder(
            builder: (ctx, setSheet) {
              return SafeArea(
                child: SizedBox(
                  height: MediaQuery.of(ctx).size.height * 0.7,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Add videos',
                                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                              ),
                            ),
                            TextButton(
                              onPressed: picked.isEmpty
                                  ? null
                                  : () => Navigator.pop(ctx, picked),
                              child: Text('Add (${picked.length})'),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: ListView.builder(
                          itemCount: candidates.length,
                          itemBuilder: (_, i) {
                            final v = candidates[i];
                            final id = v['id'] as String;
                            final checked = picked.contains(id);
                            return CheckboxListTile(
                              value: checked,
                              title: Text(
                                v['title'] as String? ?? 'Video',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              onChanged: (on) {
                                setSheet(() {
                                  if (on == true) {
                                    picked.add(id);
                                  } else {
                                    picked.remove(id);
                                  }
                                });
                              },
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      );

      if (selected == null || selected.isEmpty || !mounted) return;
      for (final videoId in selected) {
        await api.dio.post(
          '/playlists/${widget.playlistId}/videos',
          data: {'videoId': videoId},
        );
      }
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not add videos')),
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

  Future<void> _deletePlaylist() async {
    final playlist = _playlist;
    if (playlist == null) return;
    if (playlist['systemType'] != null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete playlist?'),
        content: const Text('Videos themselves are not deleted — only this playlist.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.delete('/playlists/${widget.playlistId}');
      if (!mounted) return;
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/playlists');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete playlist')),
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
    final q = _itemQuery.trim().toLowerCase();
    final filteredItems = q.isEmpty
        ? items
        : items.where((raw) {
            if (raw is! Map) return false;
            final item = Map<String, dynamic>.from(raw);
            final video = item['video'] as Map<String, dynamic>?;
            final title = (video?['title'] as String? ?? '').toLowerCase();
            final user = video?['user'] as Map<String, dynamic>?;
            final channel = ((user?['displayName'] as String?) ??
                    (user?['username'] as String?) ??
                    '')
                .toLowerCase();
            return title.contains(q) || channel.contains(q);
          }).toList();
    final filtering = q.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: Text(playlist?['title'] as String? ?? 'Playlist'),
        actions: [
          if (isOwner)
            IconButton(
              tooltip: 'Add videos',
              icon: const Icon(Icons.playlist_add),
              onPressed: _addVideos,
            ),
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
                SharePlus.instance.share(ShareParams(text: '$title\n$url'));
              },
            ),
          if (isOwner && playlist?['systemType'] == null)
            IconButton(
              tooltip: 'Delete playlist',
              icon: Icon(Icons.delete_outline, color: ForgeTokens.of(context).error),
              onPressed: _deletePlaylist,
            ),
        ],
      ),
      floatingActionButton: isOwner
          ? FloatingActionButton.extended(
              onPressed: _addVideos,
              icon: const Icon(Icons.playlist_add),
              label: const Text('Add videos'),
            )
          : null,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error || playlist == null
              ? Center(
                  child: Text('Failed to load playlist',
                      style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant)),
                )
              : items.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'This playlist is empty.',
                            style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                          ),
                          if (isOwner) ...[
                            const SizedBox(height: 12),
                            FilledButton.icon(
                              onPressed: _addVideos,
                              icon: const Icon(Icons.playlist_add),
                              label: const Text('Add videos'),
                            ),
                          ],
                        ],
                      ),
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
                        if (items.length > 3)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
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
                                filled: true,
                                fillColor: ForgeTokens.of(context).surfaceContainerLow,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                          ),
                        Expanded(
                          child: filteredItems.isEmpty
                              ? Center(
                                  child: Text(
                                    'No videos match "$_itemQuery"',
                                    style: TextStyle(
                                      color: ForgeTokens.of(context).onSurfaceVariant,
                                    ),
                                  ),
                                )
                              : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: filteredItems.length,
                            itemBuilder: (_, i) {
                              final item = filteredItems[i] as Map<String, dynamic>;
                              final video = item['video'] as Map<String, dynamic>?;
                              final videoId =
                                  item['videoId'] as String? ?? video?['id'] as String?;
                              final originalIndex = items.indexWhere((raw) {
                                if (raw is! Map) return false;
                                final m = Map<String, dynamic>.from(raw);
                                final id = m['videoId'] as String? ??
                                    (m['video'] as Map?)?['id'] as String?;
                                return id != null && id == videoId;
                              });
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
                                      if (isOwner && !filtering && originalIndex >= 0) ...[
                                        IconButton(
                                          icon: Icon(Icons.arrow_upward, size: 18),
                                          tooltip: 'Move up',
                                          onPressed: originalIndex == 0
                                              ? null
                                              : () => _moveItem(originalIndex, -1),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.arrow_downward, size: 18),
                                          tooltip: 'Move down',
                                          onPressed: originalIndex >= items.length - 1
                                              ? null
                                              : () => _moveItem(originalIndex, 1),
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
