import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../data/feed_repository.dart';
import '../../history/data/history_repository.dart';
import '../../../shared/models/video.dart';
import '../../../core/widgets/forge_skeleton.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/motion/forge_motion.dart';
import 'package:cached_network_image/cached_network_image.dart';

final feedProvider = FutureProvider.autoDispose<List<VideoModel>>((ref) async {
  final repo = ref.read(feedRepositoryProvider);
  final page = await repo.getFeed();
  return page.videos;
});

class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends ConsumerState<FeedScreen> {
  final _pageController = PageController();

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final feedAsync = ref.watch(feedProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('FORGE', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 22)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(feedProvider);
              ref.invalidate(continueWatchingProvider);
            },
          ),
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => context.go('/explore'),
          ),
        ],
      ),
      body: feedAsync.when(
        loading: () => const FeedSkeletonList(count: 2),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48, color: ForgeTokens.error),
                const SizedBox(height: 12),
                const Text('Failed to load feed', style: TextStyle(fontWeight: FontWeight.w600, color: ForgeTokens.onSurface)),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () {
                    ref.invalidate(feedProvider);
                    ref.invalidate(continueWatchingProvider);
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (videos) {
          if (videos.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'No videos yet. Explore skills or check back soon!',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                ),
              ),
            );
          }
          final cwAsync = ref.watch(continueWatchingProvider);
          return Column(
            children: [
              cwAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (cwVideos) {
                  if (cwVideos.isEmpty) return const SizedBox.shrink();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
                        child: Text(
                          'Continue watching',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                        ),
                      ),
                      SizedBox(
                        height: 120,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          itemCount: cwVideos.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 10),
                          itemBuilder: (context, index) {
                            final v = cwVideos[index];
                            return ForgeMotion.fadeIn(
                              index: index,
                              child: _ContinueTile(video: v),
                            );
                          },
                        ),
                      ),
                    ],
                  );
                },
              ),
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  scrollDirection: Axis.vertical,
                  itemCount: videos.length,
                  itemBuilder: (context, index) => _VideoCard(video: videos[index]),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ContinueTile extends StatelessWidget {
  final VideoModel video;
  const _ContinueTile({required this.video});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 168,
      child: GestureDetector(
        onTap: () => context.push('/watch/${video.id}'),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (video.thumbnailUrl != null)
                CachedNetworkImage(
                  imageUrl: video.thumbnailUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(color: const Color(0xFF1A1A24)),
                  errorWidget: (_, __, ___) => Container(color: const Color(0xFF1A1A24)),
                )
              else
                Container(color: const Color(0xFF1A1A24)),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black87],
                  ),
                ),
              ),
              Positioned(
                left: 8,
                right: 8,
                bottom: 8,
                child: Text(
                  video.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VideoCard extends ConsumerWidget {
  final VideoModel video;
  const _VideoCard({required this.video});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () => context.push('/watch/${video.id}'),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (video.thumbnailUrl != null)
            CachedNetworkImage(
              imageUrl: video.thumbnailUrl!,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(color: const Color(0xFF13131A)),
              errorWidget: (_, __, ___) => Container(color: const Color(0xFF13131A)),
            )
          else
            Container(color: const Color(0xFF13131A)),

          // Gradient overlay
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Colors.black87],
                stops: [0.5, 1.0],
              ),
            ),
          ),

          // Content overlay
          Positioned(
            bottom: 80,
            left: 16,
            right: 70,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '@${video.user.username}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                ),
                const SizedBox(height: 6),
                Text(
                  video.title,
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),

          // Action buttons
          Positioned(
            bottom: 80,
            right: 12,
            child: Column(
              children: [
                _ActionButton(
                  icon: Icons.favorite_border,
                  count: video.likeCount,
                  onTap: () async {
                    try {
                      await ref.read(apiClientProvider).dio.post('/videos/${video.id}/like');
                    } catch (_) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Sign in to like videos')),
                        );
                      }
                    }
                  },
                ),
                const SizedBox(height: 16),
                _ActionButton(
                  icon: Icons.comment_outlined,
                  count: video.commentCount,
                  onTap: () => context.push('/watch/${video.id}'),
                ),
                const SizedBox(height: 16),
                _ActionButton(icon: Icons.share_outlined, count: 0, onTap: () {}),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final int count;
  final VoidCallback onTap;

  const _ActionButton({required this.icon, required this.count, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Icon(icon, color: Colors.white, size: 28),
          const SizedBox(height: 4),
          Text(
            count > 999 ? '${(count / 1000).toStringAsFixed(1)}K' : count.toString(),
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
