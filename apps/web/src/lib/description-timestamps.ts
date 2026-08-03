/**
 * Parse YouTube-style timestamps (1:23, 1:02:03) and plain text into React nodes.
 */

const TIMESTAMP_RE = /(?:^|[\s([{])((?:\d{1,2}:)?[0-5]?\d:[0-5]\d)(?=$|[\s)\].,!?;:])/g;
/** Hashtags: #tag (letters, digits, underscore; min 2 chars after #). */
const HASHTAG_RE = /#([\p{L}\p{N}_]{2,64})/gu;

export function parseTimestampToSeconds(raw: string): number | null {
  const parts = raw.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s > 59) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m > 59 || s > 59) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

export type DescriptionSegment =
  | { type: 'text'; value: string }
  | { type: 'timestamp'; value: string; seconds: number }
  | { type: 'hashtag'; value: string; query: string };

function splitHashtags(text: string): DescriptionSegment[] {
  if (!text) return [];
  const segments: DescriptionSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(HASHTAG_RE.source, HASHTAG_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const tag = match[1];
    segments.push({ type: 'hashtag', value: `#${tag}`, query: tag });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

export function splitDescriptionTimestamps(text: string): DescriptionSegment[] {
  if (!text) return [];
  const segments: DescriptionSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(TIMESTAMP_RE.source, TIMESTAMP_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const stamp = match[1];
    const stampIndex = match.index + match[0].indexOf(stamp);
    const seconds = parseTimestampToSeconds(stamp);
    if (seconds === null) continue;
    if (stampIndex > lastIndex) {
      segments.push(...splitHashtags(text.slice(lastIndex, stampIndex)));
    }
    segments.push({ type: 'timestamp', value: stamp, seconds });
    lastIndex = stampIndex + stamp.length;
  }
  if (lastIndex < text.length) {
    segments.push(...splitHashtags(text.slice(lastIndex)));
  }
  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

export type VideoChapter = { seconds: number; title: string; label: string };

/**
 * YouTube-style chapters: lines starting with a timestamp + title.
 * Requires at least 3 chapters and a first chapter at 0:00 (YouTube rule).
 */
const CHAPTER_LINE_RE =
  /^\s*((?:\d{1,2}:)?[0-5]?\d:[0-5]\d)\s+(.+?)\s*$/gm;

export function extractVideoChapters(description: string | null | undefined): VideoChapter[] {
  if (!description) return [];
  const chapters: VideoChapter[] = [];
  const re = new RegExp(CHAPTER_LINE_RE.source, CHAPTER_LINE_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(description)) !== null) {
    const label = match[1];
    const seconds = parseTimestampToSeconds(label);
    const title = match[2]?.trim();
    if (seconds === null || !title) continue;
    if (chapters.some((c) => c.seconds === seconds)) continue;
    chapters.push({ seconds, title, label });
  }
  chapters.sort((a, b) => a.seconds - b.seconds);
  if (chapters.length < 3) return [];
  if (chapters[0].seconds !== 0) return [];
  return chapters;
}

