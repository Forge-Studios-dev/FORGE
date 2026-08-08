/// Minimal WebVTT cue parser for transcript UI (mirrors web `lib/webvtt.ts`).
class VttCue {
  final double startSeconds;
  final double endSeconds;
  final String text;

  const VttCue({
    required this.startSeconds,
    required this.endSeconds,
    required this.text,
  });
}

String _stripCueMarkup(String text) {
  return text
      .replaceAll(RegExp(r'<[^>]+>'), ' ')
      .replaceAll(RegExp(r'[<>]'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

double? _parseTimestamp(String raw) {
  final parts = raw.trim().replaceAll(',', '.').split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  final nums = parts.map(double.tryParse).toList();
  if (nums.any((n) => n == null)) return null;
  if (nums.length == 2) {
    return nums[0]! * 60 + nums[1]!;
  }
  return nums[0]! * 3600 + nums[1]! * 60 + nums[2]!;
}

List<VttCue> parseWebVtt(String source) {
  if (source.trim().isEmpty) return const [];
  final normalized = source.replaceFirst(RegExp(r'^\uFEFF'), '').replaceAll('\r\n', '\n');
  final blocks = normalized.split(RegExp(r'\n\n+'));
  final cues = <VttCue>[];

  for (final block in blocks) {
    final lines = block
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    if (lines.isEmpty) continue;
    if (lines[0].startsWith('WEBVTT') ||
        lines[0].startsWith('NOTE') ||
        lines[0].startsWith('STYLE')) {
      continue;
    }
    var timingLine = lines[0];
    var textLines = lines.skip(1).toList();
    if (!timingLine.contains('-->') && lines.length > 1 && lines[1].contains('-->')) {
      timingLine = lines[1];
      textLines = lines.skip(2).toList();
    }
    if (!timingLine.contains('-->')) continue;
    final parts = timingLine.split('-->');
    if (parts.length < 2) continue;
    final startRaw = parts[0].trim().split(RegExp(r'\s+')).first;
    final endRaw = parts[1].trim().split(RegExp(r'\s+')).first;
    final startSeconds = _parseTimestamp(startRaw);
    final endSeconds = _parseTimestamp(endRaw);
    if (startSeconds == null || endSeconds == null) continue;
    final text = _stripCueMarkup(textLines.join(' '));
    if (text.isEmpty) continue;
    cues.add(VttCue(startSeconds: startSeconds, endSeconds: endSeconds, text: text));
  }

  return cues;
}

/// Active caption line at [seconds], or null if none.
String? activeCueTextAt(List<VttCue> cues, double seconds) {
  for (final cue in cues) {
    if (seconds >= cue.startSeconds && seconds < cue.endSeconds) {
      return cue.text;
    }
  }
  return null;
}

String formatCueTimestamp(double seconds) {
  final total = seconds.floor().clamp(0, 24 * 3600);
  final h = total ~/ 3600;
  final m = (total % 3600) ~/ 60;
  final s = total % 60;
  if (h > 0) {
    return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }
  return '$m:${s.toString().padLeft(2, '0')}';
}
