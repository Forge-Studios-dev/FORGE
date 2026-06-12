import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../core/network/api_client.dart';
import '../../../core/socket/forge_socket.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../core/widgets/forge_skeleton.dart';
import '../../../shared/models/video.dart';

final videoDetailProvider = FutureProvider.family.autoDispose<VideoModel, String>((ref, id) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/videos/$id');
  final payload = response.data['data'] as Map<String, dynamic>;
  return VideoModel.fromJson(payload);
});

String _accessMessage(String? reason) {
  switch (reason) {
    case 'login_required':
      return 'Sign in to watch this lesson.';
    case 'follow_required':
      return 'Follow this creator to watch.';
    case 'subscription_required':
      return 'An active membership is required.';
    case 'tier_required':
      return 'A higher membership tier is required.';
    case 'private':
      return 'This lesson is private.';
    default:
      return 'You cannot watch this lesson.';
  }
}

class WatchScreen extends ConsumerWidget {
  final String videoId;
  const WatchScreen({super.key, required this.videoId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncVideo = ref.watch(videoDetailProvider(videoId));

    return Scaffold(
      backgroundColor: ForgeTokens.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: asyncVideo.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ForgeSkeleton(height: 200, borderRadius: BorderRadius.all(Radius.circular(12))),
              SizedBox(height: 16),
              ForgeSkeleton(width: 240, height: 18),
              SizedBox(height: 8),
              ForgeSkeleton(width: 120, height: 14),
            ],
          ),
        ),
        error: (e, _) => ForgeEmptyState(
          icon: Icons.videocam_off_outlined,
          title: 'Video unavailable',
          description: 'This lesson may have been removed or failed to load.',
          actionLabel: 'Go back',
          onAction: () => context.pop(),
        ),
        data: (video) {
          final canPlay =
              !video.accessDenied &&
              video.status == 'ready' &&
              video.hlsUrl != null &&
              video.hlsUrl!.isNotEmpty;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (canPlay)
                _HlsPlayerBlock(videoId: videoId, url: video.hlsUrl!)
              else
                ForgeCard(
                  child: SizedBox(
                    height: 200,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              video.accessDenied
                                  ? Icons.lock_outline
                                  : video.status == 'processing'
                                      ? Icons.hourglass_top
                                      : Icons.videocam_off_outlined,
                              size: 40,
                              color: ForgeTokens.outline,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              video.accessDenied
                                  ? 'Membership required'
                                  : video.status == 'processing'
                                      ? 'Processing your lesson'
                                      : 'Playback not available',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                color: ForgeTokens.onSurface,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              video.accessDenied
                                  ? _accessMessage(video.accessReason)
                                  : video.status == 'processing'
                                      ? 'This video is being transcoded. Check back soon.'
                                      : video.status == 'failed'
                                          ? 'This upload could not be processed.'
                                          : 'This lesson is not ready for playback yet.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: ForgeTokens.onSurfaceVariant),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              Text(
                video.title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: ForgeTokens.onSurface,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                '@${video.user.username}',
                style: const TextStyle(color: ForgeTokens.onSurfaceVariant),
              ),
              if (video.description != null && video.description!.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  video.description!,
                  style: const TextStyle(height: 1.4, color: ForgeTokens.onSurfaceVariant),
                ),
              ],
              const SizedBox(height: 16),
              _ReportVideoButton(videoId: videoId),
              const SizedBox(height: 24),
              _WatchCommentsSection(videoId: videoId),
            ],
          );
        },
      ),
    );
  }
}

class _ReportVideoButton extends ConsumerStatefulWidget {
  final String videoId;
  const _ReportVideoButton({required this.videoId});

  @override
  ConsumerState<_ReportVideoButton> createState() => _ReportVideoButtonState();
}

class _ReportVideoButtonState extends ConsumerState<_ReportVideoButton> {
  final _reasonCtrl = TextEditingController();

  Future<void> _submit() async {
    final reason = _reasonCtrl.text.trim();
    if (reason.length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a reason (min 3 characters)')),
      );
      return;
    }
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/reports', data: {
        'targetType': 'video',
        'targetId': widget.videoId,
        'reason': reason,
      });
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report submitted')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to report content')),
        );
      }
    }
  }

  void _openSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ForgeTokens.surfaceContainerHigh,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Report lesson', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 12),
            TextField(
              controller: _reasonCtrl,
              maxLines: 3,
              decoration: const InputDecoration(hintText: 'Why should we review this?'),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: _submit, child: const Text('Submit report')),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        onPressed: _openSheet,
        icon: const Icon(Icons.flag_outlined, size: 18),
        label: const Text('Report'),
        style: TextButton.styleFrom(foregroundColor: ForgeTokens.outline),
      ),
    );
  }
}

class _WatchCommentsSection extends ConsumerStatefulWidget {
  final String videoId;
  const _WatchCommentsSection({required this.videoId});

  @override
  ConsumerState<_WatchCommentsSection> createState() => _WatchCommentsSectionState();
}

class _WatchCommentsSectionState extends ConsumerState<_WatchCommentsSection> {
  final _ctrl = TextEditingController();
  List<dynamic> _comments = [];
  bool _loading = true;
  bool _loadingMore = false;
  String? _nextCursor;
  bool _hasMore = false;
  String? _replyToId;

  void Function(dynamic)? _onNewComment;

  @override
  void initState() {
    super.initState();
    _load();
    _bindSocket();
  }

  Future<void> _load({String? cursor}) async {
    try {
      final client = ref.read(apiClientProvider);
      final params = <String, dynamic>{'limit': 20};
      if (cursor != null) params['cursor'] = cursor;
      final res = await client.dio.get('/videos/${widget.videoId}/comments', queryParameters: params);
      final payload = res.data['data'] as Map<String, dynamic>;
      final data = payload['data'] as List<dynamic>? ?? [];
      final meta = payload['meta'] as Map<String, dynamic>? ?? {};
      if (!mounted) return;
      setState(() {
        if (cursor != null) {
          _comments = [..._comments, ...data];
        } else {
          _comments = data;
        }
        _nextCursor = meta['cursor'] as String?;
        _hasMore = meta['hasMore'] == true;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _bindSocket() async {
    await ForgeSocket.connect();
    ForgeSocket.joinVideo(widget.videoId);
    _onNewComment = (_) {
      if (mounted) _load();
    };
    ForgeSocket.on('comment:new', _onNewComment!);
  }

  Future<void> _post() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      final body = <String, dynamic>{'content': text};
      if (_replyToId != null) body['parentId'] = _replyToId;
      await client.dio.post('/videos/${widget.videoId}/comments', data: body);
      _ctrl.clear();
      setState(() => _replyToId = null);
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to comment')),
        );
      }
    }
  }

  Future<void> _toggleLike(Map<String, dynamic> comment) async {
    final id = comment['id'] as String;
    final liked = comment['viewerLiked'] == true;
    try {
      final client = ref.read(apiClientProvider);
      if (liked) {
        await client.dio.delete('/videos/${widget.videoId}/comments/$id/like');
      } else {
        await client.dio.post('/videos/${widget.videoId}/comments/$id/like');
      }
      await _load();
    } catch (_) {}
  }

  @override
  void dispose() {
    if (_onNewComment != null) {
      ForgeSocket.off('comment:new', _onNewComment);
    }
    ForgeSocket.leaveVideo(widget.videoId);
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Comments', style: Theme.of(context).textTheme.titleMedium),
        if (_replyToId != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: TextButton(
              onPressed: () => setState(() => _replyToId = null),
              child: const Text('Cancel reply'),
            ),
          ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _ctrl,
                decoration: const InputDecoration(
                  hintText: 'Add a comment…',
                  isDense: true,
                ),
              ),
            ),
            IconButton(onPressed: _post, icon: const Icon(Icons.send)),
          ],
        ),
        if (_loading)
          const Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator())
        else if (_comments.isEmpty)
          const Text('No comments yet', style: TextStyle(color: ForgeTokens.onSurfaceVariant))
        else ...[
          ..._comments.map((c) {
            final m = c as Map<String, dynamic>;
            final user = m['user'] as Map<String, dynamic>?;
            final likeCount = m['likeCount'] as int? ?? 0;
            final liked = m['viewerLiked'] == true;
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(user?['displayName'] as String? ?? 'User'),
              subtitle: Text(m['content'] as String? ?? ''),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: Icon(liked ? Icons.favorite : Icons.favorite_border, size: 18),
                    onPressed: () => _toggleLike(m),
                  ),
                  if (likeCount > 0) Text('$likeCount', style: const TextStyle(fontSize: 12)),
                  IconButton(
                    icon: const Icon(Icons.reply, size: 18),
                    onPressed: () => setState(() => _replyToId = m['id'] as String?),
                  ),
                ],
              ),
            );
          }),
          if (_hasMore)
            TextButton(
              onPressed: _loadingMore
                  ? null
                  : () async {
                      setState(() => _loadingMore = true);
                      await _load(cursor: _nextCursor);
                      if (mounted) setState(() => _loadingMore = false);
                    },
              child: Text(_loadingMore ? 'Loading…' : 'Load more'),
            ),
        ],
      ],
    );
  }
}

class _HlsPlayerBlock extends ConsumerStatefulWidget {
  final String videoId;
  final String url;
  const _HlsPlayerBlock({required this.videoId, required this.url});

  @override
  ConsumerState<_HlsPlayerBlock> createState() => _HlsPlayerBlockState();
}

class _HlsPlayerBlockState extends ConsumerState<_HlsPlayerBlock> {
  VideoPlayerController? _video;
  ChewieController? _chewie;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void didUpdateWidget(covariant _HlsPlayerBlock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _disposeControllers();
      _bootstrap();
    }
  }

  Future<void> _bootstrap() async {
    final vc = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    await vc.initialize();
    if (!mounted) return;
    setState(() {
      _video = vc;
      _chewie = ChewieController(
        videoPlayerController: vc,
        autoPlay: true,
        looping: false,
        aspectRatio: vc.value.aspectRatio == 0 ? 16 / 9 : vc.value.aspectRatio,
        materialProgressColors: ChewieProgressColors(
          playedColor: ForgeTokens.primary,
          handleColor: ForgeTokens.primary,
          backgroundColor: ForgeTokens.outlineVariant,
          bufferedColor: ForgeTokens.surfaceContainerHigh,
        ),
      );
    });
    _recordWatch();
  }

  Future<void> _recordWatch({int progressSeconds = 0}) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post(
        '/videos/${widget.videoId}/watch',
        data: {'progressSeconds': progressSeconds},
      );
    } catch (_) {}
  }

  void _disposeControllers() {
    _chewie?.dispose();
    _video?.dispose();
    _chewie = null;
    _video = null;
  }

  @override
  void dispose() {
    final pos = _video?.value.position.inSeconds ?? 0;
    _recordWatch(progressSeconds: pos);
    _disposeControllers();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: _chewie != null
            ? Chewie(controller: _chewie!)
            : const ColoredBox(
                color: ForgeTokens.surfaceContainerHigh,
                child: Center(child: CircularProgressIndicator(color: ForgeTokens.primary)),
              ),
      ),
    );
  }
}
