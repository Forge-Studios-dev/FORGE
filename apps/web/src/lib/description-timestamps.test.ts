import { describe, expect, it } from 'vitest';
import { parseTimestampToSeconds, splitDescriptionTimestamps, extractVideoChapters } from './description-timestamps';

describe('description-timestamps', () => {
  it('parses mm:ss and hh:mm:ss', () => {
    expect(parseTimestampToSeconds('1:23')).toBe(83);
    expect(parseTimestampToSeconds('10:05')).toBe(605);
    expect(parseTimestampToSeconds('1:02:03')).toBe(3723);
    expect(parseTimestampToSeconds('0:05')).toBe(5);
  });

  it('rejects invalid stamps', () => {
    expect(parseTimestampToSeconds('1:99')).toBeNull();
    expect(parseTimestampToSeconds('abc')).toBeNull();
  });

  it('splits text around clickable timestamps', () => {
    const parts = splitDescriptionTimestamps('Intro 0:45 then 1:02:00 outro');
    expect(parts).toEqual([
      { type: 'text', value: 'Intro ' },
      { type: 'timestamp', value: '0:45', seconds: 45 },
      { type: 'text', value: ' then ' },
      { type: 'timestamp', value: '1:02:00', seconds: 3720 },
      { type: 'text', value: ' outro' },
    ]);
  });

  it('splits hashtags into searchable links', () => {
    const parts = splitDescriptionTimestamps('Learn #ForgeTips and #TypeScript today');
    expect(parts).toEqual([
      { type: 'text', value: 'Learn ' },
      { type: 'hashtag', value: '#ForgeTips', query: 'ForgeTips' },
      { type: 'text', value: ' and ' },
      { type: 'hashtag', value: '#TypeScript', query: 'TypeScript' },
      { type: 'text', value: ' today' },
    ]);
  });

  it('keeps hashtags alongside timestamps', () => {
    const parts = splitDescriptionTimestamps('Start #intro at 0:30');
    expect(parts).toEqual([
      { type: 'text', value: 'Start ' },
      { type: 'hashtag', value: '#intro', query: 'intro' },
      { type: 'text', value: ' at ' },
      { type: 'timestamp', value: '0:30', seconds: 30 },
    ]);
  });

  it('extracts YouTube-style chapters', () => {
    const chapters = extractVideoChapters(
      'Hello\n0:00 Intro\n0:45 Setup\n1:30 Demo\n2:00 Outro',
    );
    expect(chapters).toEqual([
      { seconds: 0, title: 'Intro', label: '0:00' },
      { seconds: 45, title: 'Setup', label: '0:45' },
      { seconds: 90, title: 'Demo', label: '1:30' },
      { seconds: 120, title: 'Outro', label: '2:00' },
    ]);
  });

  it('rejects chapter lists without 0:00 or fewer than 3', () => {
    expect(extractVideoChapters('0:30 Late\n1:00 Next\n2:00 End')).toEqual([]);
    expect(extractVideoChapters('0:00 Only two\n1:00 Chapters')).toEqual([]);
  });
});
