import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:go_router/go_router.dart';

import '../../../core/cache/local_cache.dart';
import '../../../core/network/api_client.dart';
import '../../../core/platform/pip_service.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/description_chapters.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../core/widgets/forge_skeleton.dart';
import '../../../shared/models/video.dart';
import '../data/miniplayer_provider.dart';
import '../data/watch_repository.dart';
import 'chapters_panel.dart';
import 'expandable_description.dart';
import 'hls_player_block.dart';
import 'player_captions_overlay.dart';
import 'playlist_queue_section.dart';
import 'related_videos_section.dart';
import 'report_video_button.dart';
import 'transcript_panel.dart';
import 'watch_comments_section.dart';
import 'watch_engage_row.dart';

const _autoplayPrefKey = 'forge.watch.autoplay';
const _loopPrefKey = 'forge.watch.loop';
const _ratePrefKey = 'forge.watch.playbackRate';
const _playbackRates = <double>[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

double _readPreferredPlaybackRate() {
  final raw = double.tryParse(LocalCache.read(_ratePrefKey) ?? '');
  if (raw == null) return 1;
  for (final r in _playbackRates) {
    if ((r - raw).abs() < 0.01) return r;
  }
  return 1;
}

String _rateLabel(double rate) => rate == 1 ? 'Normal' : '${rate}×';

final videoDetailProvider = FutureProvider.family.autoDispose<VideoModel, String>((ref, id) async {
  return ref.read(watchRepositoryProvider).getVideo(id);
});

/// Seconds to seek on the active watch player (null = no pending seek).
final watchSeekSecondsProvider = StateProvider.autoDispose.family<int?, String>((ref, _) => null);

/// Latest known playback position for share-at-time.
final watchPositionSecondsProvider = StateProvider.autoDispose.family<int, String>((ref, _) => 0);

String _accessMessage(String? reason) {
  switch (reason) {
    case 'login_required':
      return 'Sign in to watch this video.';
    case 'follow_required':
      return 'Subscribe to this channel to watch.';
    case 'subscription_required':
      return 'An active membership is required.';
    case 'tier_required':
      return 'A higher membership tier is required.';
    case 'paid_event':
      return 'This is a paid event. Access is granted by the creator or platform admin.';
    case 'private':
      return 'This video is private.';
    default:
      return 'You cannot watch this video.';
  }
}

String watchListHref(String videoId, {String? playlistId, bool shuffle = false}) {
  if (playlistId == null || playlistId.isEmpty) return '/watch/$videoId';
  final params = <String, String>{'list': playlistId};
  if (shuffle) params['shuffle'] = '1';
  return Uri(path: '/watch/$videoId', queryParameters: params).toString();
}

String? _pickShuffledNextId(List<String> videoIds, String currentId, String listId) {
  final others = videoIds.where((id) => id != currentId).toList();
  if (others.isEmpty) return null;
  var hash = 0;
  final seed = '$listId:$currentId';
  for (final unit in seed.codeUnits) {
    hash = (hash * 31 + unit) & 0xFFFFFFFF;
  }
  return others[hash % others.length];
}

class WatchScreen extends ConsumerStatefulWidget {
  final String videoId;
  final int? initialSeekSeconds;
  final String? playlistId;
  final bool shuffle;
  final String? highlightCommentId;
  const WatchScreen({
    super.key,
    required this.videoId,
    this.initialSeekSeconds,
    this.playlistId,
    this.shuffle = false,
    this.highlightCommentId,
  });

  @override
  ConsumerState<WatchScreen> createState() => _WatchScreenState();
}

class _WatchScreenState extends ConsumerState<WatchScreen> {
  @override
  void initState() {
    super.initState();
    final seek = widget.initialSeekSeconds;
    if (seek != null && seek > 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(watchSeekSecondsProvider(widget.videoId).notifier).state = seek;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final videoId = widget.videoId;
    final asyncVideo = ref.watch(videoDetailProvider(videoId));

    return Scaffold(
      backgroundColor: ForgeTokens.of(context).background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          tooltip: 'Back',
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
        error: (e, _) {
          final blocked = e is DioException && e.response?.statusCode == 403;
          return ForgeEmptyState(
            icon: blocked ? Icons.block : Icons.videocam_off_outlined,
            title: blocked ? 'This video is not available' : 'Video unavailable',
            description: blocked
                ? 'Playback is restricted for this video on your account.'
                : 'This video may have been removed or failed to load.',
            actionLabel: 'Go back',
            onAction: () => context.pop(),
          );
        },
        data: (video) => _WatchBody(
          video: video,
          playlistId: widget.playlistId,
          shuffle: widget.shuffle,
          highlightCommentId: widget.highlightCommentId,
        ),
      ),
    );
  }
}

class _WatchBody extends ConsumerStatefulWidget {
  final VideoModel video;
  final String? playlistId;
  final bool shuffle;
  final String? highlightCommentId;
  const _WatchBody({
    required this.video,
    this.playlistId,
    this.shuffle = false,
    this.highlightCommentId,
  });

  @override
  ConsumerState<_WatchBody> createState() => _WatchBodyState();
}

class _WatchBodyState extends ConsumerState<_WatchBody> {
  Map<String, dynamic>? _playlist;
  String? _playlistNextHref;
  String? _playlistNextTitle;
  String? _relatedNextHref;
  String? _relatedNextTitle;
  bool _autoplay = true;
  bool _loopVideo = false;
  bool _loopPlaylist = false;
  double _playbackRate = 1;
  bool _endedHandled = false;
  bool _showEndScreen = false;
  int _endCountdown = 5;
  Timer? _endTimer;
  bool _pipSupported = false;

  @override
  void initState() {
    super.initState();
    // Mounts as a direct consequence of videoDetailProvider resolving inside
    // WatchScreen's own build() — calling this synchronously trips
    // Riverpod's "modify a provider while the widget tree is building" guard
    // whenever the fetch resolves fast enough (e.g. cached data).
    Future(() => ref.read(miniPlayerProvider.notifier).close());
    final autoplayPref = LocalCache.read(_autoplayPrefKey);
    if (autoplayPref == '0') _autoplay = false;
    if (autoplayPref == '1') _autoplay = true;
    final loopPref = LocalCache.read(_loopPrefKey);
    if (loopPref == '1') _loopVideo = true;
    _playbackRate = _readPreferredPlaybackRate();
    _loadPlaylist();
    _loadRelatedNext();
    PipService.isSupported().then((ok) {
      if (mounted) setState(() => _pipSupported = ok);
    });
  }

  @override
  void dispose() {
    _endTimer?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _WatchBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.video.id != widget.video.id ||
        oldWidget.playlistId != widget.playlistId ||
        oldWidget.shuffle != widget.shuffle) {
      _endedHandled = false;
      _showEndScreen = false;
      _endTimer?.cancel();
      _loadPlaylist();
      _loadRelatedNext();
    }
  }

  String? get _upNextHref =>
      _playlistNextHref ?? (widget.playlistId == null ? _relatedNextHref : null);

  String? get _upNextTitle =>
      _playlistNextHref != null ? _playlistNextTitle : _relatedNextTitle;

  Future<void> _persistAutoplay(bool value) async {
    await LocalCache.write(_autoplayPrefKey, value ? '1' : '0');
  }

  Future<void> _persistLoop(bool value) async {
    await LocalCache.write(_loopPrefKey, value ? '1' : '0');
  }

  Future<void> _persistRate(double value) async {
    await LocalCache.write(_ratePrefKey, value.toString());
  }

  void _cancelEndScreen() {
    _endTimer?.cancel();
    setState(() {
      _showEndScreen = false;
      _endCountdown = 5;
      _endedHandled = false;
    });
  }

  void _playUpNextNow() {
    final next = _upNextHref;
    if (next == null) return;
    _endTimer?.cancel();
    _endedHandled = true;
    context.pushReplacement(next);
  }

  void _startEndCountdown() {
    _endTimer?.cancel();
    if (!_autoplay) return;
    _endTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_endCountdown <= 1) {
        timer.cancel();
        _playUpNextNow();
        return;
      }
      setState(() => _endCountdown -= 1);
    });
  }

  Future<void> _loadPlaylist() async {
    final listId = widget.playlistId;
    if (listId == null) {
      if (mounted) {
        setState(() {
          _playlist = null;
          _playlistNextHref = null;
          _playlistNextTitle = null;
        });
      }
      return;
    }
    try {
      final res = await ref.read(apiClientProvider).dio.get('/playlists/$listId');
      final data = res.data['data'] as Map<String, dynamic>?;
      if (!mounted) return;
      final next = _computePlaylistNext(data);
      setState(() {
        _playlist = data;
        _playlistNextHref = next?.href;
        _playlistNextTitle = next?.title;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _playlist = null;
          _playlistNextHref = null;
          _playlistNextTitle = null;
        });
      }
    }
  }

  ({String href, String? title})? _computePlaylistNext(Map<String, dynamic>? data) {
    final listId = widget.playlistId;
    if (data == null || listId == null) return null;
    final items = (data['items'] as List?) ?? [];
    if (items.isEmpty) return null;

    String? videoIdOf(dynamic raw) {
      final item = raw as Map<String, dynamic>;
      final video = item['video'] as Map<String, dynamic>?;
      return item['videoId'] as String? ?? video?['id'] as String?;
    }

    String? titleOf(String id) {
      for (final raw in items) {
        if (raw is! Map<String, dynamic>) continue;
        final video = raw['video'] as Map<String, dynamic>?;
        final vid = raw['videoId'] as String? ?? video?['id'] as String?;
        if (vid == id) return video?['title'] as String? ?? raw['title'] as String?;
      }
      return null;
    }

    final ids = items.map(videoIdOf).whereType<String>().toList();
    if (ids.isEmpty) return null;
    final current = widget.video.id;

    String? nextId;
    if (widget.shuffle) {
      nextId = _pickShuffledNextId(ids, current, listId);
      if (nextId == null && _loopPlaylist && ids.isNotEmpty) {
        nextId = ids.first;
      }
    } else {
      final idx = ids.indexOf(current);
      if (idx < 0) return null;
      if (idx < ids.length - 1) {
        nextId = ids[idx + 1];
      } else if (_loopPlaylist) {
        nextId = ids.first;
      }
    }
    if (nextId == null) return null;
    return (
      href: watchListHref(nextId, playlistId: listId, shuffle: widget.shuffle),
      title: titleOf(nextId),
    );
  }

  Future<void> _loadRelatedNext() async {
    try {
      final data = await ref.read(watchRepositoryProvider).getRelated(widget.video.id, limit: 4);
      final first = data
          .cast<dynamic>()
          .whereType<Map>()
          .cast<Map<String, dynamic>>()
          .where((v) => v['id'] != widget.video.id)
          .toList();
      if (!mounted) return;
      final id = first.isNotEmpty ? first.first['id'] as String? : null;
      setState(() {
        _relatedNextHref = id != null ? '/watch/$id' : null;
        _relatedNextTitle = id != null ? first.first['title'] as String? : null;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _relatedNextHref = null;
          _relatedNextTitle = null;
        });
      }
    }
  }

  void _onPlaybackEnded() {
    if (_endedHandled || _loopVideo) return;
    final next = _upNextHref;
    if (next == null) return;
    setState(() {
      _showEndScreen = true;
      _endCountdown = 5;
    });
    _startEndCountdown();
  }

  @override
  Widget build(BuildContext context) {
    final video = widget.video;
    final videoId = video.id;
    final canPlay =
        !video.accessDenied &&
        video.status == 'ready' &&
        video.hlsUrl != null &&
        video.hlsUrl!.isNotEmpty;
    final listId = widget.playlistId;
    final chapters = extractVideoChapters(video.description);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (canPlay)
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                HlsPlayerBlock(
                  videoId: videoId,
                  url: video.hlsUrl!,
                  title: video.title,
                  thumbnailUrl: video.thumbnailUrl,
                  videoType: video.videoType,
                  looping: _loopVideo,
                  playbackRate: _playbackRate,
                  onEnded: _onPlaybackEnded,
                ),
                PlayerCaptionsOverlay(
                  video: video,
                  videoId: videoId,
                  currentSeconds: ref.watch(watchPositionSecondsProvider(videoId)),
                ),
                if (_showEndScreen && _upNextHref != null)
                  ColoredBox(
                    color: Colors.black.withValues(alpha: 0.75),
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 360),
                          child: ForgeCard(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Up next',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.4,
                                    color: ForgeTokens.of(context).onSurfaceVariant,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _upNextTitle ?? 'Next video',
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: ForgeTokens.of(context).onSurface,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _autoplay
                                      ? 'Playing in $_endCountdown s…'
                                      : 'Autoplay is off',
                                  style: TextStyle(
                                    color: ForgeTokens.of(context).onSurfaceVariant,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    TextButton(
                                      onPressed: _cancelEndScreen,
                                      child: const Text('Cancel'),
                                    ),
                                    const SizedBox(width: 8),
                                    FilledButton(
                                      onPressed: _playUpNextNow,
                                      child: const Text('Play now'),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          )
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
                        color: ForgeTokens.of(context).outline,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        video.accessDenied
                            ? 'Membership required'
                            : video.status == 'processing'
                                ? 'Processing your video'
                                : 'Playback not available',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: ForgeTokens.of(context).onSurface,
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
                                    : 'This video is not ready for playback yet.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TextButton.icon(
                onPressed: canPlay
                    ? () {
                        final seconds = ref.read(watchPositionSecondsProvider(videoId));
                        ref.read(miniPlayerProvider.notifier).open(
                              MiniPlayerSession(
                                videoId: videoId,
                                title: video.title,
                                hlsUrl: video.hlsUrl!,
                                thumbnailUrl: video.thumbnailUrl,
                                seconds: seconds,
                                videoType: video.videoType,
                              ),
                            );
                        context.go('/feed');
                      }
                    : null,
                icon: const Icon(Icons.picture_in_picture_alt_outlined, size: 18),
                label: const Text('Miniplayer'),
              ),
              if (canPlay && _pipSupported)
                TextButton.icon(
                  onPressed: () async {
                    final seconds = ref.read(watchPositionSecondsProvider(videoId));
                    await PipService.enter(
                      hlsUrl: video.hlsUrl!,
                      positionMs: seconds * 1000,
                    );
                  },
                  icon: const Icon(Icons.picture_in_picture_alt, size: 18),
                  label: const Text('PiP'),
                ),
            ],
          ),
        ),
        SwitchListTile.adaptive(
          contentPadding: EdgeInsets.zero,
          title: const Text('Autoplay next', style: TextStyle(fontSize: 14)),
          value: _autoplay,
          onChanged: (v) {
            setState(() => _autoplay = v);
            _persistAutoplay(v);
            if (!v) {
              _endTimer?.cancel();
            } else if (_showEndScreen) {
              _startEndCountdown();
            }
          },
        ),
        SwitchListTile.adaptive(
          contentPadding: EdgeInsets.zero,
          title: const Text('Loop video', style: TextStyle(fontSize: 14)),
          value: _loopVideo,
          onChanged: (v) {
            setState(() {
              _loopVideo = v;
              if (v) {
                _showEndScreen = false;
                _endCountdown = 5;
              }
            });
            _endTimer?.cancel();
            _persistLoop(v);
          },
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Playback speed', style: TextStyle(fontSize: 14)),
          trailing: DropdownButton<double>(
            value: _playbackRate,
            underline: const SizedBox.shrink(),
            items: [
              for (final rate in _playbackRates)
                DropdownMenuItem(
                  value: rate,
                  child: Text(_rateLabel(rate)),
                ),
            ],
            onChanged: (rate) {
              if (rate == null) return;
              setState(() => _playbackRate = rate);
              _persistRate(rate);
            },
          ),
        ),
        if (listId != null) ...[
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text('Loop playlist', style: TextStyle(fontSize: 14)),
            value: _loopPlaylist,
            onChanged: (v) => setState(() {
              _loopPlaylist = v;
              final next = _computePlaylistNext(_playlist);
              _playlistNextHref = next?.href;
              _playlistNextTitle = next?.title;
            }),
          ),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text('Shuffle', style: TextStyle(fontSize: 14)),
            value: widget.shuffle,
            onChanged: (v) {
              final href = watchListHref(videoId, playlistId: listId, shuffle: v);
              context.pushReplacement(href);
            },
          ),
        ],
        const SizedBox(height: 4),
        Text(
          video.title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: ForgeTokens.of(context).onSurface,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          '@${video.user.username}',
          style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
        ),
        const SizedBox(height: 12),
        WatchEngageRow(video: video),
        if (video.description != null && video.description!.isNotEmpty) ...[
          const SizedBox(height: 12),
          ExpandableDescription(videoId: videoId, description: video.description!),
        ],
        if (chapters.length >= 3) ...[
          const SizedBox(height: 12),
          ChaptersPanel(
            chapters: chapters,
            durationSeconds: video.durationSeconds,
            currentSeconds: ref.watch(watchPositionSecondsProvider(videoId)),
            onSeek: (seconds) =>
                ref.read(watchSeekSecondsProvider(videoId).notifier).state = seconds,
          ),
        ],
        if (video.captionTracks.isNotEmpty || (video.captionUrl != null && video.captionUrl!.isNotEmpty)) ...[
          const SizedBox(height: 12),
          TranscriptPanel(
            video: video,
            currentSeconds: ref.watch(watchPositionSecondsProvider(videoId)),
            onSeek: (seconds) =>
                ref.read(watchSeekSecondsProvider(videoId).notifier).state = seconds,
          ),
        ],
        const SizedBox(height: 16),
        ReportVideoButton(videoId: videoId),
        if (_playlist != null && listId != null) ...[
          const SizedBox(height: 24),
          PlaylistQueueSection(
            playlist: _playlist!,
            listId: listId,
            currentVideoId: videoId,
            shuffle: widget.shuffle,
          ),
        ],
        const SizedBox(height: 24),
        RelatedVideosSection(
          videoId: videoId,
          playlistId: listId,
          shuffle: widget.shuffle,
        ),
        WatchCommentsSection(
          videoId: videoId,
          videoOwnerId: video.userId,
          highlightCommentId: widget.highlightCommentId,
        ),
      ],
    );
  }
}
