import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/navigation/public_video_path.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../shared/models/video.dart';

/// Private Disliked videos shelf (YouTube Library parity).
class DislikedVideosScreen extends ConsumerStatefulWidget {
  const DislikedVideosScreen({super.key});

  @override
  ConsumerState<DislikedVideosScreen> createState() => _DislikedVideosScreenState();
}

class _DislikedVideosScreenState extends ConsumerState<DislikedVideosScreen> {
  List<VideoModel> _videos = [];
  bool _loading = true;
  bool _error = false;
  bool _clearing = false;
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
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get(
        '/me/disliked-videos',
        queryParameters: {'limit': 100},
      );
      final root = response.data['data'];
      List list;
      if (root is Map && root['data'] is List) {
        list = root['data'] as List;
      } else if (root is List) {
        list = root;
      } else {
        list = const [];
      }
      final videos = <VideoModel>[];
      for (final item in list) {
        if (item is! Map<String, dynamic>) continue;
        try {
          videos.add(VideoModel.fromJson(item));
        } catch (_) {
          /* skip malformed */
        }
      }
      if (!mounted) return;
      setState(() {
        _videos = videos;
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

  Future<void> _remove(VideoModel video) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/videos/${video.id}/dislike');
      if (!mounted) return;
      setState(() {
        _videos = _videos.where((v) => v.id != video.id).toList();
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not remove dislike')),
      );
    }
  }

  Future<void> _clearAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear disliked videos?'),
        content: const Text('Remove your dislike from every video on this list?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Clear all')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _clearing = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/me/disliked-videos');
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
        title: const Text('Disliked videos'),
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
                  title: 'Couldn’t load disliked videos',
                  description: 'Sign in and try again.',
                  actionLabel: 'Retry',
                  onAction: _load,
                )
              : _videos.isEmpty
                  ? const ForgeEmptyState(
                      icon: Icons.thumb_down_outlined,
                      title: 'No disliked videos',
                      description: 'Videos you dislike will show up here. This list is private.',
                    )
                  : Column(
                      children: [
                        if (_videos.length > 3)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                            child: TextField(
                              controller: _itemSearchCtrl,
                              onChanged: (v) => setState(() => _itemQuery = v),
                              decoration: InputDecoration(
                                hintText: 'Search disliked videos',
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
                                    return Dismissible(
                                      key: ValueKey(video.id),
                                      direction: DismissDirection.endToStart,
                                      background: Container(
                                        alignment: Alignment.centerRight,
                                        padding: const EdgeInsets.only(right: 20),
                                        color: ForgeTokens.of(context).error.withValues(alpha: 0.15),
                                        child: Icon(
                                          Icons.delete_outline,
                                          color: ForgeTokens.of(context).error,
                                        ),
                                      ),
                                      confirmDismiss: (_) async {
                                        await _remove(video);
                                        return false;
                                      },
                                      child: ListTile(
                                        onTap: () => context.push(publicVideoPath(id: video.id, videoType: video.videoType)),
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
                                                    color: ForgeTokens.of(context)
                                                        .surfaceContainerHigh,
                                                    child: Icon(
                                                      Icons.play_arrow,
                                                      color: ForgeTokens.of(context)
                                                          .onSurfaceVariant,
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
                                          tooltip: 'Remove dislike',
                                          icon: const Icon(Icons.close),
                                          onPressed: () => _remove(video),
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
