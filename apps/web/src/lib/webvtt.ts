/**
 * Minimal WebVTT cue parser for transcript UI (not a full VTT implementation).
 */

export type VttCue = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

function stripCueMarkup(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTimestamp(raw: string): number | null {
  const parts = raw.trim().replace(',', '.').split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => Number.parseFloat(p));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  if (nums.length === 2) {
    const [m, s] = nums;
    return m * 60 + s;
  }
  const [h, m, s] = nums;
  return h * 3600 + m * 60 + s;
}

export function parseWebVtt(source: string): VttCue[] {
  if (!source?.trim()) return [];
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const blocks = normalized.split(/\n\n+/);
  const cues: VttCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    if (lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE') || lines[0].startsWith('STYLE')) {
      continue;
    }
    let timingLine = lines[0];
    let textLines = lines.slice(1);
    if (!timingLine.includes('-->') && lines[1]?.includes('-->')) {
      timingLine = lines[1];
      textLines = lines.slice(2);
    }
    if (!timingLine.includes('-->')) continue;
    const [startRaw, endRaw] = timingLine.split('-->').map((s) => s.trim().split(/\s+/)[0]);
    const startSeconds = parseTimestamp(startRaw);
    const endSeconds = parseTimestamp(endRaw);
    if (startSeconds == null || endSeconds == null) continue;
    const text = stripCueMarkup(textLines.join(' '));
    if (!text) continue;
    cues.push({ startSeconds, endSeconds, text });
  }

  return cues;
}
