import 'dart:async';

import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../../../core/cache/local_cache.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/router/navigation_key.dart';
import '../../../core/socket/forge_socket.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/description_chapters.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../../core/widgets/forge_skeleton.dart';
import '../../../shared/models/video.dart';
import 'save_to_playlist_sheet.dart';
import '../data/miniplayer_provider.dart';
import '../data/watch_repository.dart';
import 'chapters_panel.dart';
import 'player_captions_overlay.dart';
import 'transcript_panel.dart';

const _autoplayPrefKey = 'forge.watch.autoplay';
const _loopPrefKey = 'forge.watch.loop';
const _ratePrefKey = 'forge.watch.playbackRate';
const _volumePrefKey = 'forge.watch.volume';
const _mutedPrefKey = 'forge.watch.muted';
const _playbackRates = <double>[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

double _readPreferredPlaybackRate() {
  final raw = double.tryParse(LocalCache.read(_ratePrefKey) ?? '');
  if (raw == null) return 1;
  for (final r in _playbackRates) {
    if ((r - raw).abs() < 0.01) return r;
  }
  return 1;
}

({double volume, bool muted}) _readPreferredVolume() {
  final volumeRaw = double.tryParse(LocalCache.read(_volumePrefKey) ?? '');
  final volume = (volumeRaw != null && volumeRaw >= 0 && volumeRaw <= 1) ? volumeRaw : 1.0;
  final muted = LocalCache.read(_mutedPrefKey) == '1';
  return (volume: volume, muted: muted);
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

String _watchListHref(String videoId, {String? playlistId, bool shuffle = false}) {
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
          description: 'This video may have been removed or failed to load.',
          actionLabel: 'Go back',
          onAction: () => context.pop(),
        ),
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

  @override
  void initState() {
    super.initState();
    ref.read(miniPlayerProvider.notifier).close();
    final autoplayPref = LocalCache.read(_autoplayPrefKey);
    if (autoplayPref == '0') _autoplay = false;
    if (autoplayPref == '1') _autoplay = true;
    final loopPref = LocalCache.read(_loopPrefKey);
    if (loopPref == '1') _loopVideo = true;
    _playbackRate = _readPreferredPlaybackRate();
    _loadPlaylist();
    _loadRelatedNext();
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
      href: _watchListHref(nextId, playlistId: listId, shuffle: widget.shuffle),
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
                _HlsPlayerBlock(
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
          child: TextButton.icon(
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
              final href = _watchListHref(videoId, playlistId: listId, shuffle: v);
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
        _WatchEngageRow(video: video),
        if (video.description != null && video.description!.isNotEmpty) ...[
          const SizedBox(height: 12),
          _ExpandableDescription(videoId: videoId, description: video.description!),
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
        _ReportVideoButton(videoId: videoId),
        if (_playlist != null && listId != null) ...[
          const SizedBox(height: 24),
          _PlaylistQueueSection(
            playlist: _playlist!,
            listId: listId,
            currentVideoId: videoId,
            shuffle: widget.shuffle,
          ),
        ],
        const SizedBox(height: 24),
        _RelatedVideosSection(
          videoId: videoId,
          playlistId: listId,
          shuffle: widget.shuffle,
        ),
        _WatchCommentsSection(
          videoId: videoId,
          videoOwnerId: video.userId,
          highlightCommentId: widget.highlightCommentId,
        ),
      ],
    );
  }
}

class _PlaylistQueueSection extends StatelessWidget {
  final Map<String, dynamic> playlist;
  final String listId;
  final String currentVideoId;
  final bool shuffle;
  const _PlaylistQueueSection({
    required this.playlist,
    required this.listId,
    required this.currentVideoId,
    required this.shuffle,
  });

  @override
  Widget build(BuildContext context) {
    final items = (playlist['items'] as List?) ?? [];
    final title = playlist['title'] as String? ?? 'Playlist';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Playlist', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          '$title · ${items.length} videos${shuffle ? ' · Shuffle on' : ''}',
          style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, fontSize: 13),
        ),
        const SizedBox(height: 8),
        ...items.asMap().entries.map((entry) {
          final i = entry.key;
          final item = entry.value as Map<String, dynamic>;
          final video = item['video'] as Map<String, dynamic>?;
          final videoId = item['videoId'] as String? ?? video?['id'] as String?;
          final active = videoId == currentVideoId;
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: ForgeCard(
              onTap: videoId == null
                  ? null
                  : () => context.push(
                        _watchListHref(videoId, playlistId: listId, shuffle: shuffle),
                      ),
              child: Row(
                children: [
                  SizedBox(
                    width: 24,
                    child: Text(
                      '${i + 1}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        color: active ? ForgeTokens.of(context).primary : ForgeTokens.of(context).outline,
                        fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      video?['title'] as String? ?? 'Video',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: ForgeTokens.of(context).onSurface,
                        fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                      ),
                    ),
                  ),
                  if (active)
                    Icon(Icons.play_arrow, size: 18, color: ForgeTokens.of(context).primary),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}

class _ExpandableDescription extends ConsumerStatefulWidget {
  final String videoId;
  final String description;
  const _ExpandableDescription({required this.videoId, required this.description});

  @override
  ConsumerState<_ExpandableDescription> createState() => _ExpandableDescriptionState();
}

class _ExpandableDescriptionState extends ConsumerState<_ExpandableDescription> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final text = widget.description;
    final needsToggle = text.length > 180 || text.contains('\n');
    final shown = (!_expanded && needsToggle && text.length > 180)
        ? '${text.substring(0, 180).trimRight()}…'
        : text;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _LinkifiedText(
          text: shown,
          videoId: widget.videoId,
          style: TextStyle(height: 1.4, color: ForgeTokens.of(context).onSurfaceVariant),
        ),
        if (needsToggle)
          TextButton(
            onPressed: () => setState(() => _expanded = !_expanded),
            child: Text(_expanded ? 'Show less' : 'Show more'),
          ),
      ],
    );
  }
}

class _LinkifiedText extends ConsumerWidget {
  final String text;
  final String videoId;
  final TextStyle? style;
  const _LinkifiedText({required this.text, required this.videoId, this.style});

  static final _tokenRe = RegExp(
    r'(#[\w\u00C0-\u024F]{2,64})|(@[a-zA-Z0-9_]{2,32})|(\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b)',
    unicode: true,
  );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final spans = <InlineSpan>[];
    var start = 0;
    for (final match in _tokenRe.allMatches(text)) {
      if (match.start > start) {
        spans.add(TextSpan(text: text.substring(start, match.start)));
      }
      final token = match.group(0)!;
      if (token.startsWith('#')) {
        final q = token.substring(1);
        spans.add(
          WidgetSpan(
            alignment: PlaceholderAlignment.baseline,
            baseline: TextBaseline.alphabetic,
            child: GestureDetector(
              onTap: () => context.push('/search?q=${Uri.encodeComponent(q)}'),
              child: Text(
                token,
                style: TextStyle(
                  color: ForgeTokens.of(context).primary,
                  fontWeight: FontWeight.w600,
                  height: style?.height,
                ),
              ),
            ),
          ),
        );
      } else if (token.startsWith('@')) {
        final username = token.substring(1);
        spans.add(
          WidgetSpan(
            alignment: PlaceholderAlignment.baseline,
            baseline: TextBaseline.alphabetic,
            child: GestureDetector(
              onTap: () => context.push('/profile/$username'),
              child: Text(
                token,
                style: TextStyle(
                  color: ForgeTokens.of(context).primary,
                  fontWeight: FontWeight.w600,
                  height: style?.height,
                ),
              ),
            ),
          ),
        );
      } else {
        final seconds = parseTimestampToSeconds(token);
        spans.add(
          WidgetSpan(
            alignment: PlaceholderAlignment.baseline,
            baseline: TextBaseline.alphabetic,
            child: GestureDetector(
              onTap: seconds == null
                  ? null
                  : () => ref.read(watchSeekSecondsProvider(videoId).notifier).state = seconds,
              child: Text(
                token,
                style: TextStyle(
                  color: seconds != null ? ForgeTokens.of(context).primary : ForgeTokens.of(context).onSurfaceVariant,
                  fontWeight: seconds != null ? FontWeight.w600 : FontWeight.normal,
                  height: style?.height,
                ),
              ),
            ),
          ),
        );
      }
      start = match.end;
    }
    if (start < text.length) {
      spans.add(TextSpan(text: text.substring(start)));
    }
    return Text.rich(
      TextSpan(
        style: style ?? TextStyle(height: 1.4, color: ForgeTokens.of(context).onSurfaceVariant),
        children: spans,
      ),
    );
  }
}

class _WatchEngageRow extends ConsumerStatefulWidget {
  final VideoModel video;
  const _WatchEngageRow({required this.video});

  @override
  ConsumerState<_WatchEngageRow> createState() => _WatchEngageRowState();
}

class _WatchEngageRowState extends ConsumerState<_WatchEngageRow> {
  late bool _liked;
  late bool _disliked;
  late int _likeCount;
  late bool _subscribed;
  bool _inWatchLater = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _liked = widget.video.viewerLiked;
    _disliked = widget.video.viewerDisliked;
    _likeCount = widget.video.likeCount;
    _subscribed = widget.video.viewerSubscribed || widget.video.user.viewerFollowing;
    _loadWatchLater();
  }

  @override
  void didUpdateWidget(covariant _WatchEngageRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.video.id != widget.video.id) {
      _liked = widget.video.viewerLiked;
      _disliked = widget.video.viewerDisliked;
      _likeCount = widget.video.likeCount;
      _subscribed = widget.video.viewerSubscribed || widget.video.user.viewerFollowing;
      _inWatchLater = false;
      _loadWatchLater();
    }
  }

  Future<void> _loadWatchLater() async {
    try {
      final inList = await ref.read(watchRepositoryProvider).isInWatchLater(widget.video.id);
      if (mounted) setState(() => _inWatchLater = inList);
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

  Future<void> _share() async {
    final pos = ref.read(watchPositionSecondsProvider(widget.video.id));
    final base = '${AppConstants.webBaseUrl}/watch/${widget.video.id}';
    final url = pos > 0 ? '$base?t=$pos' : base;
    await SharePlus.instance.share(ShareParams(text: '${widget.video.title}\n$url'));
  }

  Future<void> _copyWatchLink({bool atTime = false}) async {
    final pos = ref.read(watchPositionSecondsProvider(widget.video.id));
    final base = '${AppConstants.webBaseUrl}/watch/${widget.video.id}';
    final url = atTime && pos > 0 ? '$base?t=$pos' : base;
    await Clipboard.setData(ClipboardData(text: url));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(atTime && pos > 0 ? 'Link at $pos s copied' : 'Link copied')),
    );
  }

  Future<void> _copyEmbed() async {
    final pos = ref.read(watchPositionSecondsProvider(widget.video.id));
    final src = pos > 0
        ? '${AppConstants.webBaseUrl}/embed/${widget.video.id}?t=$pos'
        : '${AppConstants.webBaseUrl}/embed/${widget.video.id}';
    final title = widget.video.title.replaceAll('"', '');
    final snippet =
        '<iframe width="560" height="315" src="$src" title="$title" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    await Clipboard.setData(ClipboardData(text: snippet));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(pos > 0 ? 'Embed code copied at current time' : 'Embed code copied')),
    );
  }

  Future<void> _notInterested() async {
    try {
      await ref.read(watchRepositoryProvider).markNotInterested(widget.video.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('We\'ll show fewer videos like this')),
        );
        context.pop();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update preferences')),
        );
      }
    }
  }

  Future<void> _dontRecommendChannel() async {
    try {
      await ref.read(watchRepositoryProvider).dontRecommendChannel(widget.video.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Channel won\'t be recommended')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update preferences')),
        );
      }
    }
  }

  Future<void> _openSaveToPlaylist() async {
    await showSaveToPlaylistSheet(
      context: context,
      ref: ref,
      videoId: widget.video.id,
    );
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update like')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update dislike')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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
      if (mounted) {
        setState(() => _subscribed = !next);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update subscription')),
        );
      }
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
          'all' => 'All notifications',
          'personalized' => 'Personalized',
          _ => 'None',
        };
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(label)),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update notifications')),
        );
      }
    }
  }

  Future<void> _openSuperThanks() async {
    const presets = [100, 200, 500, 1000, 2000];
    int selected = 200;
    final messageCtrl = TextEditingController();
    var sending = false;
    String? hint;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: ForgeTokens.of(context).surfaceContainerHigh,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                20,
                20,
                MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Super Thanks', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                  const SizedBox(height: 8),
                  Text(
                    'Send Super Thanks to ${widget.video.user.displayName} (USD).',
                    style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    children: presets
                        .map(
                          (cents) => ChoiceChip(
                            label: Text('\$${(cents / 100).toStringAsFixed(0)}'),
                            selected: selected == cents,
                            onSelected: sending
                                ? null
                                : (_) => setLocal(() => selected = cents),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: messageCtrl,
                    maxLength: 200,
                    enabled: !sending,
                    decoration: const InputDecoration(
                      hintText: 'Optional message…',
                      isDense: true,
                    ),
                  ),
                  if (hint != null) ...[
                    const SizedBox(height: 8),
                    Text(hint!, style: TextStyle(color: ForgeTokens.of(context).warning)),
                  ],
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: sending
                        ? null
                        : () async {
                            setLocal(() {
                              sending = true;
                              hint = null;
                            });
                            try {
                              final payload = await ref.read(watchRepositoryProvider).sendSuperThanks(
                                    videoId: widget.video.id,
                                    amountCents: selected,
                                    body: messageCtrl.text.trim(),
                                  );
                              final checkoutUrl = payload['checkoutUrl'] as String?;
                              final requiresCheckout = payload['requiresCheckout'] == true;
                              if (requiresCheckout && checkoutUrl != null && checkoutUrl.isNotEmpty) {
                                await launchUrl(
                                  Uri.parse(checkoutUrl),
                                  mode: LaunchMode.externalApplication,
                                );
                                if (ctx.mounted) Navigator.pop(ctx);
                                return;
                              }
                              if (ctx.mounted) {
                                Navigator.pop(ctx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Thanks sent!')),
                                );
                              }
                            } catch (_) {
                              setLocal(() {
                                sending = false;
                                hint = 'Could not send Super Thanks';
                              });
                            }
                          },
                    child: Text(sending ? 'Sending…' : 'Send \$${(selected / 100).toStringAsFixed(0)}'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
    messageCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        FilledButton.tonalIcon(
          onPressed: _busy ? null : _toggleLike,
          icon: Icon(_liked ? Icons.thumb_up : Icons.thumb_up_outlined, size: 18),
          label: Text(_likeCount > 0 ? '$_likeCount' : 'Like'),
        ),
        const SizedBox(width: 8),
        IconButton.filledTonal(
          onPressed: _busy ? null : _toggleDislike,
          icon: Icon(_disliked ? Icons.thumb_down : Icons.thumb_down_outlined, size: 18),
          tooltip: _disliked ? 'Remove dislike' : 'Dislike',
        ),
        const SizedBox(width: 8),
        IconButton.filledTonal(
          onPressed: _busy ? null : _openSuperThanks,
          icon: const Icon(Icons.volunteer_activism_outlined, size: 18),
          tooltip: 'Super Thanks',
        ),
        const SizedBox(width: 8),
        IconButton.filledTonal(
          onPressed: _busy ? null : _toggleWatchLater,
          icon: Icon(_inWatchLater ? Icons.watch_later : Icons.watch_later_outlined, size: 18),
          tooltip: _inWatchLater ? 'Remove from Watch later' : 'Save to Watch later',
        ),
        const SizedBox(width: 8),
        IconButton.filledTonal(
          onPressed: _busy ? null : _openSaveToPlaylist,
          icon: const Icon(Icons.playlist_add, size: 18),
          tooltip: 'Save to playlist',
        ),
        const SizedBox(width: 8),
        IconButton.filledTonal(
          onPressed: _share,
          icon: const Icon(Icons.share_outlined, size: 18),
          tooltip: 'Share',
        ),
        PopupMenuButton<String>(
          tooltip: 'Copy link',
          onSelected: (value) {
            if (value == 'link') _copyWatchLink();
            if (value == 'time') _copyWatchLink(atTime: true);
            if (value == 'embed') _copyEmbed();
          },
          itemBuilder: (context) => const [
            PopupMenuItem(value: 'link', child: Text('Copy link')),
            PopupMenuItem(value: 'time', child: Text('Copy link at current time')),
            PopupMenuItem(value: 'embed', child: Text('Copy embed code')),
          ],
          icon: const Icon(Icons.link, size: 20),
        ),
        const SizedBox(width: 8),
        PopupMenuButton<String>(
          tooltip: 'More',
          onSelected: (value) {
            if (value == 'not_interested') _notInterested();
            if (value == 'dont_recommend') _dontRecommendChannel();
          },
          itemBuilder: (context) => const [
            PopupMenuItem(value: 'not_interested', child: Text('Not interested')),
            PopupMenuItem(value: 'dont_recommend', child: Text("Don't recommend channel")),
          ],
          icon: const Icon(Icons.more_vert, size: 20),
        ),
        const SizedBox(width: 8),
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
                  child: Material(
                    color: ForgeTokens.of(context).surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(20),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.notifications_active, size: 18),
                          SizedBox(width: 6),
                          Text('Subscribed'),
                          SizedBox(width: 2),
                          Icon(Icons.arrow_drop_down, size: 18),
                        ],
                      ),
                    ),
                  ),
                )
              : FilledButton(
                  onPressed: _busy ? null : _toggleSubscribe,
                  style: FilledButton.styleFrom(
                    backgroundColor: ForgeTokens.of(context).onSurface,
                    foregroundColor: ForgeTokens.of(context).background,
                  ),
                  child: const Text('Subscribe'),
                ),
        const Spacer(),
        if (widget.video.user.username.isNotEmpty)
          TextButton(
            onPressed: () => context.push('/profile/${widget.video.user.username}'),
            child: Text(widget.video.user.displayName),
          ),
      ],
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
      await ref.read(watchRepositoryProvider).reportVideo(
            videoId: widget.videoId,
            reason: reason,
          );
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
      backgroundColor: ForgeTokens.of(context).surfaceContainerHigh,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Report video', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
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
        icon: Icon(Icons.flag_outlined, size: 18),
        label: const Text('Report'),
        style: TextButton.styleFrom(foregroundColor: ForgeTokens.of(context).outline),
      ),
    );
  }
}

class _WatchCommentsSection extends ConsumerStatefulWidget {
  final String videoId;
  final String videoOwnerId;
  final String? highlightCommentId;
  const _WatchCommentsSection({
    required this.videoId,
    required this.videoOwnerId,
    this.highlightCommentId,
  });

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
  String? _viewerId;
  String _sort = 'top';
  final Map<String, List<dynamic>> _replies = {};
  final Set<String> _expandedReplies = {};
  final Set<String> _loadingReplies = {};
  final Map<String, GlobalKey> _commentKeys = {};
  String? _editingId;
  final _editCtrl = TextEditingController();
  bool _highlightScrolled = false;

  void Function(dynamic)? _onNewComment;

  @override
  void initState() {
    super.initState();
    _loadViewer();
    _load();
    _bindSocket();
  }

  @override
  void dispose() {
    if (_onNewComment != null) {
      ForgeSocket.off('comment:new', _onNewComment);
    }
    ForgeSocket.leaveVideo(widget.videoId);
    _ctrl.dispose();
    _editCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadViewer() async {
    try {
      final client = ref.read(apiClientProvider);
      final me = await client.dio.get('/users/me');
      final data = me.data['data'] as Map<String, dynamic>?;
      if (mounted) setState(() => _viewerId = data?['id'] as String?);
    } catch (_) {}
  }

  Future<void> _load({String? cursor}) async {
    try {
      final page = await ref.read(watchRepositoryProvider).getComments(
            widget.videoId,
            cursor: cursor,
            sort: _sort,
          );
      if (!mounted) return;
      var comments = cursor != null ? [..._comments, ...page.comments] : page.comments;
      final highlightId = widget.highlightCommentId;
      if (highlightId != null &&
          cursor == null &&
          !comments.any((c) => (c as Map)['id'] == highlightId)) {
        try {
          final highlighted = await ref.read(watchRepositoryProvider).getComment(
                widget.videoId,
                highlightId,
              );
          if (highlighted != null) {
            comments = [highlighted, ...comments];
          }
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _comments = comments;
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
        _loading = false;
      });
      _scrollToHighlight();
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _scrollToHighlight() {
    final id = widget.highlightCommentId;
    if (id == null || _highlightScrolled) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _highlightScrolled) return;
      final key = _commentKeys[id];
      final ctx = key?.currentContext;
      if (ctx != null) {
        _highlightScrolled = true;
        Scrollable.ensureVisible(
          ctx,
          duration: const Duration(milliseconds: 350),
          alignment: 0.2,
        );
      }
    });
  }

  Future<void> _editComment(Map<String, dynamic> m) async {
    final id = m['id'] as String?;
    if (id == null) return;
    _editCtrl.text = m['content'] as String? ?? '';
    setState(() => _editingId = id);
  }

  Future<void> _saveEdit() async {
    final id = _editingId;
    final text = _editCtrl.text.trim();
    if (id == null || text.isEmpty) return;
    try {
      await ref.read(watchRepositoryProvider).updateComment(
            widget.videoId,
            id,
            content: text,
          );
      setState(() => _editingId = null);
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not edit comment')),
        );
      }
    }
  }

  Future<void> _deleteComment(Map<String, dynamic> m) async {
    final id = m['id'] as String?;
    if (id == null) return;
    final authorId = m['userId'] as String? ?? (m['user'] as Map<String, dynamic>?)?['id'] as String?;
    final isMine = _viewerId != null && authorId == _viewerId;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isMine ? 'Delete comment?' : 'Remove comment?'),
        content: Text(
          isMine
              ? 'This cannot be undone.'
              : 'Remove this comment from your video? This cannot be undone.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(isMine ? 'Delete' : 'Remove'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(watchRepositoryProvider).deleteComment(widget.videoId, id);
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete comment')),
        );
      }
    }
  }

  Future<void> _setSort(String sort) async {
    if (_sort == sort) return;
    setState(() {
      _sort = sort;
      _loading = true;
      _comments = [];
      _nextCursor = null;
      _hasMore = false;
    });
    await _load();
  }

  Future<void> _reportComment(Map<String, dynamic> m) async {
    const reasons = [
      'Spam or misleading',
      'Hate speech or harassment',
      'Sexual content',
      'Violence or threats',
      'Child abuse',
      'Privacy violation',
      'Other',
    ];
    final reason = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(title: Text('Report comment', style: TextStyle(fontWeight: FontWeight.w600))),
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
    final id = m['id'] as String?;
    if (id == null) return;
    try {
      await ref.read(watchRepositoryProvider).reportComment(commentId: id, reason: reason);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report submitted')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to report comments')),
        );
      }
    }
  }

  Future<void> _startReply(Map<String, dynamic> m) async {
    final id = m['id'] as String?;
    final user = m['user'] as Map<String, dynamic>?;
    final username = user?['username'] as String?;
    setState(() => _replyToId = id);
    if (username != null && username.isNotEmpty) {
      final mention = '@$username ';
      final current = _ctrl.text;
      if (!current.contains(mention) && !current.trim().startsWith('@$username')) {
        _ctrl.text = '$mention$current';
        _ctrl.selection = TextSelection.collapsed(offset: _ctrl.text.length);
      }
    }
  }

  Future<void> _toggleReplies(Map<String, dynamic> m) async {
    final id = m['id'] as String?;
    if (id == null) return;
    if (_expandedReplies.contains(id)) {
      setState(() => _expandedReplies.remove(id));
      return;
    }
    setState(() {
      _expandedReplies.add(id);
      _loadingReplies.add(id);
    });
    try {
      final replies = await ref.read(watchRepositoryProvider).getCommentReplies(
            widget.videoId,
            id,
          );
      if (!mounted) return;
      setState(() {
        _replies[id] = replies;
        _loadingReplies.remove(id);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _expandedReplies.remove(id);
        _loadingReplies.remove(id);
      });
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
      await ref.read(watchRepositoryProvider).postComment(
            widget.videoId,
            content: text,
            parentId: _replyToId,
          );
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
      await ref.read(watchRepositoryProvider).setCommentLiked(
            widget.videoId,
            id,
            liked: liked,
          );
      await _load();
    } catch (_) {}
  }

  Future<void> _toggleDislike(Map<String, dynamic> comment) async {
    final id = comment['id'] as String;
    final disliked = comment['viewerDisliked'] == true;
    try {
      await ref.read(watchRepositoryProvider).setCommentDisliked(
            widget.videoId,
            id,
            disliked: disliked,
          );
      await _load();
    } catch (_) {}
  }

  Future<void> _togglePin(Map<String, dynamic> comment) async {
    final id = comment['id'] as String;
    final pinned = comment['isPinned'] == true;
    try {
      await ref.read(watchRepositoryProvider).setCommentPinned(
            widget.videoId,
            id,
            isPinned: !pinned,
          );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update pin')),
        );
      }
    }
  }

  Future<void> _toggleHeart(Map<String, dynamic> comment) async {
    final id = comment['id'] as String;
    final hearted = comment['creatorHearted'] == true;
    try {
      await ref.read(watchRepositoryProvider).setCreatorHeart(
            widget.videoId,
            id,
            creatorHearted: !hearted,
          );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update heart')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = _viewerId != null && _viewerId == widget.videoOwnerId;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text('Comments', style: Theme.of(context).textTheme.titleMedium),
            ),
            PopupMenuButton<String>(
              tooltip: 'Sort comments',
              initialValue: _sort,
              onSelected: _setSort,
              itemBuilder: (context) => const [
                PopupMenuItem(value: 'top', child: Text('Top')),
                PopupMenuItem(value: 'newest', child: Text('Newest')),
                PopupMenuItem(value: 'oldest', child: Text('Oldest')),
              ],
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _sort == 'newest'
                          ? 'Newest'
                          : _sort == 'oldest'
                              ? 'Oldest'
                              : 'Top',
                      style: TextStyle(fontSize: 13, color: ForgeTokens.of(context).primary),
                    ),
                    Icon(Icons.arrow_drop_down, size: 18, color: ForgeTokens.of(context).primary),
                  ],
                ),
              ),
            ),
          ],
        ),
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
            IconButton(onPressed: _post, icon: Icon(Icons.send)),
          ],
        ),
        if (_loading)
          const Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator())
        else if (_comments.isEmpty)
          Text('No comments yet', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant))
        else ...[
          ..._comments.map((c) {
            final m = c as Map<String, dynamic>;
            final user = m['user'] as Map<String, dynamic>?;
            final likeCount = m['likeCount'] as int? ?? 0;
            final liked = m['viewerLiked'] == true;
            final disliked = m['viewerDisliked'] == true;
            final pinned = m['isPinned'] == true;
            final hearted = m['creatorHearted'] == true;
            final parentId = m['parentId'];
            final replyCount = m['replyCount'] as int? ?? 0;
            final commentId = m['id'] as String? ?? '';
            final repliesExpanded = _expandedReplies.contains(commentId);
            final authorId = m['userId'] as String? ?? user?['id'] as String?;
            final isMine = _viewerId != null && authorId == _viewerId;
            final isHighlighted = widget.highlightCommentId != null && widget.highlightCommentId == commentId;
            final key = _commentKeys.putIfAbsent(commentId, GlobalKey.new);
            final editing = _editingId == commentId;
            return Container(
              key: key,
              decoration: isHighlighted
                  ? BoxDecoration(
                      color: ForgeTokens.of(context).primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                    )
                  : null,
              child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (pinned)
                  Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      'Pinned',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: ForgeTokens.of(context).onSurfaceVariant,
                      ),
                    ),
                  ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Row(
                    children: [
                      Expanded(child: Text(user?['displayName'] as String? ?? 'User')),
                      if (hearted)
                        Icon(Icons.favorite, size: 14, color: ForgeTokens.of(context).error),
                    ],
                  ),
                  subtitle: editing
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TextField(
                              controller: _editCtrl,
                              maxLines: 3,
                              decoration: const InputDecoration(isDense: true),
                            ),
                            Row(
                              children: [
                                TextButton(
                                  onPressed: () => setState(() => _editingId = null),
                                  child: const Text('Cancel'),
                                ),
                                FilledButton(
                                  onPressed: _saveEdit,
                                  child: const Text('Save'),
                                ),
                              ],
                            ),
                          ],
                        )
                      : _LinkifiedText(
                          text: m['content'] as String? ?? '',
                          videoId: widget.videoId,
                          style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                        ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: Icon(liked ? Icons.thumb_up : Icons.thumb_up_outlined, size: 18),
                        onPressed: () => _toggleLike(m),
                      ),
                      if (likeCount > 0) Text('$likeCount', style: TextStyle(fontSize: 12)),
                      IconButton(
                        tooltip: disliked ? 'Remove dislike' : 'Dislike',
                        icon: Icon(disliked ? Icons.thumb_down : Icons.thumb_down_outlined, size: 18),
                        onPressed: () => _toggleDislike(m),
                      ),
                      if (isOwner && parentId == null)
                        IconButton(
                          tooltip: pinned ? 'Unpin' : 'Pin',
                          icon: Icon(pinned ? Icons.push_pin : Icons.push_pin_outlined, size: 18),
                          onPressed: () => _togglePin(m),
                        ),
                      if (isOwner)
                        IconButton(
                          tooltip: hearted ? 'Remove heart' : 'Heart',
                          icon: Icon(
                            hearted ? Icons.favorite : Icons.favorite_border,
                            size: 18,
                            color: hearted ? ForgeTokens.of(context).error : null,
                          ),
                          onPressed: () => _toggleHeart(m),
                        ),
                      IconButton(
                        icon: const Icon(Icons.reply, size: 18),
                        onPressed: () => _startReply(m),
                      ),
                      PopupMenuButton<String>(
                        tooltip: 'More',
                        onSelected: (value) async {
                          if (value == 'copy') {
                            final id = m['id'] as String?;
                            if (id == null) return;
                            final url =
                                '${AppConstants.webBaseUrl}/watch/${widget.videoId}?lc=$id';
                            await SharePlus.instance.share(ShareParams(text: url));
                          } else if (value == 'report') {
                            await _reportComment(m);
                          } else if (value == 'edit') {
                            await _editComment(m);
                          } else if (value == 'delete') {
                            await _deleteComment(m);
                          }
                        },
                        itemBuilder: (context) => [
                          const PopupMenuItem(value: 'copy', child: Text('Copy link')),
                          if (isMine) ...[
                            const PopupMenuItem(value: 'edit', child: Text('Edit')),
                            const PopupMenuItem(value: 'delete', child: Text('Delete')),
                          ],
                          if (isOwner && !isMine)
                            const PopupMenuItem(value: 'delete', child: Text('Remove')),
                          if (!isMine)
                            const PopupMenuItem(value: 'report', child: Text('Report')),
                        ],
                      ),
                    ],
                  ),
                ),
                if (parentId == null && replyCount > 0)
                  TextButton(
                    onPressed: () => _toggleReplies(m),
                    child: Text(
                      repliesExpanded
                          ? 'Hide replies'
                          : 'View $replyCount ${replyCount == 1 ? 'reply' : 'replies'}',
                    ),
                  ),
                if (repliesExpanded) ...[
                  if (_loadingReplies.contains(commentId))
                    const Padding(
                      padding: EdgeInsets.only(left: 24, bottom: 8),
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  else
                    ...(_replies[commentId] ?? []).map((raw) {
                      final r = raw as Map<String, dynamic>;
                      final ru = r['user'] as Map<String, dynamic>?;
                      return Padding(
                        padding: const EdgeInsets.only(left: 24, bottom: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              ru?['displayName'] as String? ?? 'User',
                              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            Text(
                              r['content'] as String? ?? '',
                              style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                            ),
                            TextButton(
                              onPressed: () => _startReply(r),
                              child: const Text('Reply'),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
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
  final String title;
  final String? thumbnailUrl;
  final String? videoType;
  final bool looping;
  final double playbackRate;
  final VoidCallback? onEnded;
  const _HlsPlayerBlock({
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
  ConsumerState<_HlsPlayerBlock> createState() => _HlsPlayerBlockState();
}

class _HlsPlayerBlockState extends ConsumerState<_HlsPlayerBlock> with WidgetsBindingObserver {
  VideoPlayerController? _video;
  ChewieController? _chewie;
  bool _endedFired = false;
  double _lastVolume = 1;
  bool _lastMuted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bootstrap();
  }

  /// HIGH-08: pause decoding/buffering when the app is backgrounded.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _video?.pause();
    }
  }

  @override
  void didUpdateWidget(covariant _HlsPlayerBlock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _endedFired = false;
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
    await vc.initialize();
    if (!mounted) return;
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
            : Center(child: CircularProgressIndicator(color: ForgeTokens.of(context).primary)),
      ),
    );
  }
}

/// "Up next" rail backed by the content-based related recommendations endpoint
/// (`GET /videos/:id/related`). Best-effort: silently hides if nothing relevant.
class _RelatedVideosSection extends ConsumerStatefulWidget {
  final String videoId;
  final String? playlistId;
  final bool shuffle;
  const _RelatedVideosSection({
    required this.videoId,
    this.playlistId,
    this.shuffle = false,
  });

  @override
  ConsumerState<_RelatedVideosSection> createState() => _RelatedVideosSectionState();
}

class _RelatedVideosSectionState extends ConsumerState<_RelatedVideosSection> {
  List<dynamic> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _RelatedVideosSection oldWidget) {
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
                        _watchListHref(
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
