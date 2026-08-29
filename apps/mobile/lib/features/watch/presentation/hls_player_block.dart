import 'dart:async';

import 'package:chewie/chewie.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../core/cache/local_cache.dart';
import '../../../core/platform/pip_service.dart';
import '../../../core/router/navigation_key.dart';
import '../../../core/theme/forge_tokens.dart';
import '../data/miniplayer_provider.dart';
import '../data/watch_repository.dart';
import 'watch_screen.dart';

const _volumePrefKey = 'forge.watch.volume';
const _mutedPrefKey = 'forge.watch.muted';

({double volume, bool muted}) _readPreferredVolume() {
  final volumeRaw = double.tryParse(LocalCache.read(_volumePrefKey) ?? '');
  final volume = (volumeRaw != null && volumeRaw >= 0 && volumeRaw <= 1) ? volumeRaw : 1.0;
  final muted = LocalCache.read(_mutedPrefKey) == '1';
  return (volume: volume, muted: muted);
}

class HlsPlayerBlock extends ConsumerStatefulWidget {
  final String videoId;
  final String url;
  final String title;
  final String? thumbnailUrl;
  final String? videoType;
  final bool looping;
  final double playbackRate;
  final VoidCallback? onEnded;
  const HlsPlayerBlock({
    super.key,
    required this.videoId,
    required this.url,
    required this.title,
    this.thumbnailUrl,
    this.videoType,
    this.looping = false,
    this.playbackRate = 1,
    this.onEnded,
  });

  @override
  ConsumerState<HlsPlayerBlock> createState() => _HlsPlayerBlockState();
}

class _HlsPlayerBlockState extends ConsumerState<HlsPlayerBlock> with WidgetsBindingObserver {
  VideoPlayerController? _video;
  ChewieController? _chewie;
  bool _endedFired = false;
  bool _initFailed = false;
  double _lastVolume = 1;
  bool _lastMuted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bootstrap();
  }

  void _syncAutoPip() {
    final playing = _video?.value.isPlaying == true;
    final positionMs = _video?.value.position.inMilliseconds ?? 0;
    unawaited(
      PipService.setAutoEnter(
        playing,
        hlsUrl: widget.url,
        positionMs: positionMs,
      ),
    );
  }

  /// Keep playing in Android OS PiP / iOS AVPlayer PiP; otherwise pause when backgrounded.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncAutoPip();
      return;
    }
    if (state != AppLifecycleState.paused && state != AppLifecycleState.inactive) return;
    final playing = _video?.value.isPlaying == true;
    if (!playing) return;
    // Android onUserLeaveHint / iOS willResignActive may already have entered PiP.
    unawaited(
      PipService.isSupported().then((supported) async {
        if (!mounted) return;
        if (!supported) {
          _video?.pause();
          return;
        }
        if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
          final positionMs = _video?.value.position.inMilliseconds ?? 0;
          await PipService.enter(hlsUrl: widget.url, positionMs: positionMs);
          await _video?.pause();
          return;
        }
        _syncAutoPip();
      }),
    );
  }

  @override
  void didUpdateWidget(covariant HlsPlayerBlock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _endedFired = false;
      _initFailed = false;
      _disposeControllers();
      _bootstrap();
      return;
    }
    if (oldWidget.looping != widget.looping) {
      _video?.setLooping(widget.looping);
      final vc = _video;
      final existing = _chewie;
      if (vc != null && existing != null) {
        existing.dispose();
        setState(() {
          _chewie = ChewieController(
            videoPlayerController: vc,
            autoPlay: vc.value.isPlaying,
            looping: widget.looping,
            aspectRatio: vc.value.aspectRatio == 0 ? 16 / 9 : vc.value.aspectRatio,
            materialProgressColors: existing.materialProgressColors,
          );
        });
      }
    }
    if (oldWidget.playbackRate != widget.playbackRate) {
      _video?.setPlaybackSpeed(widget.playbackRate);
    }
  }

  Future<void> _persistVolumePrefs() async {
    final vc = _video;
    if (vc == null) return;
    final volume = vc.value.volume.clamp(0.0, 1.0);
    final muted = vc.value.volume == 0;
    if ((volume - _lastVolume).abs() < 0.01 && muted == _lastMuted) return;
    _lastVolume = muted ? _lastVolume : volume;
    _lastMuted = muted;
    // When muted, keep last non-zero volume in storage for unmute restore.
    final storedVolume = muted
        ? (double.tryParse(LocalCache.read(_volumePrefKey) ?? '') ?? 1.0).clamp(0.0, 1.0)
        : volume;
    await LocalCache.write(_volumePrefKey, storedVolume.toString());
    await LocalCache.write(_mutedPrefKey, muted ? '1' : '0');
  }

  Future<void> _bootstrap() async {
    final vc = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    try {
      await vc.initialize();
    } catch (_) {
      await vc.dispose();
      if (mounted) setState(() => _initFailed = true);
      return;
    }
    if (!mounted) {
      await vc.dispose();
      return;
    }
    await vc.setLooping(widget.looping);
    await vc.setPlaybackSpeed(widget.playbackRate);
    final prefs = _readPreferredVolume();
    _lastVolume = prefs.volume;
    _lastMuted = prefs.muted;
    if (prefs.muted) {
      await vc.setVolume(0);
    } else {
      await vc.setVolume(prefs.volume);
    }
    vc.addListener(() {
      if (!mounted) return;
      unawaited(_persistVolumePrefs());
      _syncAutoPip();
      final sec = vc.value.position.inSeconds;
      if (sec != ref.read(watchPositionSecondsProvider(widget.videoId))) {
        ref.read(watchPositionSecondsProvider(widget.videoId).notifier).state = sec;
      }
      final dur = vc.value.duration;
      if (dur > Duration.zero &&
          vc.value.position < dur - const Duration(seconds: 2)) {
        _endedFired = false;
      }
      if (!_endedFired &&
          !widget.looping &&
          dur > Duration.zero &&
          vc.value.position >= dur - const Duration(milliseconds: 500) &&
          !vc.value.isPlaying) {
        _endedFired = true;
        widget.onEnded?.call();
      }
    });
    setState(() {
      _video = vc;
      _chewie = ChewieController(
        videoPlayerController: vc,
        autoPlay: true,
        looping: widget.looping,
        aspectRatio: vc.value.aspectRatio == 0 ? 16 / 9 : vc.value.aspectRatio,
        materialProgressColors: ChewieProgressColors(
          playedColor: ForgeTokens.of(context).primary,
          handleColor: ForgeTokens.of(context).primary,
          backgroundColor: ForgeTokens.of(context).outlineVariant,
          bufferedColor: ForgeTokens.of(context).surfaceContainerHigh,
        ),
      );
    });
    final pendingSeek = ref.read(watchSeekSecondsProvider(widget.videoId));
    if (pendingSeek != null && pendingSeek > 0) {
      final maxSec = vc.value.duration.inSeconds;
      final clamped = pendingSeek.clamp(0, maxSec > 0 ? maxSec : pendingSeek);
      await vc.seekTo(Duration(seconds: clamped));
      ref.read(watchSeekSecondsProvider(widget.videoId).notifier).state = null;
    }
    _recordWatch();
  }

  Future<void> _recordWatch({int progressSeconds = 0}) async {
    try {
      await ref.read(watchRepositoryProvider).recordWatch(
            widget.videoId,
            progressSeconds: progressSeconds,
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
    WidgetsBinding.instance.removeObserver(this);
    unawaited(PipService.setAutoEnter(false));
    final pos = _video?.value.position.inSeconds ?? 0;
    final leaveSession = MiniPlayerSession(
      videoId: widget.videoId,
      title: widget.title,
      hlsUrl: widget.url,
      thumbnailUrl: widget.thumbnailUrl,
      seconds: pos,
      videoType: widget.videoType,
    );
    _recordWatch(progressSeconds: pos);
    _disposeControllers();
    super.dispose();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = rootNavigatorKey.currentContext;
      if (ctx == null || pos < 2) return;
      final uri = GoRouter.of(ctx).state.uri;
      final path = uri.path;
      if (path.startsWith('/watch/')) return;
      if (path == '/shorts' && uri.queryParameters['v'] == leaveSession.videoId) return;
      ProviderScope.containerOf(ctx).read(miniPlayerProvider.notifier).open(leaveSession);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int?>(watchSeekSecondsProvider(widget.videoId), (prev, next) {
      if (next == null || _video == null) return;
      final maxSec = _video!.value.duration.inSeconds;
      final clamped = next.clamp(0, maxSec > 0 ? maxSec : next);
      _video!.seekTo(Duration(seconds: clamped));
      ref.read(watchSeekSecondsProvider(widget.videoId).notifier).state = null;
    });

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: ColoredBox(
        color: ForgeTokens.of(context).surfaceContainerHigh,
        child: _chewie != null
            ? Chewie(controller: _chewie!)
            : _initFailed
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.error_outline, color: ForgeTokens.of(context).onSurfaceVariant),
                        const SizedBox(height: 8),
                        Text(
                          "Couldn't load video",
                          style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () {
                            setState(() => _initFailed = false);
                            _bootstrap();
                          },
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  )
                : Center(child: CircularProgressIndicator(color: ForgeTokens.of(context).primary)),
      ),
    );
  }
}
