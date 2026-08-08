import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../core/navigation/public_video_path.dart';
import '../../../core/platform/pip_service.dart';
import '../../../core/theme/forge_tokens.dart';
import '../data/miniplayer_provider.dart';

bool _sameSurface(MiniPlayerSession session, Uri uri) {
  final path = uri.path;
  if (path == '/watch/${session.videoId}') return true;
  if (path == '/shorts' && uri.queryParameters['v'] == session.videoId) return true;
  return false;
}

/// YouTube-style floating miniplayer — continues HLS after leaving watch.
class MiniPlayerDock extends ConsumerStatefulWidget {
  const MiniPlayerDock({super.key});

  @override
  ConsumerState<MiniPlayerDock> createState() => _MiniPlayerDockState();
}

class _MiniPlayerDockState extends ConsumerState<MiniPlayerDock> {
  VideoPlayerController? _controller;
  String? _boundKey;
  String? _routeKey;
  bool _pipSupported = false;

  @override
  void initState() {
    super.initState();
    PipService.isSupported().then((ok) {
      if (mounted) setState(() => _pipSupported = ok);
    });
  }

  @override
  void dispose() {
    unawaited(PipService.setAutoEnter(false));
    _controller?.removeListener(_onTick);
    _controller?.dispose();
    super.dispose();
  }

  void _syncAutoPip() {
    final session = ref.read(miniPlayerProvider);
    final playing = _controller?.value.isPlaying == true;
    unawaited(PipService.setAutoEnter(session != null && playing && _pipSupported));
  }

  void _onTick() {
    final c = _controller;
    if (c == null || !c.value.isInitialized) return;
    ref.read(miniPlayerProvider.notifier).updateSeconds(c.value.position.inSeconds);
    _syncAutoPip();
  }

  Future<void> _sync(MiniPlayerSession? session, {required bool hide}) async {
    if (session == null || hide) {
      _controller?.removeListener(_onTick);
      await _controller?.dispose();
      _controller = null;
      _boundKey = null;
      unawaited(PipService.setAutoEnter(false));
      if (mounted) setState(() {});
      return;
    }

    final key = '${session.videoId}|${session.hlsUrl}';
    if (_boundKey == key && _controller != null) {
      if (_controller!.value.isInitialized && !_controller!.value.isPlaying) {
        await _controller!.play();
        if (mounted) setState(() {});
      }
      _syncAutoPip();
      return;
    }

    _controller?.removeListener(_onTick);
    await _controller?.dispose();
    _controller = null;
    _boundKey = key;

    final vc = VideoPlayerController.networkUrl(Uri.parse(session.hlsUrl));
    _controller = vc;
    try {
      await vc.initialize();
      if (!mounted || _boundKey != key) {
        await vc.dispose();
        return;
      }
      await vc.seekTo(Duration(seconds: session.seconds));
      await vc.play();
      vc.addListener(_onTick);
      _syncAutoPip();
      if (mounted) setState(() {});
    } catch (_) {
      await vc.dispose();
      if (_controller == vc) {
        _controller = null;
        _boundKey = null;
      }
    }
  }

  void _reconcile() {
    final session = ref.read(miniPlayerProvider);
    Uri? uri;
    try {
      uri = GoRouterState.of(context).uri;
    } catch (_) {
      return;
    }
    final hide = session != null && _sameSurface(session, uri);
    final nextRoute = '${uri.path}?${uri.query}';
    if (nextRoute == _routeKey &&
        ((session == null && _boundKey == null) ||
            (session != null && _boundKey == '${session.videoId}|${session.hlsUrl}'))) {
      return;
    }
    _routeKey = nextRoute;
    _sync(session, hide: hide);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(miniPlayerProvider);

    ref.listen<MiniPlayerSession?>(miniPlayerProvider, (prev, next) {
      _reconcile();
    });

    // Route changes (watch → feed) need a reconcile without session change.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _reconcile();
    });

    Uri? uri;
    try {
      uri = GoRouterState.of(context).uri;
    } catch (_) {
      return const SizedBox.shrink();
    }
    final hide = session != null && _sameSurface(session, uri);
    if (session == null || hide) return const SizedBox.shrink();

    final t = ForgeTokens.of(context);
    final bottomPad = MediaQuery.paddingOf(context).bottom + 72;
    final expandPath = publicVideoPath(
      id: session.videoId,
      videoType: session.videoType,
      progressSeconds: session.videoType == 'short' ? null : session.seconds,
    );

    return Positioned(
      right: 12,
      bottom: bottomPad,
      child: Material(
        elevation: 8,
        borderRadius: BorderRadius.circular(12),
        color: t.surfaceContainerHigh,
        child: SizedBox(
          width: 220,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (_controller != null && _controller!.value.isInitialized)
                        FittedBox(
                          fit: BoxFit.contain,
                          child: SizedBox(
                            width: _controller!.value.size.width,
                            height: _controller!.value.size.height,
                            child: VideoPlayer(_controller!),
                          ),
                        )
                      else if (session.thumbnailUrl != null)
                        CachedNetworkImage(
                          imageUrl: session.thumbnailUrl!,
                          fit: BoxFit.cover,
                        )
                      else
                        ColoredBox(color: t.surfaceContainerHighest),
                      Positioned(
                        left: 4,
                        bottom: 4,
                        child: IconButton.filledTonal(
                          visualDensity: VisualDensity.compact,
                          iconSize: 18,
                          onPressed: () async {
                            final c = _controller;
                            if (c == null) return;
                            if (c.value.isPlaying) {
                              await c.pause();
                            } else {
                              await c.play();
                            }
                            if (mounted) setState(() {});
                          },
                          icon: Icon(
                            (_controller?.value.isPlaying ?? false)
                                ? Icons.pause
                                : Icons.play_arrow,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 6, 4, 6),
                child: Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () => context.push(expandPath),
                        child: Text(
                          session.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: t.onSurface,
                          ),
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Expand',
                      visualDensity: VisualDensity.compact,
                      onPressed: () => context.push(expandPath),
                      icon: const Icon(Icons.open_in_full, size: 18),
                    ),
                    if (_pipSupported)
                      IconButton(
                        tooltip: 'Picture in picture',
                        visualDensity: VisualDensity.compact,
                        onPressed: () => PipService.enter(),
                        icon: const Icon(Icons.picture_in_picture_alt, size: 18),
                      ),
                    IconButton(
                      tooltip: 'Close',
                      visualDensity: VisualDensity.compact,
                      onPressed: () => ref.read(miniPlayerProvider.notifier).close(),
                      icon: const Icon(Icons.close, size: 18),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
