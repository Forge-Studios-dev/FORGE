import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../data/feed_repository.dart';
import '../../../shared/models/video.dart';
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
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
        ],
      ),
      body: feedAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load feed: $e')),
        data: (videos) {
          if (videos.isEmpty) {
            return const Center(child: Text('No videos yet. Check back soon!'));
          }
          return PageView.builder(
            controller: _pageController,
            scrollDirection: Axis.vertical,
            itemCount: videos.length,
            itemBuilder: (context, index) => _VideoCard(video: videos[index]),
          );
        },
      ),
    );
  }
}

class _VideoCard extends StatelessWidget {
  final VideoModel video;
  const _VideoCard({required this.video});

  @override
  Widget build(BuildContext context) {
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
                _ActionButton(icon: Icons.favorite_border, count: video.likeCount, onTap: () {}),
                const SizedBox(height: 16),
                _ActionButton(icon: Icons.comment_outlined, count: video.commentCount, onTap: () {}),
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
