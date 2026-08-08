import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/local_cache.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/webvtt.dart';
import '../../../shared/models/video.dart';
import 'transcript_panel.dart';

const ccPrefKey = 'forge.watch.cc';

List<CaptionTrack> captionTracksForVideo(VideoModel video) {
  if (video.captionTracks.isNotEmpty) return video.captionTracks;
  final url = video.captionUrl;
  if (url != null && url.isNotEmpty) {
    return [CaptionTrack(language: 'en', label: 'English', url: url)];
  }
  return const [];
}

/// In-player closed captions (YouTube-style CC) over the HLS player.
class PlayerCaptionsOverlay extends ConsumerStatefulWidget {
  const PlayerCaptionsOverlay({
    super.key,
    required this.video,
    required this.videoId,
    required this.currentSeconds,
    this.cueInsetBottom = 48,
  });

  final VideoModel video;
  final String videoId;
  final int currentSeconds;
  /// Distance from bottom for cue text (Shorts needs more clearance).
  final double cueInsetBottom;

  @override
  ConsumerState<PlayerCaptionsOverlay> createState() => _PlayerCaptionsOverlayState();
}

class _PlayerCaptionsOverlayState extends ConsumerState<PlayerCaptionsOverlay> {
  late bool _enabled;
  String? _lang;

  @override
  void initState() {
    super.initState();
    // Default on when tracks exist; user can turn off (persisted).
    final pref = LocalCache.read(ccPrefKey);
    _enabled = pref == null ? true : pref == '1';
  }

  List<CaptionTrack> get _tracks => captionTracksForVideo(widget.video);

  Future<void> _setEnabled(bool next) async {
    setState(() => _enabled = next);
    await LocalCache.write(ccPrefKey, next ? '1' : '0');
  }

  @override
  Widget build(BuildContext context) {
    final tracks = _tracks;
    if (tracks.isEmpty) return const SizedBox.shrink();

    final t = ForgeTokens.of(context);
    final activeLang = _lang ?? tracks.first.language;

    return Stack(
      fit: StackFit.expand,
      children: [
        if (_enabled)
          Positioned(
            left: 12,
            right: 12,
            bottom: widget.cueInsetBottom,
            child: ref
                .watch(
                  transcriptCuesProvider((videoId: widget.videoId, language: activeLang)),
                )
                .when(
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (cues) {
                    final text = activeCueTextAt(cues, widget.currentSeconds.toDouble());
                    if (text == null || text.isEmpty) return const SizedBox.shrink();
                    return IgnorePointer(
                      child: Align(
                        alignment: Alignment.bottomCenter,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.72),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            child: Text(
                              text,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                height: 1.25,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
          ),
        Positioned(
          top: 8,
          right: 8,
          child: Material(
            color: Colors.black.withValues(alpha: 0.55),
            borderRadius: BorderRadius.circular(20),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: _enabled ? 'Turn off captions' : 'Turn on captions',
                  visualDensity: VisualDensity.compact,
                  onPressed: () => _setEnabled(!_enabled),
                  icon: Icon(
                    Icons.closed_caption,
                    color: _enabled ? t.primary : Colors.white70,
                    size: 22,
                  ),
                ),
                if (_enabled && tracks.length > 1)
                  PopupMenuButton<String>(
                    tooltip: 'Caption language',
                    icon: const Icon(Icons.arrow_drop_down, color: Colors.white70, size: 20),
                    onSelected: (v) => setState(() => _lang = v),
                    itemBuilder: (context) => tracks
                        .map(
                          (c) => PopupMenuItem(
                            value: c.language,
                            child: Text(c.label.isNotEmpty ? c.label : c.language),
                          ),
                        )
                        .toList(),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
