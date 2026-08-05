import 'package:flutter/material.dart';
import '../theme/forge_tokens.dart';
import '../utils/description_chapters.dart';

/// Live preview / validation for YouTube-style chapters in a description field.
class DescriptionChaptersHint extends StatelessWidget {
  const DescriptionChaptersHint({super.key, required this.description});

  final String description;

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    final preview = extractVideoChapters(description);
    final lineCount = countChapterCandidateLines(description);

    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Chapters need ≥3 timestamp lines starting at 0:00 (e.g. 0:00 Intro).',
            style: TextStyle(fontSize: 12, color: t.onSurfaceVariant, height: 1.35),
          ),
          if (preview.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: t.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: t.primary.withValues(alpha: 0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${preview.length} chapters will show on watch',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: t.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  ...preview.take(8).map(
                        (c) => Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            '${c.label}  ${c.title}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: t.onSurfaceVariant,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                      ),
                ],
              ),
            ),
          ] else if (lineCount > 0) ...[
            const SizedBox(height: 4),
            Text(
              lineCount < 3
                  ? 'Add ${3 - lineCount} more timestamp line${3 - lineCount == 1 ? '' : 's'} (and start at 0:00) for chapters.'
                  : 'First chapter must start at 0:00 for chapters to appear.',
              style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }
}
