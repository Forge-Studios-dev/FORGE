import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../data/feed_repository.dart';
import '../../history/data/history_repository.dart';
import '../../../shared/models/video.dart';
import '../../../core/widgets/forge_skeleton.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/motion/forge_motion.dart';
import '../../gamification/data/gamification_repository.dart';
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

class _FeedScreenState extends ConsumerState<FeedScreen> with SingleTickerProviderStateMixin {
  final _pageController = PageController();
  final List<VideoModel> _videos = [];
  String? _nextCursor;
  bool _loadingMore = false;
  bool _hasMore = true;
  late TabController _tabController;
  int _tabIndex = 0;
  bool _loadError = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) return;
      if (_tabController.index != _tabIndex) {
        setState(() => _tabIndex = _tabController.index);
        _loadInitial();
      }
    });
    _loadInitial();
    _pageController.addListener(_onPageScroll);
  }

  Future<void> _loadInitial() async {
    try {
      final repo = ref.read(feedRepositoryProvider);
      final page = _tabIndex == 1
          ? await repo.getFollowingFeed()
          : await repo.getFeed();
      if (!mounted) return;
      setState(() {
        _videos
          ..clear()
          ..addAll(page.videos);
        _nextCursor = page.nextCursor;
        _hasMore = page.nextCursor != null;
        _loadError = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadError = true);
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final repo = ref.read(feedRepositoryProvider);
      final page = _tabIndex == 1
          ? await repo.getFollowingFeed(cursor: _nextCursor)
          : await repo.getFeed(cursor: _nextCursor);
      if (!mounted) return;
      setState(() {
        _videos.addAll(page.videos);
        _nextCursor = page.nextCursor;
        _hasMore = page.nextCursor != null;
      });
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _onPageScroll() {
    if (!_pageController.hasClients) return;
    final page = _pageController.page?.round() ?? 0;
    if (page >= _videos.length - 2) {
      _loadMore();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _pageController.removeListener(_onPageScroll);
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cwAsync = ref.watch(continueWatchingProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('FORGE', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 22)),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: ForgeTokens.primary,
          labelColor: ForgeTokens.onSurface,
          unselectedLabelColor: ForgeTokens.onSurfaceVariant,
          tabs: const [
            Tab(text: 'Discover'),
            Tab(text: 'Following'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              _loadInitial();
              ref.invalidate(continueWatchingProvider);
            },
          ),
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => context.push('/search'),
          ),
        ],
      ),
      body: _videos.isEmpty
          ? (_loadError
              ? ForgeEmptyState(
                  icon: Icons.wifi_off,
                  title: 'Could not load feed',
                  description: 'Check your connection and try again.',
                  actionLabel: 'Retry',
                  onAction: _loadInitial,
                )
              : const FeedSkeletonList(count: 2))
          : Column(
              children: [
                const _StreakXpChip(),
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
                    itemCount: _videos.length,
                    itemBuilder: (context, index) => _VideoCard(video: _videos[index]),
                  ),
                ),
              ],
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

class _VideoCard extends ConsumerStatefulWidget {
  final VideoModel video;
  const _VideoCard({required this.video});

  @override
  ConsumerState<_VideoCard> createState() => _VideoCardState();
}

class _VideoCardState extends ConsumerState<_VideoCard> {
  late bool _liked;
  late int _likeCount;

  @override
  void initState() {
    super.initState();
    _liked = widget.video.viewerLiked;
    _likeCount = widget.video.likeCount;
  }

  Future<void> _toggleLike() async {
    final wasLiked = _liked;
    setState(() {
      _liked = !wasLiked;
      _likeCount += wasLiked ? -1 : 1;
    });
    try {
      final client = ref.read(apiClientProvider);
      if (wasLiked) {
        await client.dio.delete('/videos/${widget.video.id}/like');
      } else {
        await client.dio.post('/videos/${widget.video.id}/like');
      }
    } catch (_) {
      setState(() {
        _liked = wasLiked;
        _likeCount += wasLiked ? 1 : -1;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to like videos')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final video = widget.video;
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

          Positioned(
            bottom: 80,
            right: 12,
            child: Column(
              children: [
                _ActionButton(
                  icon: _liked ? Icons.favorite : Icons.favorite_border,
                  count: _likeCount,
                  onTap: _toggleLike,
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

/// Persistent streak/XP chip fed by the existing platform-wide gamification
/// endpoint (GET /platform/gamification/me — apps/api gamification
/// module), reused here rather than a new backend contract. Best-effort:
/// hides silently on loading/error (e.g. guest browsing without a session),
/// same pattern as the other feed sections below.
class _StreakXpChip extends ConsumerWidget {
  const _StreakXpChip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final xpAsync = ref.watch(platformXpProvider);
    return xpAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (profile) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: ForgeTokens.surfaceContainer.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: ForgeTokens.outlineVariant.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.local_fire_department, size: 16, color: ForgeTokens.tertiary),
                const SizedBox(width: 4),
                Text(
                  '${profile.streak}d streak',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: ForgeTokens.onSurface),
                ),
                const SizedBox(width: 10),
                const Icon(Icons.bolt, size: 16, color: ForgeTokens.secondary),
                const SizedBox(width: 4),
                Text(
                  '${profile.xp} XP · Lvl ${profile.level}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: ForgeTokens.onSurface),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
