import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/public_video_path.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../core/widgets/forge_skeleton.dart';
import '../../../shared/models/video.dart';
import '../../feed/data/feed_repository.dart';

/// YouTube-parity Trending — velocity ranking with Now (24h) / This week windows.
class TrendingScreen extends ConsumerStatefulWidget {
  const TrendingScreen({super.key});

  @override
  ConsumerState<TrendingScreen> createState() => _TrendingScreenState();
}

class _TrendingScreenState extends ConsumerState<TrendingScreen> {
  final List<VideoModel> _videos = [];
  bool _initialLoading = true;
  bool _loadError = false;
  String _window = 'week';

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    setState(() {
      _initialLoading = true;
      _loadError = false;
    });
    try {
      final videos = await ref.read(feedRepositoryProvider).getVelocityTrending(window: _window);
      if (!mounted) return;
      setState(() {
        _videos
          ..clear()
          ..addAll(videos);
        _initialLoading = false;
      });
    } catch (_) {
      // Fallback to popular feed if velocity endpoint fails.
      try {
        final page = await ref.read(feedRepositoryProvider).getTrendingFeed();
        if (!mounted) return;
        setState(() {
          _videos
            ..clear()
            ..addAll(page.videos);
          _initialLoading = false;
        });
      } catch (_) {
        if (mounted) {
          setState(() {
            _loadError = true;
            _initialLoading = false;
          });
        }
      }
    }
  }

  void _setWindow(String window) {
    if (_window == window) return;
    setState(() => _window = window);
    _loadInitial();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = ForgeTokens.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Trending')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                ChoiceChip(
                  label: const Text('Now'),
                  selected: _window == 'now',
                  onSelected: (_) => _setWindow('now'),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('This week'),
                  selected: _window == 'week',
                  onSelected: (_) => _setWindow('week'),
                ),
              ],
            ),
          ),
          Expanded(
            child: _initialLoading
                ? ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: 6,
                    itemBuilder: (_, __) => const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: ForgeSkeleton(height: 88),
                    ),
                  )
                : _loadError
                    ? ForgeEmptyState(
                        icon: Icons.error_outline,
                        title: 'Couldn’t load trending',
                        description: 'Check your connection and try again.',
                        actionLabel: 'Retry',
                        onAction: _loadInitial,
                      )
                    : _videos.isEmpty
                        ? const ForgeEmptyState(
                            icon: Icons.trending_up,
                            title: 'No trending videos yet',
                            description: 'Check back soon for popular uploads.',
                          )
                        : RefreshIndicator(
                            onRefresh: _loadInitial,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                              itemCount: _videos.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 12),
                              itemBuilder: (context, i) {
                                final v = _videos[i];
                                return Semantics(
                                  button: true,
                                  label: '${v.title} by ${v.user.displayName}',
                                  child: InkWell(
                                    onTap: () => context.push(
                                      publicVideoPath(id: v.id, videoType: v.videoType),
                                    ),
                                    borderRadius: BorderRadius.circular(12),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(10),
                                          child: SizedBox(
                                            width: 140,
                                            height: 78,
                                            child: v.thumbnailUrl != null &&
                                                    v.thumbnailUrl!.isNotEmpty
                                                ? CachedNetworkImage(
                                                    imageUrl: v.thumbnailUrl!,
                                                    fit: BoxFit.cover,
                                                  )
                                                : ColoredBox(color: tokens.surfaceContainerHigh),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                v.title,
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                  color: tokens.onSurface,
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                v.user.displayName,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  color: tokens.onSurfaceVariant,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
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
