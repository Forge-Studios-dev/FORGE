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

/** Count description lines that look like chapter candidates (may still fail YouTube rules). */
export function countChapterCandidateLines(description: string): number {
  if (!description) return 0;
  return [...description.matchAll(new RegExp(CHAPTER_LINE_RE.source, CHAPTER_LINE_RE.flags))].length;
}

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

/** Format seconds as `m:ss` or `h:mm:ss` for description chapter lines. */
export function formatSecondsAsTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

export type ChapterDraftRow = { time: string; title: string };

/** Raw timestamp lines (no ≥3 / 0:00 gate) for the Studio chapters editor. */
export function listChapterDraftRows(description: string | null | undefined): ChapterDraftRow[] {
  if (!description) return [];
  const rows: ChapterDraftRow[] = [];
  const re = new RegExp(CHAPTER_LINE_RE.source, CHAPTER_LINE_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(description)) !== null) {
    rows.push({ time: match[1], title: match[2]?.trim() ?? '' });
  }
  return rows;
}

/** Remove chapter-looking lines; keep the rest of the description body. */
export function stripChapterLinesFromDescription(description: string): string {
  if (!description) return '';
  const keep = description
    .split(/\r?\n/)
    .filter((line) => !new RegExp(CHAPTER_LINE_RE.source).test(line));
  return keep.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

/**
 * Rewrite description chapter block from editor rows.
 * Incomplete rows (empty time/title) are skipped; body text is preserved.
 */
export function applyChapterRowsToDescription(
  description: string,
  rows: ChapterDraftRow[],
): string {
  const body = stripChapterLinesFromDescription(description);
  const lines: string[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    const time = row.time.trim();
    const title = row.title.trim();
    if (!time || !title) continue;
    const seconds = parseTimestampToSeconds(time);
    if (seconds === null) continue;
    if (seen.has(seconds)) continue;
    seen.add(seconds);
    lines.push(`${formatSecondsAsTimestamp(seconds)} ${title}`);
  }
  lines.sort((a, b) => {
    const as = parseTimestampToSeconds(a.split(/\s+/)[0]) ?? 0;
    const bs = parseTimestampToSeconds(b.split(/\s+/)[0]) ?? 0;
    return as - bs;
  });
  if (lines.length === 0) return body;
  return body ? `${body}\n\n${lines.join('\n')}` : lines.join('\n');
}

