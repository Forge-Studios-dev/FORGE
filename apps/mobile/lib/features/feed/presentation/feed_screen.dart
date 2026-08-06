import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/navigation/public_video_path.dart';
import '../../../core/network/api_client.dart';
import '../../../core/widgets/forge_skeleton.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/motion/forge_motion.dart';
import '../../../shared/models/video.dart';
import '../../history/data/history_repository.dart';
import '../../library/presentation/library_screen.dart';
import '../../watch/data/watch_repository.dart';
import '../data/feed_repository.dart';

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
  bool _initialLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) return;
      if (_tabController.index != _tabIndex) {
        setState(() {
          _tabIndex = _tabController.index;
          _initialLoading = true;
          _videos.clear();
        });
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
          indicatorColor: ForgeTokens.of(context).primary,
          labelColor: ForgeTokens.of(context).onSurface,
          unselectedLabelColor: ForgeTokens.of(context).onSurfaceVariant,
          tabs: const [
            Tab(text: 'For you'),
            Tab(text: 'Subscriptions'),
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
          IconButton(
            icon: const Icon(Icons.subscriptions_outlined),
            tooltip: 'Subscriptions',
            onPressed: () => context.push('/subscriptions'),
          ),
          Builder(
            builder: (context) {
              final unread = ref.watch(libraryUnreadCountProvider).maybeWhen(
                    data: (c) => c,
                    orElse: () => 0,
                  );
              return IconButton(
                tooltip: 'Notifications',
                onPressed: () => context.push('/notifications'),
                icon: Badge(
                  isLabelVisible: unread > 0,
                  label: Text(unread > 99 ? '99+' : '$unread'),
                  child: const Icon(Icons.notifications_outlined),
                ),
              );
            },
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
                  onAction: () {
                    setState(() => _initialLoading = true);
                    _loadInitial();
                  },
                )
              : _initialLoading
                  ? const FeedSkeletonList(count: 2)
                  : ForgeEmptyState(
                      icon: _tabIndex == 1 ? Icons.subscriptions_outlined : Icons.video_library_outlined,
                      title: _tabIndex == 1 ? 'No subscriptions yet' : 'Your feed is empty',
                      description: _tabIndex == 1
                          ? 'Subscribe to channels to see their latest videos here.'
                          : 'Check back soon for new uploads.',
                      actionLabel: _tabIndex == 1 ? 'Explore' : 'Retry',
                      onAction: _tabIndex == 1
                          ? () => context.push('/explore')
                          : () {
                              setState(() => _initialLoading = true);
                              _loadInitial();
                            },
                    ))
          : Column(
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
                    itemCount: _videos.length,
                    itemBuilder: (context, index) {
                      final video = _videos[index];
                      return _VideoCard(
                        video: video,
                        onHidden: () {
                          setState(() {
                            _videos.removeWhere((v) => v.id == video.id);
                          });
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
    );
  }
}

class _ContinueTile extends ConsumerWidget {
  final VideoModel video;
  const _ContinueTile({required this.video});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = video.viewerProgressSeconds;
    final duration = video.durationSeconds;
    final progressFrac =
        (progress != null && duration != null && duration > 0) ? (progress / duration).clamp(0.0, 1.0) : null;
    final href = publicVideoPath(
      id: video.id,
      videoType: video.videoType,
      progressSeconds: (progress != null &&
              progress > 0 &&
              duration != null &&
              duration > 0 &&
              progress < duration * 0.95)
          ? progress
          : null,
    );

    return SizedBox(
      width: 168,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Stack(
          fit: StackFit.expand,
          children: [
            GestureDetector(
              onTap: () => context.push(href),
              child: video.thumbnailUrl != null
                  ? CachedNetworkImage(
                      imageUrl: video.thumbnailUrl!,
                      fit: BoxFit.cover,
                      placeholder: (_, __) =>
                          Container(color: ForgeTokens.of(context).surfaceContainerHighest),
                      errorWidget: (_, __, ___) =>
                          Container(color: ForgeTokens.of(context).surfaceContainerHighest),
                    )
                  : Container(color: ForgeTokens.of(context).surfaceContainerHighest),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.black87],
                ),
              ),
            ),
            if (progressFrac != null)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: LinearProgressIndicator(
                  value: progressFrac,
                  minHeight: 3,
                  backgroundColor: Colors.black38,
                  color: ForgeTokens.of(context).primary,
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
            Positioned(
              top: 4,
              right: 4,
              child: Material(
                color: Colors.black54,
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () async {
                    try {
                      await ref.read(historyRepositoryProvider).removeFromWatchHistory(video.id);
                      ref.invalidate(continueWatchingProvider);
                    } catch (_) {
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Could not remove')),
                      );
                    }
                  },
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(Icons.close, size: 16, color: Colors.white),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VideoCard extends ConsumerStatefulWidget {
  final VideoModel video;
  final VoidCallback? onHidden;
  const _VideoCard({required this.video, this.onHidden});

  @override
  ConsumerState<_VideoCard> createState() => _VideoCardState();
}

class _VideoCardState extends ConsumerState<_VideoCard> {
  late bool _liked;
  late int _likeCount;
  bool _inWatchLater = false;

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

  Future<void> _share() async {
    final video = widget.video;
    final path = publicVideoPath(id: video.id, videoType: video.videoType);
    final url = '${AppConstants.webBaseUrl}$path';
    await SharePlus.instance.share(ShareParams(text: '${video.title}\n$url'));
  }

  Future<void> _notInterested() async {
    try {
      await ref.read(watchRepositoryProvider).markNotInterested(widget.video.id);
      widget.onHidden?.call();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("We'll show fewer videos like this")),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to update preferences')),
        );
      }
    }
  }

  Future<void> _dontRecommend() async {
    try {
      await ref.read(watchRepositoryProvider).dontRecommendChannel(widget.video.id);
      widget.onHidden?.call();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Channel won't be recommended")),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to update preferences')),
        );
      }
    }
  }

  Future<void> _toggleWatchLater() async {
    final next = !_inWatchLater;
    try {
      if (next) {
        await ref.read(watchRepositoryProvider).addToWatchLater(widget.video.id);
      } else {
        await ref.read(watchRepositoryProvider).removeFromWatchLater(widget.video.id);
      }
      if (!mounted) return;
      setState(() => _inWatchLater = next);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(next ? 'Saved to Watch later' : 'Removed from Watch later'),
        ),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to use Watch later')),
        );
      }
    }
  }

  Future<void> _report() async {
    const reasons = [
      'Spam or misleading',
      'Hate speech or harassment',
      'Sexual content',
      'Violent or repulsive content',
      'Other',
    ];
    final reason = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(title: Text('Report', style: TextStyle(fontWeight: FontWeight.w600))),
            ...reasons.map(
              (r) => ListTile(title: Text(r), onTap: () => Navigator.pop(ctx, r)),
            ),
          ],
        ),
      ),
    );
    if (reason == null) return;
    try {
      await ref.read(watchRepositoryProvider).reportVideo(
            videoId: widget.video.id,
            reason: reason,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report submitted')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to report')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final video = widget.video;
    return GestureDetector(
      onTap: () => context.push(publicVideoPath(id: video.id, videoType: video.videoType)),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (video.thumbnailUrl != null)
            CachedNetworkImage(
              imageUrl: video.thumbnailUrl!,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(color: ForgeTokens.of(context).surfaceContainerHigh),
              errorWidget: (_, __, ___) => Container(color: ForgeTokens.of(context).surfaceContainerHigh),
            )
          else
            Container(color: ForgeTokens.of(context).surfaceContainerHigh),

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
            top: 12,
            right: 8,
            child: PopupMenuButton<String>(
              tooltip: 'More',
              color: ForgeTokens.of(context).surfaceContainerHigh,
              onSelected: (value) {
                if (value == 'not_interested') _notInterested();
                if (value == 'dont_recommend') _dontRecommend();
                if (value == 'watch_later') _toggleWatchLater();
                if (value == 'share') _share();
                if (value == 'report') _report();
              },
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: 'watch_later',
                  child: Text(
                    _inWatchLater ? 'Remove from Watch later' : 'Save to Watch later',
                  ),
                ),
                const PopupMenuItem(value: 'share', child: Text('Share')),
                const PopupMenuItem(value: 'not_interested', child: Text('Not interested')),
                const PopupMenuItem(
                  value: 'dont_recommend',
                  child: Text("Don't recommend channel"),
                ),
                const PopupMenuItem(value: 'report', child: Text('Report')),
              ],
              icon: const Icon(Icons.more_vert, color: Colors.white),
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
                  icon: _liked ? Icons.thumb_up : Icons.thumb_up_outlined,
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
                _ActionButton(icon: Icons.share_outlined, count: 0, onTap: _share),
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
