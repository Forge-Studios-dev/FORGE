import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../shared/models/video.dart';
import '../../feed/data/feed_repository.dart';
import '../../watch/data/watch_repository.dart';
import '../../watch/presentation/player_captions_overlay.dart';
import '../../watch/presentation/save_to_playlist_sheet.dart';

class ShortsScreen extends ConsumerStatefulWidget {
  const ShortsScreen({super.key, this.initialVideoId});

  /// Shared deep link (`/shorts?v=`).
  final String? initialVideoId;

  @override
  ConsumerState<ShortsScreen> createState() => _ShortsScreenState();
}

class _ShortsScreenState extends ConsumerState<ShortsScreen> {
  final _pageController = PageController();
  final List<VideoModel> _videos = [];
  String? _nextCursor;
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  bool _error = false;
  bool _deepLinkUnavailable = false;
  int _activeIndex = 0;

  bool _isShort(VideoModel v) {
    if (v.videoType == 'short') return true;
    final d = v.durationSeconds;
    return d != null && d > 0 && d <= 60;
  }

  @override
  void initState() {
    super.initState();
    _loadInitial();
    _pageController.addListener(() {
      final page = _pageController.page?.round() ?? 0;
      if (page != _activeIndex && mounted) {
        setState(() => _activeIndex = page);
      }
      if (page >= _videos.length - 2) _loadMore();
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    setState(() {
      _loading = true;
      _error = false;
      _deepLinkUnavailable = false;
    });
    try {
      final page = await ref.read(feedRepositoryProvider).getShortsFeed();
      VideoModel? pinned;
      var deepLinkBlocked = false;
      final deepLink = widget.initialVideoId?.trim();
      if (deepLink != null && deepLink.isNotEmpty) {
        try {
          final fetched = await ref.read(watchRepositoryProvider).getVideo(deepLink);
          if (_isShort(fetched)) pinned = fetched;
        } on DioException catch (e) {
          deepLinkBlocked = e.response?.statusCode == 403;
        } catch (_) {
          /* fall through to feed only */
        }
      }
      if (!mounted) return;
      final list = <VideoModel>[...page.videos];
      if (pinned != null) {
        list.removeWhere((v) => v.id == pinned!.id);
        list.insert(0, pinned);
      }
      setState(() {
        _videos
          ..clear()
          ..addAll(list);
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
        _loading = false;
        _activeIndex = 0;
        _deepLinkUnavailable = deepLinkBlocked && pinned == null && list.isEmpty;
      });
      if (pinned != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_pageController.hasClients) {
            _pageController.jumpToPage(0);
          }
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final page = await ref.read(feedRepositoryProvider).getShortsFeed(cursor: _nextCursor);
      if (!mounted) return;
      setState(() {
        _videos.addAll(page.videos);
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
      });
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error) {
      return Scaffold(
        backgroundColor: ForgeTokens.of(context).background,
        appBar: AppBar(title: const Text('Shorts')),
        body: ForgeEmptyState(
          icon: Icons.error_outline,
          title: 'Couldn’t load Shorts',
          description: 'Check your connection and try again.',
          actionLabel: 'Retry',
          onAction: _loadInitial,
        ),
      );
    }
    if (_deepLinkUnavailable) {
      return Scaffold(
        backgroundColor: ForgeTokens.of(context).background,
        appBar: AppBar(title: const Text('Shorts')),
        body: ForgeEmptyState(
          icon: Icons.block,
          title: 'This Short is not available',
          description: 'Playback is restricted for this video on your account.',
          actionLabel: 'Explore',
          onAction: () => context.go('/explore'),
        ),
      );
    }
    if (_videos.isEmpty) {
      return Scaffold(
        backgroundColor: ForgeTokens.of(context).background,
        appBar: AppBar(title: const Text('Shorts')),
        body: ForgeEmptyState(
          icon: Icons.movie_filter_outlined,
          title: 'No Shorts yet',
          description: 'Vertical videos from creators will show up here.',
          actionLabel: 'Explore',
          onAction: () => context.go('/explore'),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          PageView.builder(
            controller: _pageController,
            scrollDirection: Axis.vertical,
            itemCount: _videos.length,
            itemBuilder: (context, index) {
              final video = _videos[index];
              return _ShortSlide(
                video: video,
                active: index == _activeIndex,
                onOpenWatch: () => context.push('/watch/${video.id}'),
                onHidden: () {
                  setState(() {
                    _videos.removeWhere((v) => v.id == video.id);
                    if (_activeIndex >= _videos.length && _videos.isNotEmpty) {
                      _activeIndex = _videos.length - 1;
                    }
                  });
                },
              );
            },
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topLeft,
              child: IconButton(
                tooltip: 'Back',
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/feed');
                  }
                },
                icon: const Icon(Icons.arrow_back, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ShortSlide extends ConsumerStatefulWidget {
  final VideoModel video;
  final bool active;
  final VoidCallback onOpenWatch;
  final VoidCallback? onHidden;

  const _ShortSlide({
    required this.video,
    required this.active,
    required this.onOpenWatch,
    this.onHidden,
  });

  @override
  ConsumerState<_ShortSlide> createState() => _ShortSlideState();
}

class _ShortSlideState extends ConsumerState<_ShortSlide> {
  VideoPlayerController? _controller;
  bool _initFailed = false;
  late bool _liked;
  late int _likeCount;
  late bool _disliked;
  late bool _subscribed;
  bool _busy = false;
  bool _heartBurst = false;
  DateTime? _lastTap;
  int _positionSeconds = 0;
  bool _inWatchLater = false;

  void _onControllerTick() {
    final c = _controller;
    if (c == null || !mounted) return;
    final sec = c.value.position.inSeconds;
    if (sec != _positionSeconds) setState(() => _positionSeconds = sec);
  }

  Future<void> _loadWatchLater() async {
    try {
      final inList = await ref.read(watchRepositoryProvider).isInWatchLater(widget.video.id);
      if (mounted) setState(() => _inWatchLater = inList);
    } catch (_) {}
  }

  @override
  void initState() {
    super.initState();
    _liked = widget.video.viewerLiked;
    _likeCount = widget.video.likeCount;
    _disliked = widget.video.viewerDisliked;
    _subscribed = widget.video.viewerSubscribed || widget.video.user.viewerFollowing;
    if (widget.active) {
      _ensurePlayer();
      _loadWatchLater();
    }
  }

  @override
  void didUpdateWidget(covariant _ShortSlide oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.video.id != oldWidget.video.id) {
      _liked = widget.video.viewerLiked;
      _likeCount = widget.video.likeCount;
      _disliked = widget.video.viewerDisliked;
      _subscribed = widget.video.viewerSubscribed || widget.video.user.viewerFollowing;
      _inWatchLater = false;
      if (widget.active) _loadWatchLater();
    }
    if (widget.active && !oldWidget.active) {
      _ensurePlayer();
      _loadWatchLater();
    } else if (!widget.active && oldWidget.active) {
      _pauseAndDispose();
    } else if (widget.active && widget.video.id != oldWidget.video.id) {
      _pauseAndDispose();
      _ensurePlayer();
    }
  }

  Future<void> _toggleLike() async {
    if (_busy) return;
    final next = !_liked;
    final wasDisliked = _disliked;
    setState(() {
      _busy = true;
      _liked = next;
      _likeCount = (_likeCount + (next ? 1 : -1)).clamp(0, 1 << 30);
      if (next) _disliked = false;
    });
    try {
      await ref.read(watchRepositoryProvider).setVideoLiked(widget.video.id, liked: next);
    } catch (_) {
      if (mounted) {
        setState(() {
          _liked = !next;
          _likeCount = (_likeCount + (next ? -1 : 1)).clamp(0, 1 << 30);
          _disliked = wasDisliked;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _onDoubleTapLike() {
    setState(() => _heartBurst = true);
    Future<void>.delayed(const Duration(milliseconds: 700), () {
      if (mounted) setState(() => _heartBurst = false);
    });
    if (!_liked) _toggleLike();
  }

  void _onTapPlayPause() {
    final now = DateTime.now();
    final last = _lastTap;
    _lastTap = now;
    if (last != null && now.difference(last).inMilliseconds < 320) {
      // Double-tap handled by onDoubleTap; ignore second single.
      return;
    }
    final c = _controller;
    if (c == null || !c.value.isInitialized) return;
    if (c.value.isPlaying) {
      c.pause();
    } else {
      c.play();
    }
  }

  Future<void> _toggleDislike() async {
    if (_busy) return;
    final next = !_disliked;
    final wasLiked = _liked;
    final prevCount = _likeCount;
    setState(() {
      _busy = true;
      _disliked = next;
      if (next && _liked) {
        _liked = false;
        _likeCount = (_likeCount - 1).clamp(0, 1 << 30);
      }
    });
    try {
      await ref.read(watchRepositoryProvider).setVideoDisliked(widget.video.id, disliked: next);
    } catch (_) {
      if (mounted) {
        setState(() {
          _disliked = !next;
          _liked = wasLiked;
          _likeCount = prevCount;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _share() async {
    final video = widget.video;
    final url = '${AppConstants.webBaseUrl}/shorts?v=${video.id}';
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: ForgeTokens.of(context).surfaceContainerHigh,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.share_outlined),
                  title: const Text('Share'),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await SharePlus.instance.share(
                      ShareParams(text: '${video.title}\n$url'),
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.link),
                  title: const Text('Copy link'),
                  onTap: () async {
                    await Clipboard.setData(ClipboardData(text: url));
                    if (ctx.mounted) Navigator.pop(ctx);
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Link copied')),
                    );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _openComments() async {
    final videoId = widget.video.id;
    final ctrl = TextEditingController();
    List<dynamic> comments = [];
    var loading = true;
    var loadStarted = false;
    String? replyToId;
    String? replyToName;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: ForgeTokens.of(context).surfaceContainerHigh,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        bool stillMounted() => ctx.mounted;
        return StatefulBuilder(
          builder: (ctx, setModal) {
            if (loading && !loadStarted) {
              loadStarted = true;
              ref.read(watchRepositoryProvider).getComments(videoId).then((page) {
                if (!stillMounted()) return;
                setModal(() {
                  comments = page.comments;
                  loading = false;
                });
              }).catchError((_) {
                if (stillMounted()) setModal(() => loading = false);
              });
            }

            Future<void> post() async {
              final text = ctrl.text.trim();
              if (text.isEmpty) return;
              try {
                await ref.read(watchRepositoryProvider).postComment(
                      videoId,
                      content: text,
                      parentId: replyToId,
                    );
                ctrl.clear();
                setModal(() {
                  replyToId = null;
                  replyToName = null;
                });
                final page = await ref.read(watchRepositoryProvider).getComments(videoId);
                if (!stillMounted()) return;
                setModal(() => comments = page.comments);
              } catch (_) {
                if (stillMounted()) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Sign in to comment')),
                  );
                }
              }
            }

            Future<void> toggleLike(Map<String, dynamic> comment) async {
              final id = comment['id'] as String?;
              if (id == null) return;
              final liked = comment['viewerLiked'] == true;
              try {
                await ref.read(watchRepositoryProvider).setCommentLiked(
                      videoId,
                      id,
                      liked: liked,
                    );
                final page = await ref.read(watchRepositoryProvider).getComments(videoId);
                if (!stillMounted()) return;
                setModal(() => comments = page.comments);
              } catch (_) {
                if (stillMounted()) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Sign in to like comments')),
                  );
                }
              }
            }

            Future<void> toggleDislike(Map<String, dynamic> comment) async {
              final id = comment['id'] as String?;
              if (id == null) return;
              final disliked = comment['viewerDisliked'] == true;
              try {
                await ref.read(watchRepositoryProvider).setCommentDisliked(
                      videoId,
                      id,
                      disliked: disliked,
                    );
                final page = await ref.read(watchRepositoryProvider).getComments(videoId);
                if (!stillMounted()) return;
                setModal(() => comments = page.comments);
              } catch (_) {
                if (stillMounted()) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Sign in to dislike comments')),
                  );
                }
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.viewInsetsOf(ctx).bottom + 16,
              ),
              child: SizedBox(
                height: MediaQuery.sizeOf(ctx).height * 0.55,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Comments', style: Theme.of(ctx).textTheme.titleMedium),
                    if (replyToId != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Replying to ${replyToName ?? 'comment'}',
                              style: TextStyle(
                                fontSize: 13,
                                color: ForgeTokens.of(context).onSurfaceVariant,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: () => setModal(() {
                              replyToId = null;
                              replyToName = null;
                            }),
                            child: const Text('Cancel'),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: ctrl,
                            decoration: InputDecoration(
                              hintText: replyToId != null ? 'Add a reply…' : 'Add a comment…',
                              isDense: true,
                            ),
                          ),
                        ),
                        IconButton(onPressed: post, icon: const Icon(Icons.send)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: loading
                          ? const Center(child: CircularProgressIndicator())
                          : comments.isEmpty
                              ? Center(
                                  child: Text(
                                    'No comments yet',
                                    style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                                  ),
                                )
                              : ListView.builder(
                                  itemCount: comments.length,
                                  itemBuilder: (_, i) {
                                    final m = comments[i] as Map<String, dynamic>;
                                    final user = m['user'] as Map<String, dynamic>?;
                                    final liked = m['viewerLiked'] == true;
                                    final disliked = m['viewerDisliked'] == true;
                                    final likeCount = (m['likeCount'] as num?)?.toInt() ?? 0;
                                    return ListTile(
                                      contentPadding: EdgeInsets.zero,
                                      title: Text(user?['displayName'] as String? ?? 'User'),
                                      subtitle: Text(
                                        m['content'] as String? ?? '',
                                        style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                                      ),
                                      trailing: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          IconButton(
                                            icon: Icon(
                                              liked ? Icons.thumb_up : Icons.thumb_up_outlined,
                                              size: 18,
                                            ),
                                            onPressed: () => toggleLike(m),
                                          ),
                                          if (likeCount > 0)
                                            Text('$likeCount', style: const TextStyle(fontSize: 12)),
                                          IconButton(
                                            icon: Icon(
                                              disliked ? Icons.thumb_down : Icons.thumb_down_outlined,
                                              size: 18,
                                            ),
                                            onPressed: () => toggleDislike(m),
                                          ),
                                          IconButton(
                                            icon: const Icon(Icons.reply, size: 18),
                                            onPressed: () => setModal(() {
                                              replyToId = m['id'] as String?;
                                              replyToName = user?['displayName'] as String?;
                                            }),
                                          ),
                                        ],
                                      ),
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
    ctrl.dispose();
  }

  Future<void> _toggleSubscribe() async {
    if (_busy || widget.video.user.id.isEmpty) return;
    final next = !_subscribed;
    setState(() {
      _busy = true;
      _subscribed = next;
    });
    try {
      await ref.read(watchRepositoryProvider).setSubscribed(
            widget.video.user.id,
            subscribed: next,
          );
    } catch (_) {
      if (mounted) setState(() => _subscribed = !next);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _setNotify(String level) async {
    if (widget.video.user.id.isEmpty) return;
    try {
      await ref.read(watchRepositoryProvider).setNotifyLevel(
            widget.video.user.id,
            notifyLevel: level,
          );
      if (mounted) {
        final label = switch (level) {
          'all' => 'All',
          'personalized' => 'Personalized',
          _ => 'None',
        };
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(label)));
      }
    } catch (_) {}
  }

  Future<void> _toggleWatchLater() async {
    if (_busy) return;
    final next = !_inWatchLater;
    setState(() {
      _busy = true;
      _inWatchLater = next;
    });
    try {
      final repo = ref.read(watchRepositoryProvider);
      if (next) {
        await repo.addToWatchLater(widget.video.id);
      } else {
        await repo.removeFromWatchLater(widget.video.id);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(next ? 'Saved to Watch later' : 'Removed from Watch later')),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => _inWatchLater = !next);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to use Watch later')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _ensurePlayer() async {
    final url = widget.video.hlsUrl;
    if (url == null || url.isEmpty) return;
    if (_controller != null) {
      await _controller!.play();
      return;
    }
    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    try {
      await controller.initialize();
      await controller.setLooping(true);
      if (!mounted || !widget.active) {
        await controller.dispose();
        return;
      }
      controller.addListener(_onControllerTick);
      setState(() {
        _controller = controller;
        _initFailed = false;
        _positionSeconds = 0;
      });
      await controller.play();
    } catch (_) {
      await controller.dispose();
      if (mounted) setState(() => _initFailed = true);
    }
  }

  Future<void> _pauseAndDispose() async {
    final c = _controller;
    _controller = null;
    if (c != null) {
      c.removeListener(_onControllerTick);
      try {
        await c.pause();
      } catch (_) {}
      await c.dispose();
    }
    if (mounted) setState(() => _positionSeconds = 0);
  }

  @override
  void dispose() {
    final c = _controller;
    _controller = null;
    c?.removeListener(_onControllerTick);
    c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final video = widget.video;
    final playing = _controller != null && _controller!.value.isInitialized;

    return GestureDetector(
      onTap: _onTapPlayPause,
      onDoubleTap: _onDoubleTapLike,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (playing)
            FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: _controller!.value.size.width,
                height: _controller!.value.size.height,
                child: VideoPlayer(_controller!),
              ),
            )
          else if (video.thumbnailUrl != null && video.thumbnailUrl!.isNotEmpty)
            CachedNetworkImage(
              imageUrl: video.thumbnailUrl!,
              fit: BoxFit.cover,
            )
          else
            const ColoredBox(color: Colors.black54),
          if (playing && widget.active)
            PlayerCaptionsOverlay(
              video: video,
              videoId: video.id,
              currentSeconds: _positionSeconds,
              cueInsetBottom: 140,
              controlsOnLeft: true,
              controlsTop: MediaQuery.paddingOf(context).top + 40,
            ),
          if (widget.active && !playing && !_initFailed)
            const Center(child: CircularProgressIndicator(color: Colors.white70)),
          if (_heartBurst)
            const Center(
              child: Icon(Icons.favorite, size: 96, color: Colors.white70),
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
          Positioned(
            left: 16,
            right: 72,
            bottom: 48,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  video.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '@${video.user.username}',
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: widget.onOpenWatch,
                  style: TextButton.styleFrom(foregroundColor: Colors.white),
                  child: const Text('Open full video'),
                ),
              ],
            ),
          ),
          Positioned(
            right: 12,
            bottom: 120,
            child: Column(
              children: [
                _ShortAction(
                  icon: _liked ? Icons.thumb_up : Icons.thumb_up_outlined,
                  label: _likeCount > 0 ? '$_likeCount' : 'Like',
                  onTap: _busy ? null : _toggleLike,
                ),
                const SizedBox(height: 16),
                _ShortAction(
                  icon: _disliked ? Icons.thumb_down : Icons.thumb_down_outlined,
                  label: 'Dislike',
                  onTap: _busy ? null : _toggleDislike,
                ),
                const SizedBox(height: 16),
                _ShortAction(
                  icon: Icons.share_outlined,
                  label: 'Share',
                  onTap: _share,
                ),
                const SizedBox(height: 16),
                _ShortAction(
                  icon: Icons.chat_bubble_outline,
                  label: widget.video.commentCount > 0
                      ? '${widget.video.commentCount}'
                      : 'Comment',
                  onTap: () => _openComments(),
                ),
                const SizedBox(height: 16),
                _ShortAction(
                  icon: _inWatchLater ? Icons.bookmark : Icons.bookmark_border,
                  label: _inWatchLater ? 'Saved' : 'Save',
                  onTap: _busy ? null : _toggleWatchLater,
                ),
                const SizedBox(height: 16),
                if (widget.video.user.id.isNotEmpty)
                  _subscribed
                      ? PopupMenuButton<String>(
                          tooltip: 'Subscription options',
                          onSelected: (value) async {
                            if (value == 'unsubscribe') {
                              final ok = await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  title: const Text('Unsubscribe?'),
                                  content: const Text(
                                    'You will stop receiving updates from this channel.',
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: () => Navigator.pop(ctx, false),
                                      child: const Text('Cancel'),
                                    ),
                                    FilledButton(
                                      onPressed: () => Navigator.pop(ctx, true),
                                      child: const Text('Unsubscribe'),
                                    ),
                                  ],
                                ),
                              );
                              if (ok == true) await _toggleSubscribe();
                            } else {
                              await _setNotify(value);
                            }
                          },
                          itemBuilder: (context) => const [
                            PopupMenuItem(value: 'all', child: Text('All')),
                            PopupMenuItem(value: 'personalized', child: Text('Personalized')),
                            PopupMenuItem(value: 'none', child: Text('None')),
                            PopupMenuDivider(),
                            PopupMenuItem(value: 'unsubscribe', child: Text('Unsubscribe')),
                          ],
                          child: const _ShortAction(
                            icon: Icons.notifications_active,
                            label: 'Subscribed',
                          ),
                        )
                      : _ShortAction(
                          icon: Icons.person_add_alt_1,
                          label: 'Subscribe',
                          onTap: _busy ? null : _toggleSubscribe,
                        ),
              ],
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 8,
            left: 8,
            child: Text(
              'Shorts',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 4,
            right: 8,
            child: PopupMenuButton<String>(
              tooltip: 'More',
              color: ForgeTokens.of(context).surfaceContainerHigh,
              onSelected: (value) async {
                try {
                  final repo = ref.read(watchRepositoryProvider);
                  if (value == 'watch_later') {
                    await _toggleWatchLater();
                  } else if (value == 'save_playlist') {
                    await showSaveToPlaylistSheet(
                      context: context,
                      ref: ref,
                      videoId: widget.video.id,
                    );
                  } else if (value == 'block') {
                    final user = widget.video.user;
                    if (user.id.isEmpty) return;
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: Text('Block ${user.displayName}?'),
                        content: const Text(
                          'They won’t be able to message you. Their comments will be hidden, and their channel won’t be recommended.',
                        ),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Block')),
                        ],
                      ),
                    );
                    if (ok != true) return;
                    await repo.blockUser(user.id);
                    if (!mounted) return;
                    widget.onHidden?.call();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('User blocked')),
                    );
                  } else if (value == 'not_interested') {
                    await repo.markNotInterested(widget.video.id);
                    if (!mounted) return;
                    widget.onHidden?.call();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("We'll show fewer videos like this")),
                    );
                  } else if (value == 'dont_recommend') {
                    await repo.dontRecommendChannel(widget.video.id);
                    if (!mounted) return;
                    widget.onHidden?.call();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Channel won't be recommended")),
                    );
                  } else if (value == 'report') {
                    const reasons = [
                      'Spam or misleading',
                      'Hate speech or harassment',
                      'Sexual content',
                      'Violent or repulsive content',
                      'Harmful or dangerous acts',
                      'Other',
                    ];
                    final reason = await showModalBottomSheet<String>(
                      context: context,
                      builder: (ctx) => SafeArea(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const ListTile(
                              title: Text('Report', style: TextStyle(fontWeight: FontWeight.w600)),
                            ),
                            ...reasons.map(
                              (r) => ListTile(
                                title: Text(r),
                                onTap: () => Navigator.pop(ctx, r),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                    if (reason == null) return;
                    await repo.reportVideo(videoId: widget.video.id, reason: reason);
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Report submitted')),
                    );
                  }
                } catch (_) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Sign in to update preferences')),
                    );
                  }
                }
              },
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: 'watch_later',
                  child: Text(_inWatchLater ? 'Remove from Watch later' : 'Save to Watch later'),
                ),
                const PopupMenuItem(value: 'save_playlist', child: Text('Save to playlist')),
                const PopupMenuItem(value: 'not_interested', child: Text('Not interested')),
                const PopupMenuItem(value: 'dont_recommend', child: Text("Don't recommend channel")),
                if (widget.video.user.id.isNotEmpty)
                  const PopupMenuItem(value: 'block', child: Text('Block user')),
                const PopupMenuItem(value: 'report', child: Text('Report')),
              ],
              icon: const Icon(Icons.more_vert, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}

class _ShortAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  const _ShortAction({
    required this.icon,
    required this.label,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Material(
          color: Colors.black54,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Icon(icon, color: Colors.white, size: 26),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}
