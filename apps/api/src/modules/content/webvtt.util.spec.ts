import { vttToPlainText } from './webvtt.util';

describe('vttToPlainText', () => {
  it('extracts plain text from a standard WebVTT file', () => {
    const vtt = [
      'WEBVTT',
      '',
      '1',
      '00:00:01.000 --> 00:00:04.000',
      'Hello and welcome to the show.',
      '',
      '2',
      '00:00:04.500 --> 00:00:07.000',
      "Today we're talking about FORGE.",
      '',
    ].join('\n');

    expect(vttToPlainText(vtt)).toBe(
      "Hello and welcome to the show. Today we're talking about FORGE.",
    );
  });

  it('strips inline tags like <v Speaker> and <b>', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:04.000',
      '<v Alice>Hello <b>world</b></v>',
      '',
    ].join('\n');

    expect(vttToPlainText(vtt)).toBe('Hello world');
  });

  it('dedupes consecutive identical lines from rolling captions', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'same line',
      '',
      '00:00:02.000 --> 00:00:03.000',
      'same line',
      '',
      '00:00:03.000 --> 00:00:04.000',
      'different line',
      '',
    ].join('\n');

    expect(vttToPlainText(vtt)).toBe('same line different line');
  });

  it('ignores NOTE/STYLE/REGION blocks', () => {
    const vtt = [
      'WEBVTT',
      '',
      'NOTE this is a comment',
      '',
      'STYLE',
      '::cue { color: yellow; }',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'Actual caption text',
      '',
    ].join('\n');

    expect(vttToPlainText(vtt)).toContain('Actual caption text');
    expect(vttToPlainText(vtt)).not.toContain('yellow');
  });

  it('returns empty string for empty input', () => {
    expect(vttToPlainText('')).toBe('');
  });

  it('truncates output longer than maxLength', () => {
    const longLine = 'word '.repeat(50);
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:02.000', longLine].join('\n');
    expect(vttToPlainText(vtt, 10)).toHaveLength(10);
  });
});
