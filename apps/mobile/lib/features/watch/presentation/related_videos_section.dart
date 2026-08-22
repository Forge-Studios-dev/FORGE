import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';
import '../data/watch_repository.dart';
import 'watch_screen.dart';

/// "Up next" rail backed by the content-based related recommendations endpoint
/// (`GET /videos/:id/related`). Best-effort: silently hides if nothing relevant.
class RelatedVideosSection extends ConsumerStatefulWidget {
  final String videoId;
  final String? playlistId;
  final bool shuffle;
  const RelatedVideosSection({
    required this.videoId,
    this.playlistId,
    this.shuffle = false,
  });

  @override
  ConsumerState<RelatedVideosSection> createState() => _RelatedVideosSectionState();
}

class _RelatedVideosSectionState extends ConsumerState<RelatedVideosSection> {
  List<dynamic> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant RelatedVideosSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.videoId != widget.videoId) {
      setState(() {
        _items = [];
        _loading = true;
      });
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final data = await ref.read(watchRepositoryProvider).getRelated(widget.videoId);
      if (!mounted) return;
      setState(() {
        _items = data;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Up next', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ..._items.map((raw) {
          final v = raw as Map<String, dynamic>;
          final id = v['id'] as String?;
          final user = v['user'] as Map<String, dynamic>?;
          final thumb = v['thumbnailUrl'] as String?;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: ForgeCard(
              onTap: id == null
                  ? null
                  : () => context.push(
                        watchListHref(
                          id,
                          playlistId: widget.playlistId,
                          shuffle: widget.shuffle,
                        ),
                      ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox(
                      width: 96,
                      height: 54,
                      child: thumb != null && thumb.isNotEmpty
                          ? Image.network(
                              thumb,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => ColoredBox(
                                color: ForgeTokens.of(context).surfaceContainerHigh,
                                child: Icon(Icons.play_circle_outline,
                                    color: ForgeTokens.of(context).outline),
                              ),
                            )
                          : ColoredBox(
                              color: ForgeTokens.of(context).surfaceContainerHigh,
                              child: Icon(Icons.play_circle_outline,
                                  color: ForgeTokens.of(context).outline),
                            ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          v['title'] as String? ?? 'Video',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: ForgeTokens.of(context).onSurface,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '@${user?['username'] ?? 'creator'}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: ForgeTokens.of(context).onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (id != null)
                    PopupMenuButton<String>(
                      tooltip: 'More',
                      onSelected: (value) async {
                        try {
                          final repo = ref.read(watchRepositoryProvider);
                          if (value == 'not_interested') {
                            await repo.markNotInterested(id);
                          } else if (value == 'dont_recommend') {
                            await repo.dontRecommendChannel(id);
                          }
                          if (!mounted) return;
                          setState(() {
                            _items = _items.where((item) {
                              final m = item as Map<String, dynamic>;
                              return m['id'] != id;
                            }).toList();
                          });
                        } catch (_) {
                          if (!mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Sign in to update preferences')),
                          );
                        }
                      },
                      itemBuilder: (context) => const [
                        PopupMenuItem(value: 'not_interested', child: Text('Not interested')),
                        PopupMenuItem(value: 'dont_recommend', child: Text("Don't recommend channel")),
                      ],
                      icon: const Icon(Icons.more_vert, size: 20),
                    ),
                ],
              ),
            ),
          );
        }),
        const SizedBox(height: 24),
      ],
    );
  }
}
