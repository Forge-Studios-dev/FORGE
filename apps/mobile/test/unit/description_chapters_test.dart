import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/utils/description_chapters.dart';

void main() {
  test('parses mm:ss and hh:mm:ss', () {
    expect(parseTimestampToSeconds('1:23'), 83);
    expect(parseTimestampToSeconds('10:05'), 605);
    expect(parseTimestampToSeconds('1:02:03'), 3723);
    expect(parseTimestampToSeconds('0:05'), 5);
  });

  test('rejects invalid stamps', () {
    expect(parseTimestampToSeconds('1:99'), isNull);
    expect(parseTimestampToSeconds('abc'), isNull);
  });

  test('extracts YouTube-style chapters', () {
    final chapters = extractVideoChapters(
      'Hello\n0:00 Intro\n0:45 Setup\n1:30 Demo\n2:00 Outro',
    );
    expect(chapters, [
      const VideoChapter(seconds: 0, title: 'Intro', label: '0:00'),
      const VideoChapter(seconds: 45, title: 'Setup', label: '0:45'),
      const VideoChapter(seconds: 90, title: 'Demo', label: '1:30'),
      const VideoChapter(seconds: 120, title: 'Outro', label: '2:00'),
    ]);
  });

  test('rejects chapter lists without 0:00 or fewer than 3', () {
    expect(extractVideoChapters('0:30 Late\n1:00 Next\n2:00 End'), isEmpty);
    expect(extractVideoChapters('0:00 Only two\n1:00 Chapters'), isEmpty);
  });

  test('counts chapter candidate lines even when extract returns empty', () {
    expect(countChapterCandidateLines('0:00 A\n1:00 B'), 2);
    expect(countChapterCandidateLines('0:30 Late\n1:00 Next\n2:00 End'), 3);
    expect(countChapterCandidateLines('no stamps here'), 0);
  });

  test('formats and rewrites chapter draft rows', () {
    expect(formatSecondsAsTimestamp(0), '0:00');
    expect(formatSecondsAsTimestamp(83), '1:23');
    expect(formatSecondsAsTimestamp(3723), '1:02:03');
    const desc = 'Hello world\n\n0:00 Intro\n0:45 Setup\n1:30 Demo';
    expect(listChapterDraftRows(desc), [
      const ChapterDraftRow(time: '0:00', title: 'Intro'),
      const ChapterDraftRow(time: '0:45', title: 'Setup'),
      const ChapterDraftRow(time: '1:30', title: 'Demo'),
    ]);
    expect(stripChapterLinesFromDescription(desc), 'Hello world');
    expect(
      applyChapterRowsToDescription(desc, const [
        ChapterDraftRow(time: '0:00', title: 'Intro'),
        ChapterDraftRow(time: '1:00', title: 'Middle'),
        ChapterDraftRow(time: '2:00', title: 'End'),
      ]),
      'Hello world\n\n0:00 Intro\n1:00 Middle\n2:00 End',
    );
  });
}
