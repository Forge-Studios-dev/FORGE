const CUE_TIMING_RE =
  /^\d{2}:\d{2}(:\d{2})?[.,]\d{3}\s*-->\s*\d{2}:\d{2}(:\d{2})?[.,]\d{3}/;

/** Best-effort WebVTT → plain text, for full-text search indexing (not caption rendering). */
export function vttToPlainText(vtt: string, maxLength = 100_000): string {
  const lines: string[] = [];
  let previous: string | null = null;
  let inSkippedBlock = false;

  for (const rawLine of vtt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      inSkippedBlock = false;
      continue;
    }
    if (inSkippedBlock) continue;
    if (line === 'WEBVTT') continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(line)) {
      inSkippedBlock = true;
      continue;
    }
    if (CUE_TIMING_RE.test(line)) continue;
    if (/^\d+$/.test(line)) continue; // numeric cue identifier

    const stripped = line.replace(/<[^>]*>/g, '').trim();
    if (!stripped) continue;
    if (stripped === previous) continue; // rolling-caption repeats across overlapping cues
    lines.push(stripped);
    previous = stripped;
  }

  const text = lines.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}
