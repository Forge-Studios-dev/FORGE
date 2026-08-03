import { describe, expect, it } from 'vitest';
import { parseWebVtt } from './webvtt';

describe('parseWebVtt', () => {
  it('parses cues with optional identifiers', () => {
    const cues = parseWebVtt(`WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello world

00:01:00.500 --> 00:01:02.000
Second line
`);
    expect(cues).toEqual([
      { startSeconds: 1, endSeconds: 4, text: 'Hello world' },
      { startSeconds: 60.5, endSeconds: 62, text: 'Second line' },
    ]);
  });

  it('strips simple tags and ignores NOTE blocks', () => {
    const cues = parseWebVtt(`WEBVTT

NOTE skip me

00:00:00.000 --> 00:00:01.000
<c>Hi</c> there
`);
    expect(cues).toEqual([{ startSeconds: 0, endSeconds: 1, text: 'Hi there' }]);
  });
});
