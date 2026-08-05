// YouTube-style description chapters (mirror web `description-timestamps.ts`).

class VideoChapter {
  final int seconds;
  final String title;
  final String label;

  const VideoChapter({
    required this.seconds,
    required this.title,
    required this.label,
  });

  @override
  bool operator ==(Object other) =>
      other is VideoChapter &&
      other.seconds == seconds &&
      other.title == title &&
      other.label == label;

  @override
  int get hashCode => Object.hash(seconds, title, label);
}

final _chapterLineRe = RegExp(
  r'^\s*((?:\d{1,2}:)?[0-5]?\d:[0-5]\d)\s+(.+?)\s*$',
  multiLine: true,
);

int? parseTimestampToSeconds(String raw) {
  final parts = raw.split(':');
  if (parts.length == 2) {
    final m = int.tryParse(parts[0]);
    final s = int.tryParse(parts[1]);
    if (m == null || s == null || s > 59) return null;
    return m * 60 + s;
  }
  if (parts.length == 3) {
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    final s = int.tryParse(parts[2]);
    if (h == null || m == null || s == null || m > 59 || s > 59) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

/// Count description lines that look like chapter candidates (may still fail YouTube rules).
int countChapterCandidateLines(String description) {
  if (description.isEmpty) return 0;
  return _chapterLineRe.allMatches(description).length;
}

/// Requires ≥3 chapters and a first chapter at 0:00 (YouTube rule).
List<VideoChapter> extractVideoChapters(String? description) {
  if (description == null || description.isEmpty) return const [];
  final chapters = <VideoChapter>[];
  for (final match in _chapterLineRe.allMatches(description)) {
    final label = match.group(1)!;
    final seconds = parseTimestampToSeconds(label);
    final title = match.group(2)?.trim();
    if (seconds == null || title == null || title.isEmpty) continue;
    if (chapters.any((c) => c.seconds == seconds)) continue;
    chapters.add(VideoChapter(seconds: seconds, title: title, label: label));
  }
  chapters.sort((a, b) => a.seconds.compareTo(b.seconds));
  if (chapters.length < 3) return const [];
  if (chapters.first.seconds != 0) return const [];
  return chapters;
}
