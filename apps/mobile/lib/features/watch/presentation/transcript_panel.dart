import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/webvtt.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../shared/models/video.dart';
import '../data/watch_repository.dart';

final transcriptCuesProvider = FutureProvider.autoDispose
    .family<List<VttCue>, ({String videoId, String language})>((ref, args) async {
  final text = await ref.read(watchRepositoryProvider).getCaptionText(
        args.videoId,
        language: args.language,
      );
  return parseWebVtt(text);
});

/// YouTube-style expandable transcript from caption tracks / legacy caption URL.
class TranscriptPanel extends ConsumerStatefulWidget {
  const TranscriptPanel({
    super.key,
    required this.video,
    required this.currentSeconds,
    required this.onSeek,
  });

  final VideoModel video;
  final int currentSeconds;
  final ValueChanged<int> onSeek;

  @override
  ConsumerState<TranscriptPanel> createState() => _TranscriptPanelState();
}

class _TranscriptPanelState extends ConsumerState<TranscriptPanel> {
  bool _open = false;
  String? _lang;

  List<CaptionTrack> get _tracks {
    final video = widget.video;
    if (video.captionTracks.isNotEmpty) return video.captionTracks;
    final url = video.captionUrl;
    if (url != null && url.isNotEmpty) {
      return [CaptionTrack(language: 'en', label: 'English', url: url)];
    }
    return const [];
  }

  @override
  Widget build(BuildContext context) {
    final tracks = _tracks;
    if (tracks.isEmpty) return const SizedBox.shrink();

    final t = ForgeTokens.of(context);
    final activeLang = _lang ?? tracks.first.language;

    return ForgeCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: () => setState(() => _open = !_open),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    alignment: Alignment.centerLeft,
                  ),
                  child: Text(
                    _open ? 'Hide transcript' : 'Show transcript',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: t.primary,
                    ),
                  ),
                ),
              ),
              if (_open && tracks.length > 1)
                DropdownButton<String>(
                  value: tracks.any((c) => c.language == activeLang)
                      ? activeLang
                      : tracks.first.language,
                  underline: const SizedBox.shrink(),
                  items: tracks
                      .map(
                        (c) => DropdownMenuItem(
                          value: c.language,
                          child: Text(c.label.isNotEmpty ? c.label : c.language),
                        ),
                      )
                      .toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _lang = v);
                  },
                ),
            ],
          ),
          if (_open) ...[
            const SizedBox(height: 8),
            ref.watch(transcriptCuesProvider((videoId: widget.video.id, language: activeLang))).when(
                  loading: () => Text(
                    'Loading transcript…',
                    style: TextStyle(color: t.onSurfaceVariant, fontSize: 13),
                  ),
                  error: (_, __) => Text(
                    'Could not load captions for this video.',
                    style: TextStyle(color: t.error, fontSize: 13),
                  ),
                  data: (cues) {
                    if (cues.isEmpty) {
                      return Text(
                        'No cue text found in this track.',
                        style: TextStyle(color: t.onSurfaceVariant, fontSize: 13),
                      );
                    }
                    var activeIndex = -1;
                    for (var i = 0; i < cues.length; i++) {
                      if (cues[i].startSeconds <= widget.currentSeconds + 0.25) {
                        activeIndex = i;
                      } else {
                        break;
                      }
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            onPressed: () async {
                              final text = cues
                                  .map((c) => c.text.trim())
                                  .where((s) => s.isNotEmpty)
                                  .join('\n');
                              await Clipboard.setData(ClipboardData(text: text));
                              if (!context.mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Transcript copied')),
                              );
                            },
                            icon: const Icon(Icons.copy, size: 16),
                            label: const Text('Copy transcript'),
                          ),
                        ),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 280),
                          child: ListView.builder(
                            shrinkWrap: true,
                            itemCount: cues.length,
                            itemBuilder: (context, i) {
                              final cue = cues[i];
                              final active = i == activeIndex;
                              return InkWell(
                                onTap: () => widget.onSeek(cue.startSeconds.round()),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 6),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      SizedBox(
                                        width: 44,
                                        child: Text(
                                          formatCueTimestamp(cue.startSeconds),
                                          style: TextStyle(
                                            fontFamily: 'monospace',
                                            fontSize: 12,
                                            color: t.outline,
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        child: Text(
                                          cue.text,
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: active ? t.primary : t.onSurfaceVariant,
                                            fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    );
                  },
                ),
          ],
        ],
      ),
    );
  }
}
