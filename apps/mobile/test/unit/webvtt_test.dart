import 'package:flutter_test/flutter_test.dart';
import 'package:forge_mobile/core/utils/webvtt.dart';

void main() {
  test('parseWebVtt extracts cues and strips markup', () {
    const source = '''
WEBVTT

00:00:01.000 --> 00:00:03.000
Hello <b>world</b>

00:00:04.000 --> 00:00:06.000
Second cue
''';
    final cues = parseWebVtt(source);
    expect(cues, hasLength(2));
    expect(cues[0].startSeconds, 1);
    expect(cues[0].text, 'Hello world');
    expect(cues[1].text, 'Second cue');
  });

  test('formatCueTimestamp pads minutes', () {
    expect(formatCueTimestamp(65), '1:05');
    expect(formatCueTimestamp(3661), '1:01:01');
  });
}
