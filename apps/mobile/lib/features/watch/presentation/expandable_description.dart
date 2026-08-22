import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/description_chapters.dart';
import 'watch_screen.dart';

class ExpandableDescription extends ConsumerStatefulWidget {
  final String videoId;
  final String description;
  const ExpandableDescription({required this.videoId, required this.description});

  @override
  ConsumerState<ExpandableDescription> createState() => _ExpandableDescriptionState();
}

class _ExpandableDescriptionState extends ConsumerState<ExpandableDescription> {
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
        LinkifiedText(
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

class LinkifiedText extends ConsumerWidget {
  final String text;
  final String videoId;
  final TextStyle? style;
  const LinkifiedText({required this.text, required this.videoId, this.style});

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
