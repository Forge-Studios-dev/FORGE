import 'package:flutter/material.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/description_chapters.dart';
import '../../../core/widgets/forge_card.dart';

/// YouTube-style chapters from description timestamp lines.
class ChaptersPanel extends StatelessWidget {
  const ChaptersPanel({
    super.key,
    required this.chapters,
    required this.currentSeconds,
    required this.onSeek,
    this.durationSeconds,
  });

  final List<VideoChapter> chapters;
  final int currentSeconds;
  final ValueChanged<int> onSeek;
  final double? durationSeconds;

  int get _activeIndex {
    var idx = 0;
    for (var i = 0; i < chapters.length; i++) {
      if (chapters[i].seconds <= currentSeconds + 0.5) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }

  double get _duration {
    final last = chapters.isEmpty ? 0.0 : chapters.last.seconds.toDouble();
    final fromVideo = durationSeconds ?? 0.0;
    if (fromVideo >= last && fromVideo >= 1) return fromVideo;
    if (last >= 1) return last;
    return 1.0;
  }

  int _segmentFlex(int i, double duration) {
    final start = chapters[i].seconds;
    final next = i + 1 < chapters.length ? chapters[i + 1].seconds : duration.round();
    return ((next - start) / duration * 1000).round().clamp(20, 100000);
  }

  @override
  Widget build(BuildContext context) {
    if (chapters.length < 3) return const SizedBox.shrink();

    final t = ForgeTokens.of(context);
    final active = _activeIndex;
    final duration = _duration;

    return ForgeCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Chapters',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: t.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: SizedBox(
              height: 8,
              child: Row(
                children: [
                  for (var i = 0; i < chapters.length; i++) ...[
                    Expanded(
                      flex: _segmentFlex(i, duration),
                      child: Material(
                        color: i == active ? t.primary : t.primary.withValues(alpha: 0.35),
                        child: InkWell(
                          onTap: () => onSeek(chapters[i].seconds),
                          child: const SizedBox.expand(),
                        ),
                      ),
                    ),
                    if (i < chapters.length - 1)
                      Container(width: 1, color: t.background),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: chapters[active].title,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: t.onSurface,
                  ),
                ),
                TextSpan(
                  text: ' · ${chapters[active].label}',
                  style: TextStyle(color: t.onSurfaceVariant),
                ),
              ],
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 160),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: chapters.length,
              itemBuilder: (context, i) {
                final chapter = chapters[i];
                final isActive = i == active;
                return InkWell(
                  onTap: () => onSeek(chapter.seconds),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 48,
                          child: Text(
                            chapter.label,
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: t.onSurfaceVariant,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            chapter.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: isActive ? t.primary : t.onSurfaceVariant,
                              fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
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
      ),
    );
  }
}
