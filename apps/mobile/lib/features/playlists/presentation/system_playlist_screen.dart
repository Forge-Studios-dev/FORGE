import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../shared/models/video.dart';

/// System playlists: Watch later / Liked (YouTube Library shelves).
class SystemPlaylistScreen extends ConsumerStatefulWidget {
  final String kind; // watch-later | liked

  const SystemPlaylistScreen({super.key, required this.kind});

  @override
  ConsumerState<SystemPlaylistScreen> createState() => _SystemPlaylistScreenState();
}

class _SystemPlaylistScreenState extends ConsumerState<SystemPlaylistScreen> {
  List<VideoModel> _videos = [];
  bool _loading = true;
  bool _error = false;

  String get _title => widget.kind == 'liked' ? 'Liked videos' : 'Watch later';
  String get _path =>
      widget.kind == 'liked' ? '/playlists/me/liked' : '/playlists/me/watch-later';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get(_path);
      final root = response.data['data'];
      List list;
      if (root is Map && root['videos'] is List) {
        list = root['videos'] as List;
      } else if (root is Map && root['data'] is List) {
        list = root['data'] as List;
      } else if (root is List) {
        list = root;
      } else {
        list = const [];
      }
      final videos = <VideoModel>[];
      for (final item in list) {
        if (item is! Map<String, dynamic>) continue;
        final videoJson = item['video'] is Map<String, dynamic>
            ? item['video'] as Map<String, dynamic>
            : item;
        try {
          videos.add(VideoModel.fromJson(videoJson));
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_title)),
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
                  : ListView.builder(
                      itemCount: _videos.length,
                      itemBuilder: (context, index) {
                        final video = _videos[index];
                        return ListTile(
                          onTap: () => context.push('/watch/${video.id}'),
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
                        );
                      },
                    ),
    );
  }
}
